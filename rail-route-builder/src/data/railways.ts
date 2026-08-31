// 全国の線路データは重いので、このモジュールは動的importで読み込む（MapPicker参照）。
import raw from "./railways-jp.json";
import { MAJOR_CATEGORIES, RAIL_STYLE, type RailCategory } from "./railway-style";

export type RailLine = {
  category: RailCategory;
  name: string;
  operator: string;
  points: [number, number][];
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
};

type Row = [string, string, string, [number, number][]];

export const RAIL_LINES: RailLine[] = (raw as Row[]).map(
  ([category, name, operator, points]) => {
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;
    for (const [lat, lon] of points) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    return {
      category: (category in RAIL_STYLE ? category : "private") as RailCategory,
      name,
      operator,
      points,
      minLat,
      maxLat,
      minLon,
      maxLon,
    };
  },
);

/**
 * 表示範囲にかかる線路を返す。
 * `visible` に入っている種別だけを描く（利用者が凡例で切り替える）。
 * 縮小時は主要路線（新幹線・JR）だけにして、地図が線で埋まらないようにする。
 */
export function railLinesIn(
  bounds: { south: number; west: number; north: number; east: number },
  zoom: number,
  limit: number,
  visible?: ReadonlySet<RailCategory>,
): RailLine[] {
  const majorOnly = zoom < 8;
  const found: RailLine[] = [];
  for (const line of RAIL_LINES) {
    if (found.length >= limit) break;
    if (visible && !visible.has(line.category)) continue;
    if (majorOnly && !MAJOR_CATEGORIES.has(line.category)) continue;
    if (
      line.maxLat < bounds.south ||
      line.minLat > bounds.north ||
      line.maxLon < bounds.west ||
      line.minLon > bounds.east
    ) {
      continue;
    }
    found.push(line);
  }
  return found;
}
