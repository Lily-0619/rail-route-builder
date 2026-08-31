import { JP_STATIONS, getJpStation, jpToStation } from "../data/stations";
import { epochToJstIso, minutesBetween } from "../lib/time";
import type { RouteCandidate, Station, TransitSegment } from "../types";
import type { TransitProvider } from "./transit-provider";

type MockStation = {
  id: string;
  name: string;
  yomi: string;
  pref: string;
  lat: number;
  lon: number;
  lines: string[];
};

const STATIONS: MockStation[] = [
  { id: "nagoya", name: "名古屋", yomi: "なごや", pref: "愛知県", lat: 35.171, lon: 136.882, lines: ["東海道新幹線", "JR東海道本線", "近鉄名古屋線", "名鉄名古屋本線"] },
  { id: "kanayama", name: "金山", yomi: "かなやま", pref: "愛知県", lat: 35.143, lon: 136.901, lines: ["JR東海道本線", "名鉄名古屋本線"] },
  { id: "gifu", name: "岐阜", yomi: "ぎふ", pref: "岐阜県", lat: 35.41, lon: 136.757, lines: ["JR東海道本線", "JR高山本線"] },
  { id: "toyohashi", name: "豊橋", yomi: "とよはし", pref: "愛知県", lat: 34.763, lon: 137.381, lines: ["東海道新幹線", "JR東海道本線", "名鉄名古屋本線"] },
  { id: "hamamatsu", name: "浜松", yomi: "はままつ", pref: "静岡県", lat: 34.704, lon: 137.734, lines: ["東海道新幹線", "JR東海道本線"] },
  { id: "shizuoka", name: "静岡", yomi: "しずおか", pref: "静岡県", lat: 34.972, lon: 138.389, lines: ["東海道新幹線", "JR東海道本線"] },
  { id: "yokohama", name: "横浜", yomi: "よこはま", pref: "神奈川県", lat: 35.466, lon: 139.622, lines: ["JR東海道本線"] },
  { id: "shin-yokohama", name: "新横浜", yomi: "しんよこはま", pref: "神奈川県", lat: 35.507, lon: 139.617, lines: ["東海道新幹線"] },
  { id: "shinagawa", name: "品川", yomi: "しながわ", pref: "東京都", lat: 35.629, lon: 139.739, lines: ["東海道新幹線", "JR東海道本線", "JR山手線"] },
  { id: "tokyo", name: "東京", yomi: "とうきょう", pref: "東京都", lat: 35.681, lon: 139.767, lines: ["東海道新幹線", "東北新幹線", "JR東海道本線", "JR山手線"] },
  { id: "omiya", name: "大宮", yomi: "おおみや", pref: "埼玉県", lat: 35.906, lon: 139.624, lines: ["東北新幹線", "北陸新幹線", "JR東北本線"] },
  { id: "sendai", name: "仙台", yomi: "せんだい", pref: "宮城県", lat: 38.26, lon: 140.882, lines: ["東北新幹線", "JR東北本線"] },
  { id: "nagano", name: "長野", yomi: "ながの", pref: "長野県", lat: 36.643, lon: 138.189, lines: ["北陸新幹線", "JR篠ノ井線"] },
  { id: "matsumoto", name: "松本", yomi: "まつもと", pref: "長野県", lat: 36.231, lon: 137.964, lines: ["JR篠ノ井線", "JR中央本線"] },
  { id: "kanazawa", name: "金沢", yomi: "かなざわ", pref: "石川県", lat: 36.578, lon: 136.648, lines: ["北陸新幹線", "JR北陸本線"] },
  { id: "takayama", name: "高山", yomi: "たかやま", pref: "岐阜県", lat: 36.141, lon: 137.252, lines: ["JR高山本線"] },
  { id: "kyoto", name: "京都", yomi: "きょうと", pref: "京都府", lat: 34.985, lon: 135.759, lines: ["東海道新幹線", "JR東海道本線", "近鉄京都線"] },
  { id: "shin-osaka", name: "新大阪", yomi: "しんおおさか", pref: "大阪府", lat: 34.734, lon: 135.5, lines: ["東海道新幹線", "山陽新幹線", "JR東海道本線"] },
  { id: "osaka", name: "大阪", yomi: "おおさか", pref: "大阪府", lat: 34.702, lon: 135.495, lines: ["JR東海道本線", "JR大阪環状線"] },
  { id: "namba", name: "大阪難波", yomi: "おおさかなんば", pref: "大阪府", lat: 34.666, lon: 135.501, lines: ["近鉄難波線", "阪神なんば線"] },
  { id: "tsuruhashi", name: "鶴橋", yomi: "つるはし", pref: "大阪府", lat: 34.665, lon: 135.531, lines: ["近鉄大阪線", "近鉄難波線", "JR大阪環状線"] },
  { id: "tennoji", name: "天王寺", yomi: "てんのうじ", pref: "大阪府", lat: 34.646, lon: 135.513, lines: ["JR大阪環状線", "JR阪和線"] },
  { id: "yamato-yagi", name: "大和八木", yomi: "やまとやぎ", pref: "奈良県", lat: 34.509, lon: 135.793, lines: ["近鉄大阪線", "近鉄橿原線"] },
  { id: "kintetsu-nara", name: "近鉄奈良", yomi: "きんてつなら", pref: "奈良県", lat: 34.685, lon: 135.828, lines: ["近鉄奈良線"] },
  { id: "kashiharajingu-mae", name: "橿原神宮前", yomi: "かしはらじんぐうまえ", pref: "奈良県", lat: 34.482, lon: 135.796, lines: ["近鉄橿原線", "近鉄吉野線"] },
  { id: "yoshino", name: "吉野", yomi: "よしの", pref: "奈良県", lat: 34.461, lon: 135.858, lines: ["近鉄吉野線"] },
  { id: "ise-shi", name: "伊勢市", yomi: "いせし", pref: "三重県", lat: 34.491, lon: 136.71, lines: ["近鉄山田線", "JR参宮線"] },
  { id: "toba", name: "鳥羽", yomi: "とば", pref: "三重県", lat: 34.481, lon: 136.844, lines: ["近鉄鳥羽線", "JR参宮線"] },
  { id: "kashikojima", name: "賢島", yomi: "かしこじま", pref: "三重県", lat: 34.303, lon: 136.825, lines: ["近鉄志摩線"] },
  { id: "sannomiya", name: "三ノ宮", yomi: "さんのみや", pref: "兵庫県", lat: 34.694, lon: 135.198, lines: ["JR東海道本線", "阪神本線"] },
  { id: "himeji", name: "姫路", yomi: "ひめじ", pref: "兵庫県", lat: 34.826, lon: 134.69, lines: ["山陽新幹線", "JR山陽本線"] },
  { id: "hiroshima", name: "広島", yomi: "ひろしま", pref: "広島県", lat: 34.397, lon: 132.475, lines: ["山陽新幹線", "JR山陽本線"] },
  { id: "hakata", name: "博多", yomi: "はかた", pref: "福岡県", lat: 33.59, lon: 130.421, lines: ["山陽新幹線", "JR鹿児島本線"] },
];

