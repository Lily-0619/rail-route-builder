import type { Station } from "../types";
import raw from "./stations-jp.json";

export type MapStation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  kana: string;
  operator: string;
};

type Row = [string, number, number, string, string];

export const JP_STATIONS: MapStation[] = (raw as Row[]).map(
  ([name, lat, lon, kana, operator], index) => ({
    id: `osm_${index}`,
    name,
    lat,
    lon,
    kana,
    operator,
  }),
);

const byId = new Map(JP_STATIONS.map((s) => [s.id, s]));

export function getJpStation(id: string): MapStation | undefined {
  return byId.get(id);
}

export function jpToStation(s: MapStation): Station {
  return {
    id: s.id,
    name: s.name,
    secondaryText: s.operator || "地図から選択",
    latitude: s.lat,
    longitude: s.lon,
    providerRef: s.id,
  };
}
