// 国土数値情報の鉄道データから「経路探索用の線路ネットワーク」を作る。
// 実行: node scripts/build-rail-graph.mjs   （先に build-railways.mjs を実行しておくこと）
//
// 生の線路データは点が多すぎて経路探索に使えないので、
//   ① 分岐点・末端・駅のそばの点だけを「節（node）」として残し
//   ② そのあいだの連なりを「辺（edge）」1本にまとめる（線形は辺が持つ）
// という縮約をかける。こうすると節が数万個に収まり、ブラウザでも最短経路を出せる。
//
// 出典: 「国土数値情報（鉄道データ）」（国土交通省）を加工して作成。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const dataDir = new URL("src/data/", root);
mkdirSync(dataDir, { recursive: true });

const geojsonPath = fileURLToPath(
  new URL(".cache/n02/UTF-8/N02-24_RailroadSection.geojson", root),
);
if (!existsSync(geojsonPath)) {
  throw new Error("先に `node scripts/build-railways.mjs` を実行してください");
}

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function distMeters(aLat, aLon, bLat, bLon) {
  const dLat = rad(bLat - aLat);
  const dLon = rad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// --- 1. 生の線分から節と隣接関係を作る ---
console.log("読み込み中 ...");
const geo = JSON.parse(readFileSync(geojsonPath, "utf8"));

const nodeIndex = new Map(); // "lat,lon" -> id
const nodeLat = [];
const nodeLon = [];
function nodeIdOf(lat, lon) {
  const key = `${lat},${lon}`;
  let id = nodeIndex.get(key);
  if (id === undefined) {
    id = nodeLat.length;
    nodeIndex.set(key, id);
    nodeLat.push(lat);
    nodeLon.push(lon);
  }
  return id;
}

/** 隣接: adj[id] = [相手id, ...]（重複辺も素直に持つ） */
const adj = [];
function link(a, b) {
  if (a === b) return;
  (adj[a] ??= []).push(b);
  (adj[b] ??= []).push(a);
}

let segmentCount = 0;
for (const f of geo.features) {
  if (!f.geometry || f.geometry.type !== "LineString") continue;
  const coords = f.geometry.coordinates;
  let prev = -1;
  for (const [lon, lat] of coords) {
    const id = nodeIdOf(lat, lon);
    if (prev >= 0) {
      link(prev, id);
      segmentCount++;
    }
    prev = id;
  }
}
console.log(`節: ${nodeLat.length} / 線分: ${segmentCount}`);

// --- 2. 駅のそばの節を「残す節」に含める（駅から経路を始められるように） ---
const stations = JSON.parse(readFileSync(new URL("stations-jp.json", dataDir), "utf8"));

// 粗い格子で近傍探索する
const CELL = 0.01; // 約1.1km
const grid = new Map();
for (let id = 0; id < nodeLat.length; id++) {
  const key = `${Math.floor(nodeLat[id] / CELL)}_${Math.floor(nodeLon[id] / CELL)}`;
  (grid.get(key) ?? grid.set(key, []).get(key)).push(id);
}

function nearestNode(lat, lon, maxMeters) {
  const gx = Math.floor(lat / CELL);
  const gy = Math.floor(lon / CELL);
  let best = -1;
  let bestDist = Infinity;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (const id of grid.get(`${gx + dx}_${gy + dy}`) ?? []) {
        const d = distMeters(lat, lon, nodeLat[id], nodeLon[id]);
        if (d < bestDist) {
          bestDist = d;
          best = id;
        }
      }
    }
  }
  return bestDist <= maxMeters ? best : -1;
}

const keep = new Uint8Array(nodeLat.length);
let stationHits = 0;
for (const [, lat, lon] of stations) {
  const id = nearestNode(lat, lon, 800);
  if (id >= 0) {
    keep[id] = 1;
    stationHits++;
  }
}
console.log(`駅を線路上に対応づけ: ${stationHits}/${stations.length}`);

// 分岐点・末端（隣接が2本でない節）も残す
let junctions = 0;
for (let id = 0; id < nodeLat.length; id++) {
  const degree = new Set(adj[id] ?? []).size;
  if (degree !== 2) {
    keep[id] = 1;
    junctions++;
  }
}
console.log(`分岐・末端: ${junctions}`);

