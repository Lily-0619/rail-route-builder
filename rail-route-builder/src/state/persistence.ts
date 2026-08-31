import type { StopPlan } from "../types";

export const DRAFT_KEY = "rail-route-builder:draft";
export const PLANS_KEY = "rail-route-builder:plans";

export type SavedPlan = {
  id: string;
  title: string;
  travelDate: string;
  departureTime: string;
  stops: StopPlan[];
  updatedAt: string;
};

type PlanSource = {
  planId: string;
  title: string;
  travelDate: string;
  departureTime: string;
  stops: StopPlan[];
};

export function serializePlan(source: PlanSource): SavedPlan {
  return {
    id: source.planId,
    title: source.title,
    travelDate: source.travelDate,
    departureTime: source.departureTime,
    stops: source.stops.map((s) => ({
      id: s.id,
      station: s.station,
      stayMinutes: s.stayMinutes,
      ...(s.memo !== undefined ? { memo: s.memo } : {}),
    })),
    updatedAt: new Date().toISOString(),
  };
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadPlans(storage: StorageLike): SavedPlan[] {
  try {
    const raw = storage.getItem(PLANS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedPlan[];
  } catch {
    return [];
  }
}

export function savePlans(storage: StorageLike, plans: SavedPlan[]): void {
  try {
    storage.setItem(PLANS_KEY, JSON.stringify(plans));
  } catch {
    // 保存失敗時は黙って続行（プライベートブラウズ等）
  }
}

export function loadDraft(storage: StorageLike): SavedPlan | null {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPlan;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.stops)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(storage: StorageLike, plan: SavedPlan): void {
  try {
    storage.setItem(DRAFT_KEY, JSON.stringify(plan));
  } catch {
    // 保存失敗時は黙って続行
  }
}
