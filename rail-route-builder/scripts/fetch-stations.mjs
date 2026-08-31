// OpenStreetMap (Overpass API) から日本の鉄道駅を取得して src/data/stations-jp.json を作る。
// 実行: node scripts/fetch-stations.mjs
// データは © OpenStreetMap contributors (ODbL)。READMEのクレジット表記を消さないこと。
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync(new URL("../src/data/", import.meta.url), { recursive: true });

const query = `[out:json][timeout:300];area["ISO3166-1"="JP"][admin_level=2]->.jp;node(area.jp)["railway"~"^(station|halt)$"];out;`;

const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

let json = null;
let lastError = null;
for (const endpoint of endpoints) {
  try {
    console.log("trying:", endpoint);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "rail-route-builder/0.1 (personal hobby project)",
        Accept: "application/json",
      },
      body: "data=" + encodeURIComponent(query),
    });
    if (!res.ok) {
      lastError = new Error(`Overpass error: ${res.status} ${res.statusText}`);
      continue;
    }
    json = await res.json();
    break;
  } catch (e) {
    lastError = e;
  }
}
if (!json) throw lastError ?? new Error("no response");
console.log("raw nodes:", json.elements.length);

const out = [];
const byName = new Map();
for (const el of json.elements) {
  const tags = el.tags ?? {};
  const name = tags.name || tags["name:ja"];
  if (!name || typeof el.lat !== "number") continue;
  const kana = tags["name:ja_kana"] || tags["name:ja-Hira"] || "";
  const op = tags.operator || tags["operator:ja"] || "";
  const la = Math.round(el.lat * 1e5) / 1e5;
  const lo = Math.round(el.lon * 1e5) / 1e5;
  const near = (byName.get(name) ?? []).find(
    (o) => Math.abs(o[1] - la) < 0.02 && Math.abs(o[2] - lo) < 0.02,
  );
  if (near) {
    if (!near[4] && op) near[4] = op;
    if (!near[3] && kana) near[3] = kana;
    continue;
  }
  const row = [name, la, lo, kana, op];
  out.push(row);
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(row);
}
out.sort((a, b) => a[0].localeCompare(b[0], "ja"));
writeFileSync(new URL("../src/data/stations-jp.json", import.meta.url), JSON.stringify(out));
console.log("stations written:", out.length);
