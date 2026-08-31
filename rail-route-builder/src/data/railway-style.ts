export type RailCategory =
  | "shinkansen"
  | "jr"
  | "private"
  | "public"
  | "thirdsector"
  | "monorail"
  | "tram";

export const RAIL_STYLE: Record<
  RailCategory,
  { label: string; color: string; weight: number }
> = {
  shinkansen: { label: "新幹線", color: "#0b4f9e", weight: 3.6 },
  jr: { label: "JR在来線", color: "#1b7f4f", weight: 2.4 },
  private: { label: "私鉄", color: "#d95f02", weight: 2.2 },
  public: { label: "地下鉄・公営", color: "#6a3d9a", weight: 2.2 },
  thirdsector: { label: "第三セクター", color: "#4a6b8a", weight: 2 },
  monorail: { label: "モノレール・新交通", color: "#00838f", weight: 2 },
  tram: { label: "路面電車・ケーブル", color: "#8d6e63", weight: 1.8 },
};

export const CATEGORY_ORDER: RailCategory[] = [
  "shinkansen",
  "jr",
  "private",
  "public",
  "thirdsector",
  "monorail",
  "tram",
];

/** 縮小表示のときに描く種別。全部描くと地図が線で埋まって読めなくなる。 */
export const MAJOR_CATEGORIES = new Set<RailCategory>(["shinkansen", "jr"]);
