// 線路ネットワーク上の経路探索。データが重いので、このモジュールは動的importで読み込む。
// 生成: scripts/build-rail-graph.mjs（出典: 国土数値情報 鉄道データ／国土交通省）
import graph from "./rail-graph.json";

type RawEdge = [number, number, number, number[]];
type RawGraph = { scale: number; nodes: number[]; edges: RawEdge[] };

const { scale, nodes: rawNodes, edges: rawEdges } = graph as RawGraph;

const nodeCount = rawNodes.length / 2;
const nodeLat = new Float64Array(nodeCount);
const nodeLon = new Float64Array(nodeCount);
for (let i = 0; i < nodeCount; i++) {
  nodeLat[i] = rawNodes[i * 2] / scale;
  nodeLon[i] = rawNodes[i * 2 + 1] / scale;
}

/** 各節から出ている辺の番号 */
const incident: number[][] = Array.from({ length: nodeCount }, () => []);
for (let e = 0; e < rawEdges.length; e++) {
  incident[rawEdges[e][0]].push(e);
  incident[rawEdges[e][1]].push(e);
}

/** 辺の線形（両端の節を含む）を復元する。差分整数から緯度経度へ戻す。 */
function edgePoints(edgeIndex: number): [number, number][] {
  const [a, b, , deltas] = rawEdges[edgeIndex];
  const points: [number, number][] = [[nodeLat[a], nodeLon[a]]];
  let lat = Math.round(nodeLat[a] * scale);
  let lon = Math.round(nodeLon[a] * scale);
  for (let i = 0; i < deltas.length; i += 2) {
    lat += deltas[i];
    lon += deltas[i + 1];
    points.push([lat / scale, lon / scale]);
  }
  points.push([nodeLat[b], nodeLon[b]]);
  return points;
}

// --- 最寄りの節を引くための粗い格子 ---
const CELL = 0.02;
const grid = new Map<string, number[]>();
for (let i = 0; i < nodeCount; i++) {
  const key = `${Math.floor(nodeLat[i] / CELL)}_${Math.floor(nodeLon[i] / CELL)}`;
  const bucket = grid.get(key);
  if (bucket) bucket.push(i);
  else grid.set(key, [i]);
}

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
function distMeters(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 駅の座標にいちばん近い線路上の節。遠すぎるときは -1。 */
export function nearestRailNode(lat: number, lon: number, maxMeters = 1500): number {
  const gx = Math.floor(lat / CELL);
  const gy = Math.floor(lon / CELL);
  let best = -1;
  let bestDist = Infinity;
  for (let ring = 1; ring <= 3; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        if (ring > 1 && Math.abs(dx) < ring && Math.abs(dy) < ring) continue;
        for (const id of grid.get(`${gx + dx}_${gy + dy}`) ?? []) {
          const d = distMeters(lat, lon, nodeLat[id], nodeLon[id]);
          if (d < bestDist) {
            bestDist = d;
            best = id;
          }
        }
      }
    }
    if (best >= 0 && bestDist <= CELL * 111000 * (ring - 0.5)) break;
  }
  return bestDist <= maxMeters ? best : -1;
}

/** 二分ヒープ（距離が小さいものから取り出す） */
class MinHeap {
  private nodes: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.nodes.length;
  }

  push(node: number, key: number): void {
    this.nodes.push(node);
    this.keys.push(key);
    let i = this.nodes.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): number {
    const top = this.nodes[0];
    const lastNode = this.nodes.pop()!;
    const lastKey = this.keys.pop()!;
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode;
      this.keys[0] = lastKey;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let smallest = i;
        if (l < this.keys.length && this.keys[l] < this.keys[smallest]) smallest = l;
        if (r < this.keys.length && this.keys[r] < this.keys[smallest]) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.nodes[a], this.nodes[b]] = [this.nodes[b], this.nodes[a]];
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
  }
}

const pathCache = new Map<string, [number, number][] | null>();

/** 節から節への最短経路をダイクストラ法で解き、線路に沿った線形を返す。 */
function shortestPath(startNode: number, goalNode: number): [number, number][] | null {
  if (startNode === goalNode) return null;
  const cacheKey = `${startNode}_${goalNode}`;
  const cached = pathCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const dist = new Float64Array(nodeCount).fill(Infinity);
  const cameFromEdge = new Int32Array(nodeCount).fill(-1);
  const cameFromNode = new Int32Array(nodeCount).fill(-1);
  const settled = new Uint8Array(nodeCount);
  const heap = new MinHeap();

  dist[startNode] = 0;
  heap.push(startNode, 0);

  let found = false;
  while (heap.size > 0) {
    const current = heap.pop();
    if (settled[current]) continue;
    settled[current] = 1;
    if (current === goalNode) {
      found = true;
      break;
    }
    for (const e of incident[current]) {
      const [a, b, length] = rawEdges[e];
      const next = a === current ? b : a;
      if (settled[next]) continue;
      const candidate = dist[current] + length;
      if (candidate < dist[next]) {
        dist[next] = candidate;
        cameFromEdge[next] = e;
        cameFromNode[next] = current;
        heap.push(next, candidate);
      }
    }
  }

  if (!found) {
    pathCache.set(cacheKey, null);
    return null;
  }

  // 逆順にたどって線形をつなぐ
  const chunks: [number, number][][] = [];
  let cursor = goalNode;
  while (cursor !== startNode) {
    const e = cameFromEdge[cursor];
    const from = cameFromNode[cursor];
    if (e < 0 || from < 0) break;
    const pts = edgePoints(e);
    // 辺は from → cursor の向きに揃える
    chunks.push(rawEdges[e][0] === from ? pts : pts.slice().reverse());
    cursor = from;
  }
  chunks.reverse();

  const line: [number, number][] = [];
  for (const chunk of chunks) {
    for (const p of chunk) {
      const last = line[line.length - 1];
      if (!last || last[0] !== p[0] || last[1] !== p[1]) line.push(p);
    }
  }
  const result = line.length >= 2 ? line : null;
  pathCache.set(cacheKey, result);
  return result;
}

/** 2駅のあいだを線路に沿って結ぶ線形。見つからなければ null（呼び出し側で直線に落とす）。 */
export function findRailPath(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): [number, number][] | null {
  const a = nearestRailNode(from.lat, from.lon);
  const b = nearestRailNode(to.lat, to.lon);
  if (a < 0 || b < 0) return null;
  const path = shortestPath(a, b);
  if (!path) return null;
  // 駅そのものの位置と線路上の点は少しずれるので、両端を駅につなぐ
  return [[from.lat, from.lon], ...path, [to.lat, to.lon]];
}