/**
 * 上の座標は手入力のおおよその値なので、同名のOSM実データで補正する。
 * ずれたままだと線路に対応づけられず、経路が線路に沿わなくなる。
 * 同名駅が各地にあるため、手入力の位置からいちばん近いものを採る。
 */
function refineCoordinates(st: MockStation): MockStation {
  let bestLat = st.lat;
  let bestLon = st.lon;
  let bestDist = Infinity;
  for (const s of JP_STATIONS) {
    if (s.name !== st.name) continue;
    const d = (s.lat - st.lat) ** 2 + (s.lon - st.lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestLat = s.lat;
      bestLon = s.lon;
    }
  }
  // 約0.2度(≒20km)以内に同名駅があるときだけ採用する
  return bestDist < 0.04 ? { ...st, lat: bestLat, lon: bestLon } : st;
}

for (let i = 0; i < STATIONS.length; i++) {
  STATIONS[i] = refineCoordinates(STATIONS[i]);
}

const byRef = new Map(STATIONS.map((s) => [s.id, s]));

function operatorOf(line: string): string {
  if (line.includes("新幹線") || line.startsWith("JR")) return "JR";
  if (line.startsWith("近鉄")) return "近鉄";
  if (line.startsWith("名鉄")) return "名鉄";
  if (line.startsWith("阪神")) return "阪神";
  return "私鉄";
}

function operatorsOf(st: MockStation): string[] {
  return [...new Set(st.lines.map(operatorOf))];
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function haversineKm(a: MockStation, b: MockStation): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(s));
}

function lineColor(line: string): string {
  if (line.includes("新幹線")) return "#0f6ab4";
  if (line.startsWith("近鉄")) return "#c0392b";
  if (line.startsWith("名鉄")) return "#e74c3c";
  if (line.startsWith("阪神")) return "#005bac";
  if (line.startsWith("JR")) return "#e8762d";
  return "#8d7683";
}

type CandidateKind = "fast" | "std" | "slow";

