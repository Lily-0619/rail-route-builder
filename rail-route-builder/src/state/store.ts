import { create } from "zustand";
import { buildLegs, runChain } from "../lib/chain";
import { epochToJstIso, toIso } from "../lib/time";
import { mockProvider } from "../providers/mock-provider";
import type { LegPlan, Station, StopPlan } from "../types";
import {
  loadDraft,
  loadPlans,
  saveDraft,
  savePlans,
  serializePlan,
  type SavedPlan,
} from "./persistence";

const provider = mockProvider;
let generation = 0;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function todayJst(): string {
  return epochToJstIso(Date.now()).slice(0, 10);
}

export type PlannerState = {
  planId: string;
  title: string;
  travelDate: string;
  departureTime: string;
  stops: StopPlan[];
  legs: LegPlan[];
  searching: boolean;
  stale: boolean;
  notice: string | null;
  providerName: string;

  setTitle: (title: string) => void;
  setTravelDate: (date: string) => void;
  setDepartureTime: (time: string) => void;
  addStation: (station: Station) => void;
  removeStop: (stopId: string) => void;
  moveStop: (stopId: string, direction: -1 | 1) => void;
  reorderStops: (activeId: string, overId: string) => void;
  setStay: (stopId: string, minutes: number) => void;
  searchAll: (startIndex?: number) => Promise<void>;
  selectCandidate: (legId: string, candidateId: string) => void;
  unlockLeg: (legId: string) => void;
  retryLeg: (legId: string) => void;
  savePlan: () => void;
  loadPlan: (planId: string) => void;
  deletePlan: (planId: string) => void;
  newPlan: () => void;
  listPlans: () => SavedPlan[];
  showNotice: (message: string) => void;
};

const draft = typeof localStorage !== "undefined" ? loadDraft(localStorage) : null;

