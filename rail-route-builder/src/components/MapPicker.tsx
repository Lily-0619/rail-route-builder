import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { JP_STATIONS, jpToStation, type MapStation } from "../data/stations";
import { CATEGORY_ORDER, RAIL_STYLE, type RailCategory } from "../data/railway-style";
import type { RailLine } from "../data/railways";
import { curatedMapStations, curatedStationById } from "../providers/mock-provider";
import { usePlanner } from "../state/store";
import type { Station } from "../types";

type Pick = {
  key: string;
  name: string;
  lat: number;
  lon: number;
  sub: string;
  make: () => Station | undefined;
};

const MAJOR_PICKS: Pick[] = curatedMapStations.map((s) => ({
  key: s.id,
  name: s.name,
  lat: s.lat,
  lon: s.lon,
  sub: s.operator,
  make: () => curatedStationById(s.id),
}));

function jpPick(s: MapStation): Pick {
  return {
    key: s.id,
    name: s.name,
    lat: s.lat,
    lon: s.lon,
    sub: s.operator || "駅",
    make: () => jpToStation(s),
  };
}

const DETAIL_ZOOM = 10;
const TOOLTIP_ZOOM = 9;
const MAX_MARKERS = 400;
const MAX_RAIL_LINES = 4000;

type RailBounds = { south: number; west: number; north: number; east: number };
type RailLookup = (
  bounds: RailBounds,
  zoom: number,
  limit: number,
  visible?: ReadonlySet<RailCategory>,
) => RailLine[];
type RailPathFinder = (
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
) => [number, number][] | null;