function pickRouteLine(a: MockStation, b: MockStation, preferFast: boolean): string | null {
  const shared = a.lines.filter((l) => b.lines.includes(l));
  if (preferFast) {
    const shinkansen = shared.find((l) => l.includes("新幹線"));
    if (shinkansen) return shinkansen;
  }
  const conventional = shared.find((l) => !l.includes("新幹線")) ?? shared[0];
  if (conventional) return conventional;
  const sharedOps = operatorsOf(a).filter((o) => operatorsOf(b).includes(o));
  if (sharedOps.length > 0) return `${sharedOps[0]}線`;
  return null;
}

function findHub(a: MockStation, b: MockStation, preferFast: boolean): MockStation | null {
  let best: MockStation | null = null;
  let bestDetour = Infinity;
  for (const h of STATIONS) {
    if (h.id === a.id || h.id === b.id) continue;
    if (!pickRouteLine(a, h, preferFast) || !pickRouteLine(h, b, preferFast)) continue;
    const detour = haversineKm(a, h) + haversineKm(h, b);
    if (detour < bestDetour) {
      bestDetour = detour;
      best = h;
    }
  }
  return best;
}

function trainName(line: string, kind: CandidateKind, seed: number): string {
  if (line.includes("新幹線")) {
    if (line.startsWith("東海道") || line.startsWith("山陽")) return ["のぞみ", "ひかり", "こだま"][kind === "fast" ? 0 : kind === "std" ? 1 : 2];
    if (line.startsWith("東北")) return kind === "fast" ? "はやぶさ" : "やまびこ";
    if (line.startsWith("北陸")) return kind === "fast" ? "かがやき" : "はくたか";
    return "新幹線";
  }
  if (line.startsWith("近鉄")) {
    if (kind === "fast") return ["ひのとり", "アーバンライナー", "特急"][seed % 3];
    return kind === "std" ? "急行" : "普通";
  }
  if (line.startsWith("名鉄")) return kind === "fast" ? "ミュースカイ" : kind === "std" ? "特急" : "急行";
  return kind === "fast" ? "特急" : kind === "std" ? "快速" : "普通";
}

function ceilToMinutes(epochMs: number, stepMin: number): number {
  const step = stepMin * 60_000;
  return Math.ceil(epochMs / step) * step;
}