export const usePlanner = create<PlannerState>((set, get) => {
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  const persistDraft = () => {
    if (typeof localStorage === "undefined") return;
    const s = get();
    saveDraft(localStorage, serializePlan(s));
  };

  const showNotice = (message: string) => {
    set({ notice: message });
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => set({ notice: null }), 2500);
  };

  const applyStops = (stops: StopPlan[]) => {
    generation++;
    set((s) => ({
      stops,
      legs: buildLegs(stops, s.legs),
      stale: true,
      searching: false,
    }));
    persistDraft();
  };

  return {
    planId: draft?.id ?? uid(),
    title: draft?.title ?? "",
    travelDate: draft?.travelDate ?? todayJst(),
    departureTime: draft?.departureTime ?? "08:00",
    stops: draft?.stops ?? [],
    legs: buildLegs(draft?.stops ?? [], []),
    searching: false,
    stale: (draft?.stops.length ?? 0) >= 2,
    notice: null,
    providerName: provider.name,

    showNotice,

    setTitle: (title) => {
      set({ title });
      persistDraft();
    },

    setTravelDate: (travelDate) => {
      generation++;
      set({ travelDate, stale: true, searching: false });
      persistDraft();
    },

    setDepartureTime: (departureTime) => {
      generation++;
      set({ departureTime, stale: true, searching: false });
      persistDraft();
    },

    addStation: (station) => {
      const { stops } = get();
      if (stops.length >= 10) {
        showNotice("駅は最大10件までです");
        return;
      }
      const last = stops[stops.length - 1];
      if (last && last.station.id === station.id) {
        showNotice("同じ駅が連続しています");
        return;
      }
      applyStops([...stops, { id: uid(), station, stayMinutes: 10 }]);
    },

    removeStop: (stopId) => {
      applyStops(get().stops.filter((s) => s.id !== stopId));
    },

    moveStop: (stopId, direction) => {
      const stops = [...get().stops];
      const index = stops.findIndex((s) => s.id === stopId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= stops.length) return;
      [stops[index], stops[target]] = [stops[target], stops[index]];
      applyStops(stops);
    },

    reorderStops: (activeId, overId) => {
      const stops = [...get().stops];
      const from = stops.findIndex((s) => s.id === activeId);
      const to = stops.findIndex((s) => s.id === overId);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = stops.splice(from, 1);
      stops.splice(to, 0, moved);
      applyStops(stops);
    },

    setStay: (stopId, minutes) => {
      const clamped = Math.max(0, Math.min(1440, Math.round(minutes)));
      applyStops(
        get().stops.map((s) => (s.id === stopId ? { ...s, stayMinutes: clamped } : s)),
      );
    },

    searchAll: async (startIndex = 0) => {
      const s0 = get();
      if (s0.stops.length < 2) return;
      const gen = ++generation;
      set({ searching: true, stale: false });
      try {
        await runChain({
          stops: s0.stops,
          legs: get().legs,
          startIso: toIso(s0.travelDate, s0.departureTime),
          provider,
          startIndex,
          isStale: () => gen !== generation,
          onLegUpdate: (leg) => {
            if (gen !== generation) return;
            set((s) => ({ legs: s.legs.map((l) => (l.id === leg.id ? leg : l)) }));
          },
        });
      } finally {
        if (gen === generation) set({ searching: false });
      }
    },

    selectCandidate: (legId, candidateId) => {
      const s = get();
      const index = s.legs.findIndex((l) => l.id === legId);
      if (index < 0) return;
      set({
        legs: s.legs.map((l) =>
          l.id === legId
            ? {
                ...l,
                selectedCandidateId: candidateId,
                isLocked: true,
                status: "ready",
                errorCode: undefined,
              }
            : l,
        ),
      });
      void get().searchAll(index + 1);
    },

    unlockLeg: (legId) => {
      const s = get();
      const index = s.legs.findIndex((l) => l.id === legId);
      if (index < 0) return;
      set({
        legs: s.legs.map((l) => (l.id === legId ? { ...l, isLocked: false } : l)),
      });
      void get().searchAll(index);
    },

    retryLeg: (legId) => {
      const index = get().legs.findIndex((l) => l.id === legId);
      if (index < 0) return;
      void get().searchAll(index);
    },

    savePlan: () => {
      if (typeof localStorage === "undefined") return;
      const s = get();
      if (s.stops.length === 0) {
        showNotice("駅を追加してから保存してください");
        return;
      }
      if (!s.title.trim()) {
        set({ title: `旅程 ${s.travelDate}` });
      }
      const plan = serializePlan(get());
      const plans = loadPlans(localStorage);
      const index = plans.findIndex((p) => p.id === plan.id);
      if (index >= 0) {
        plans[index] = plan;
      } else {
        plans.push(plan);
      }
      savePlans(localStorage, plans);
      showNotice("保存しました 🌸");
    },

    loadPlan: (planId) => {
      if (typeof localStorage === "undefined") return;
      const plan = loadPlans(localStorage).find((p) => p.id === planId);
      if (!plan) return;
      generation++;
      set({
        planId: plan.id,
        title: plan.title,
        travelDate: plan.travelDate,
        departureTime: plan.departureTime,
        stops: plan.stops,
        legs: buildLegs(plan.stops, []),
        stale: plan.stops.length >= 2,
        searching: false,
      });
      persistDraft();
      showNotice("読み込みました。「時刻を検索」で時刻を表示します");
    },

    deletePlan: (planId) => {
      if (typeof localStorage === "undefined") return;
      savePlans(
        localStorage,
        loadPlans(localStorage).filter((p) => p.id !== planId),
      );
      showNotice("削除しました");
    },

    newPlan: () => {
      generation++;
      set({
        planId: uid(),
        title: "",
        travelDate: todayJst(),
        departureTime: "08:00",
        stops: [],
        legs: [],
        stale: false,
        searching: false,
      });
      persistDraft();
    },

    listPlans: () => {
      if (typeof localStorage === "undefined") return [];
      return loadPlans(localStorage).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
  };
});