export default function MapPicker() {
  const addStation = usePlanner((s) => s.addStation);
  const stops = usePlanner((s) => s.stops);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const railRendererRef = useRef<L.Canvas | null>(null);
  const railLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const addRef = useRef(addStation);
  addRef.current = addStation;

  // 地図を作り直したことを他のeffectへ知らせるための版数
  const [mapVersion, setMapVersion] = useState(0);
  // 全国の線路データは重いので、地図を出したあとで読み込む
  const [railLookup, setRailLookup] = useState<RailLookup | null>(null);
  // 経路探索用の線路ネットワークは、駅が2つ以上そろってから読み込む
  const [railPathFinder, setRailPathFinder] = useState<RailPathFinder | null>(null);
  const [visibleCats, setVisibleCats] = useState<ReadonlySet<RailCategory>>(
    () => new Set(CATEGORY_ORDER),
  );
  const [legendOpen, setLegendOpen] = useState(
    // 画面が狭いときは凡例が地図を覆ってしまうので、たたんだ状態から始める
    () => typeof window === "undefined" || window.innerWidth > 900,
  );

  // --- 地図本体と駅マーカー ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = L.map(container, { zoomSnap: 0.5, zoomControl: false }).setView(
      [36.2, 137.6],
      5.5,
    );
    L.control.zoom({ position: "topright" }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    const railRenderer = L.canvas({ padding: 0.3 });
    const railLayer = L.layerGroup().addTo(map);
    const stationLayer = L.layerGroup().addTo(map);
    const routeLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    railRendererRef.current = railRenderer;
    railLayerRef.current = railLayer;
    routeLayerRef.current = routeLayer;

    const renderStations = () => {
      stationLayer.clearLayers();
      const zoom = map.getZoom();
      const bounds = map.getBounds();
      let picks: Pick[];
      if (zoom >= DETAIL_ZOOM) {
        picks = [];
        for (const s of JP_STATIONS) {
          if (picks.length >= MAX_MARKERS) break;
          if (bounds.contains([s.lat, s.lon])) picks.push(jpPick(s));
        }
      } else {
        picks = MAJOR_PICKS.filter((p) => bounds.contains([p.lat, p.lon]));
      }
      for (const pick of picks) {
        const marker = L.circleMarker([pick.lat, pick.lon], {
          radius: zoom >= DETAIL_ZOOM ? 5 : 6,
          color: "#c02e7b",
          weight: 2,
          fillColor: "#ffffff",
          fillOpacity: 1,
        });
        const el = document.createElement("div");
        el.className = "map-popup";
        const nameEl = document.createElement("strong");
        nameEl.textContent = pick.name;
        const subEl = document.createElement("div");
        subEl.className = "map-popup-sub";
        subEl.textContent = pick.sub;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "map-add-btn";
        btn.textContent = "＋ この駅を追加";
        btn.onclick = () => {
          const station = pick.make();
          if (station) addRef.current(station);
          map.closePopup();
        };
        el.append(nameEl, subEl, btn);
        marker.bindPopup(el, { closeButton: false });
        marker.bindTooltip(pick.name, { direction: "top", offset: [0, -6] });
        marker.addTo(stationLayer);
      }
    };

    map.on("moveend", renderStations);
    renderStations();

    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);

    setMapVersion((v) => v + 1);

    return () => {
      observer.disconnect();
      map.off("moveend", renderStations);
      map.remove();
      mapRef.current = null;
      railRendererRef.current = null;
      railLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, []);

  // --- 線路データの読み込み（地図とは独立） ---
  useEffect(() => {
    let alive = true;
    void import("../data/railways").then((mod) => {
      if (alive) setRailLookup(() => mod.railLinesIn);
    });
    return () => {
      alive = false;
    };
  }, []);

  // --- 線路の描画。地図・データ・表示切替のどれが変わっても描き直す ---
  useEffect(() => {
    const map = mapRef.current;
    const layer = railLayerRef.current;
    const renderer = railRendererRef.current;
    if (!map || !layer || !renderer) return;

    const draw = () => {
      layer.clearLayers();
      if (!railLookup || visibleCats.size === 0) return;
      const b = map.getBounds();
      const lines = railLookup(
        { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() },
        map.getZoom(),
        MAX_RAIL_LINES,
        visibleCats,
      );
      // 路線名のツールチップは拡大時だけ。広域で全線に当たり判定を持たせると重い
      const withTooltip = map.getZoom() >= TOOLTIP_ZOOM;
      for (const line of lines) {
        const style = RAIL_STYLE[line.category];
        const path = L.polyline(line.points, {
          renderer,
          color: style.color,
          weight: style.weight,
          opacity: 0.85,
          interactive: withTooltip,
        }).addTo(layer);
        if (withTooltip && line.name) {
          const sub = line.operator
            ? `<br><span class="rail-tip-sub">${line.operator}</span>`
            : "";
          path.bindTooltip(
            `<span class="rail-tip-swatch" style="background:${style.color}"></span>${line.name}${sub}`,
            { sticky: true, className: "rail-tip" },
          );
        }
      }
    };

    draw();
    map.on("moveend", draw);
    return () => {
      map.off("moveend", draw);
    };
  }, [mapVersion, railLookup, visibleCats]);

  // --- 線路データの出典表示 ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !railLookup) return;
    const credit =
      '線路: <a href="https://nlftp.mlit.go.jp/ksj/" target="_blank" rel="noreferrer">国土数値情報（国土交通省）</a>を加工';
    map.attributionControl.addAttribution(credit);
    return () => {
      map.attributionControl.removeAttribution(credit);
    };
  }, [mapVersion, railLookup]);

  // --- 経路探索用の線路ネットワーク（駅が2つ以上そろってから読む） ---
  useEffect(() => {
    if (stops.length < 2 || railPathFinder) return;
    let alive = true;
    void import("../data/rail-graph").then((mod) => {
      if (alive) setRailPathFinder(() => mod.findRailPath);
    });
    return () => {
      alive = false;
    };
  }, [stops.length, railPathFinder]);

  // --- 選んだ駅の番号ピンと旅程の線（線路に沿わせる） ---
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    const points = stops.filter(
      (s) => s.station.latitude !== undefined && s.station.longitude !== undefined,
    );

    for (let i = 0; i < points.length - 1; i++) {
      const from = {
        lat: points[i].station.latitude!,
        lon: points[i].station.longitude!,
      };
      const to = {
        lat: points[i + 1].station.latitude!,
        lon: points[i + 1].station.longitude!,
      };
      const railPath = railPathFinder?.(from, to) ?? null;
      if (railPath) {
        // 線路をなぞる線。下に白い縁取りを敷いて、線路の色に埋もれないようにする
        L.polyline(railPath, {
          color: "#ffffff",
          weight: 8,
          opacity: 0.75,
          interactive: false,
        }).addTo(layer);
        L.polyline(railPath, {
          color: "#db3b8f",
          weight: 4,
          opacity: 0.95,
          interactive: false,
        }).addTo(layer);
      } else {
        // 線路がたどれないときだけ直線（破線）にする
        L.polyline(
          [
            [from.lat, from.lon],
            [to.lat, to.lon],
          ],
          { color: "#db3b8f", weight: 3, dashArray: "7 9", opacity: 0.8, interactive: false },
        ).addTo(layer);
      }
    }

    points.forEach((stop, i) => {
      const icon = L.divIcon({
        className: "stop-pin",
        html: String(i + 1),
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([stop.station.latitude!, stop.station.longitude!], { icon, zIndexOffset: 500 })
        .bindTooltip(stop.station.name, { direction: "top", offset: [0, -14] })
        .addTo(layer);
    });
  }, [mapVersion, stops, railPathFinder]);

  const toggleCategory = (cat: RailCategory) => {
    setVisibleCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="map-stage">
      <div ref={containerRef} className="map-canvas" />
      <div className={`map-legend${legendOpen ? "" : " closed"}`}>
        <button
          className="legend-toggle"
          onClick={() => setLegendOpen(!legendOpen)}
          aria-expanded={legendOpen}
        >
          🚆 路線の色 {legendOpen ? "▾" : "▸"}
        </button>
        {legendOpen && (
          <div className="legend-body">
            <ul>
              {CATEGORY_ORDER.map((cat) => {
                const on = visibleCats.has(cat);
                return (
                  <li key={cat}>
                    <button
                      type="button"
                      className={`legend-chip${on ? " on" : ""}`}
                      disabled={!railLookup}
                      aria-pressed={on}
                      onClick={() => toggleCategory(cat)}
                      title={on ? `${RAIL_STYLE[cat].label}を隠す` : `${RAIL_STYLE[cat].label}を表示`}
                    >
                      <span
                        className="legend-swatch"
                        style={{
                          background: on ? RAIL_STYLE[cat].color : "transparent",
                          borderColor: RAIL_STYLE[cat].color,
                          height: `${Math.max(3, RAIL_STYLE[cat].weight)}px`,
                        }}
                      />
                      {RAIL_STYLE[cat].label}
                    </button>
                  </li>
                );
              })}
              <li>
                <span className="legend-static">
                  <span className="legend-swatch solid-route" />
                  あなたの旅程
                </span>
              </li>
            </ul>
            <div className="legend-actions">
              <button
                type="button"
                className="legend-link"
                disabled={!railLookup}
                onClick={() => setVisibleCats(new Set(CATEGORY_ORDER))}
              >
                すべて表示
              </button>
              <button
                type="button"
                className="legend-link"
                disabled={!railLookup}
                onClick={() => setVisibleCats(new Set())}
              >
                すべて隠す
              </button>
              <button
                type="button"
                className="legend-link"
                disabled={!railLookup}
                onClick={() => setVisibleCats(new Set(["shinkansen", "jr"] as RailCategory[]))}
              >
                新幹線とJRだけ
              </button>
            </div>
            <p className="legend-note">
              {railLookup
                ? "色をクリックすると、その種別だけ消したり出したりできます。駅の○をタップ →「＋この駅を追加」"
                : "線路を読込中…"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