function avoidNight(epochMs: number): number {
  const iso = epochToJstIso(epochMs);
  const hour = Number(iso.slice(11, 13));
  if (hour >= 1 && hour < 5) {
    return new Date(`${iso.slice(0, 10)}T05:00:00+09:00`).getTime();
  }
  return epochMs;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toStation(st: MockStation): Station {
  return {
    id: st.id,
    name: st.name,
    secondaryText: `${st.pref}・${operatorsOf(st).join("・")}`,
    latitude: st.lat,
    longitude: st.lon,
    providerRef: st.id,
  };
}

function normalizeQuery(q: string): string {
  return q
    .trim()
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export class MockProvider implements TransitProvider {
  readonly name = "mock";
  readonly capabilities = {
    stationSearch: true,
    routeSchedules: true,
    fullStationTimetable: false,
    multiViaSearch: false,
  };

  async searchStations(query: string): Promise<Station[]> {
    await delay(120);
    const raw = query.trim();
    if (raw.length === 0) return [];
    const nq = normalizeQuery(raw);
    const curated = STATIONS.filter((s) => s.name.includes(raw) || s.yomi.includes(nq)).map(
      toStation,
    );
    const seenNames = new Set(curated.map((s) => s.name));
    const extra: Station[] = [];
    for (const s of JP_STATIONS) {
      if (curated.length + extra.length >= 10) break;
      if (seenNames.has(s.name)) continue;
      if (s.name.includes(raw) || (s.kana !== "" && normalizeQuery(s.kana).includes(nq))) {
        extra.push(jpToStation(s));
        seenNames.add(s.name);
      }
    }
    return [...curated, ...extra].slice(0, 10);
  }

  async searchRoutes(input: {
    from: Station;
    to: Station;
    departureAt: string;
  }): Promise<RouteCandidate[]> {
    const from = resolveStation(input.from);
    const to = resolveStation(input.to);
    const h = hashStr(`${input.from.providerRef}->${input.to.providerRef}`);
    await delay(200 + (h % 150));
    if (from.id === to.id) return [];

    const readyEpoch = new Date(input.departureAt).getTime();
    const fetchedAt = new Date().toISOString();
    const headway = 10 + (h % 4) * 5;
    const kinds: CandidateKind[] = ["fast", "std", "std", "slow"];
    const candidates: RouteCandidate[] = [];

    for (let i = 0; i < 4; i++) {
      const kind = kinds[i];
      const preferFast = kind === "fast";
      const plan = planJourney(from, to, preferFast);

      const depEpoch = avoidNight(
        ceilToMinutes(readyEpoch, 5) + i * headway * 60_000 + (((h >>> (i * 3)) % 5) + 1) * 60_000,
      );
      const segments: TransitSegment[] = [];
      let cursor = depEpoch;
      let totalKm = 0;
      let hasShinkansen = false;

      for (let s = 0; s < plan.length; s++) {
        const seg = plan[s];
        const km = haversineKm(seg.from, seg.to) * 1.3;
        totalKm += km;
        const isShinkansen = seg.line.includes("新幹線");
        if (isShinkansen) hasShinkansen = true;
        const speed = isShinkansen
          ? kind === "slow"
            ? 120
            : kind === "fast"
              ? 200
              : 160
          : kind === "fast"
            ? 90
            : kind === "std"
              ? 72
              : 55;
        const segMin = Math.max(3, Math.round((km / speed) * 60));
        const segDep = cursor;
        const segArr = cursor + segMin * 60_000;
        segments.push({
          mode: "RAIL",
          lineName: seg.line,
          trainName: trainName(seg.line, kind, h + i),
          headsign: `${seg.to.name}方面`,
          fromName: seg.from.name,
          toName: seg.to.name,
          departureAt: epochToJstIso(segDep),
          arrivalAt: epochToJstIso(segArr),
          stopCount: Math.max(1, Math.round(km / (isShinkansen ? 60 : kind === "slow" ? 6 : 18))),
          color: lineColor(seg.line),
        });
        cursor = segArr;
        if (s < plan.length - 1) {
          cursor += (6 + (h % 5)) * 60_000;
        }
      }

      const first = segments[0];
      const last = segments[segments.length - 1];
      const expressFee = hasShinkansen ? totalKm * 8 : kind === "fast" ? totalKm * 5 : 0;
      let fareYen: number | null =
        Math.round(((16 * totalKm + 180 + expressFee) * (kind === "slow" ? 0.85 : 1)) / 10) * 10;
      if (i === 3 && h % 3 === 0) fareYen = null;

      candidates.push({
        id: `mock_${from.id}_${to.id}_${first.departureAt}_${i}`,
        departureAt: first.departureAt,
        arrivalAt: last.arrivalAt,
        durationMinutes: minutesBetween(first.departureAt, last.arrivalAt),
        transferCount: segments.length - 1,
        fareYen,
        segments,
        source: "mock",
        fetchedAt,
      });
    }

    candidates.sort((a, b) => a.departureAt.localeCompare(b.departureAt));
    return dedupeByDeparture(
      candidates.filter((c) => new Date(c.departureAt).getTime() >= readyEpoch),
    );
  }
}

type JourneySegment = { from: MockStation; to: MockStation; line: string };

function planJourney(a: MockStation, b: MockStation, preferFast: boolean): JourneySegment[] {
  const direct = pickRouteLine(a, b, preferFast);
  if (direct) return [{ from: a, to: b, line: direct }];
  const hub = findHub(a, b, preferFast);
  if (hub) {
    const l1 = pickRouteLine(a, hub, preferFast);
    const l2 = pickRouteLine(hub, b, preferFast);
    if (l1 && l2) {
      return [
        { from: a, to: hub, line: l1 },
        { from: hub, to: b, line: l2 },
      ];
    }
  }
  return [{ from: a, to: b, line: "在来線ルート" }];
}

function resolveStation(st: Station): MockStation {
  const curated = byRef.get(st.providerRef);
  if (curated) return curated;
  if (st.providerRef.startsWith("osm_")) {
    const jp = getJpStation(st.providerRef);
    if (jp) {
      return { id: jp.id, name: jp.name, yomi: jp.kana, pref: "", lat: jp.lat, lon: jp.lon, lines: [] };
    }
  }
  return {
    id: st.providerRef,
    name: st.name,
    yomi: "",
    pref: "",
    lat: st.latitude ?? 35.681,
    lon: st.longitude ?? 139.767,
    lines: [],
  };
}

function dedupeByDeparture(list: RouteCandidate[]): RouteCandidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = `${c.departureAt}_${c.durationMinutes}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const mockProvider = new MockProvider();

export type CuratedMapStation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  operator: string;
};

export const curatedMapStations: CuratedMapStation[] = STATIONS.map((s) => ({
  id: s.id,
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  operator: operatorsOf(s).join("・"),
}));

export function curatedStationById(id: string): Station | undefined {
  const st = byRef.get(id);
  return st ? toStation(st) : undefined;
}