// --- 3. 残す節のあいだを1本の辺に縮約する ---
const edges = [];
const visitedPair = new Set();

for (let start = 0; start < nodeLat.length; start++) {
  if (!keep[start]) continue;
  for (const first of new Set(adj[start] ?? [])) {
    const pairKey = start < first ? `${start}_${first}` : `${first}_${start}`;
    if (visitedPair.has(pairKey)) continue;

    // 残す節にぶつかるまで辿る
    const path = [start];
    let prev = start;
    let cur = first;
    let length = distMeters(nodeLat[start], nodeLon[start], nodeLat[first], nodeLon[first]);
    visitedPair.add(pairKey);
    path.push(cur);

    while (!keep[cur]) {
      const neighbours = [...new Set(adj[cur] ?? [])].filter((n) => n !== prev);
      if (neighbours.length !== 1) break;
      const next = neighbours[0];
      const k = cur < next ? `${cur}_${next}` : `${next}_${cur}`;
      if (visitedPair.has(k)) break;
      visitedPair.add(k);
      length += distMeters(nodeLat[cur], nodeLon[cur], nodeLat[next], nodeLon[next]);
      prev = cur;
      cur = next;
      path.push(cur);
    }
    if (path.length < 2) continue;
    edges.push({ a: start, b: cur, length, path });
  }
}
console.log(`縮約後の辺: ${edges.length}`);

/** Douglas-Peucker（明示スタック版）。描画用に線形を間引く。距離は間引く前の値を使う。 */
function simplify(points, epsilon) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop();
    if (end - start < 2) continue;
    const [ax, ay] = points[start];
    const [bx, by] = points[end];
    const dx = bx - ax;
    const dy = by - ay;
    const denom = Math.hypot(dx, dy) || 1;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const [px, py] = points[i];
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / denom;
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index >= 0 && maxDist > epsilon) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

// --- 4. 使われる節だけ採番し直して書き出す ---
const used = new Map();
function compactId(oldId) {
  let id = used.get(oldId);
  if (id === undefined) {
    id = used.size;
    used.set(oldId, id);
  }
  return id;
}

// 線形は「1e-5度きざみの整数、直前の点からの差分」で持つ。
// 生の緯度経度を並べるより桁数が減り、ファイルが数分の一になる。
const SCALE = 1e5;
const outEdges = [];
let rawPoints = 0;
let keptPoints = 0;
for (const e of edges) {
  const a = compactId(e.a);
  const b = compactId(e.b);
  const full = e.path.map((id) => [nodeLat[id], nodeLon[id]]);
  rawPoints += full.length;
  const thinned = simplify(full, 0.0002); // 約22m
  keptPoints += thinned.length;
  const deltas = [];
  let prevLat = Math.round(full[0][0] * SCALE);
  let prevLon = Math.round(full[0][1] * SCALE);
  for (let i = 1; i < thinned.length - 1; i++) {
    const lat = Math.round(thinned[i][0] * SCALE);
    const lon = Math.round(thinned[i][1] * SCALE);
    deltas.push(lat - prevLat, lon - prevLon);
    prevLat = lat;
    prevLon = lon;
  }
  outEdges.push([a, b, Math.round(e.length), deltas]);
}
console.log(`線形の点: ${rawPoints} → ${keptPoints}`);

// 節も1e-5度きざみの整数で持つ（[lat, lon, lat, lon, ...] の平坦な配列）
const outNodes = new Array(used.size * 2);
for (const [oldId, newId] of used) {
  outNodes[newId * 2] = Math.round(nodeLat[oldId] * SCALE);
  outNodes[newId * 2 + 1] = Math.round(nodeLon[oldId] * SCALE);
}

const payload = { scale: SCALE, nodes: outNodes, edges: outEdges };
const outPath = new URL("rail-graph.json", dataDir);
writeFileSync(outPath, JSON.stringify(payload));
const mb = readFileSync(outPath).length / 1024 / 1024;
console.log(`nodes: ${outNodes.length} / edges: ${outEdges.length} / ${mb.toFixed(2)} MB`);
