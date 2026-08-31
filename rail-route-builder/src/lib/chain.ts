import type { LegPlan, RouteCandidate, StopPlan } from "../types";
import type { TransitProvider } from "../providers/transit-provider";
import { DEFAULT_PREFERENCES } from "../providers/transit-provider";
import { addMinutesIso } from "./time";

export function buildLegs(stops: StopPlan[], prevLegs: LegPlan[]): LegPlan[] {
  const legs: LegPlan[] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    const from = stops[i];
    const to = stops[i + 1];
    const id = `leg_${from.id}_${to.id}`;
    const old = prevLegs.find((l) => l.id === id);
    legs.push(
      old ?? {
        id,
        fromStopId: from.id,
        toStopId: to.id,
        status: "idle",
        candidates: [],
        isLocked: false,
      },
    );
  }
  return legs;
}

export function getSelectedCandidate(leg: LegPlan): RouteCandidate | undefined {
  return leg.candidates.find((c) => c.id === leg.selectedCandidateId);
}

export type RunChainOptions = {
  stops: StopPlan[];
  legs: LegPlan[];
  startIso: string;
  provider: TransitProvider;
  startIndex?: number;
  isStale?: () => boolean;
  onLegUpdate?: (leg: LegPlan) => void;
};

export async function runChain(options: RunChainOptions): Promise<LegPlan[]> {
  const { stops, startIso, provider, isStale, onLegUpdate } = options;
  const legs = options.legs.map((l) => ({ ...l }));
  let startIndex = Math.max(0, Math.min(options.startIndex ?? 0, legs.length));

  let readyAt = startIso;
  for (let i = 0; i < startIndex; i++) {
    const cand = getSelectedCandidate(legs[i]);
    if (!cand) {
      startIndex = i;
      break;
    }
    readyAt = addMinutesIso(cand.arrivalAt, stops[i + 1].stayMinutes);
  }

  const emit = (leg: LegPlan) => {
    if (onLegUpdate && !(isStale && isStale())) onLegUpdate(leg);
  };

  const blockRest = (fromIndex: number) => {
    for (let j = fromIndex; j < legs.length; j++) {
      const leg = legs[j];
      if (leg.isLocked && getSelectedCandidate(leg)) {
        legs[j] = { ...leg, status: "idle", errorCode: undefined };
      } else {
        legs[j] = {
          ...leg,
          status: "idle",
          candidates: [],
          selectedCandidateId: undefined,
          errorCode: undefined,
        };
      }
      emit(legs[j]);
    }
  };

  for (let i = startIndex; i < legs.length; i++) {
    if (isStale && isStale()) return legs;
    const leg = legs[i];
    const fromStop = stops[i];
    const toStop = stops[i + 1];
    const locked = leg.isLocked ? getSelectedCandidate(leg) : undefined;

    if (locked) {
      const misses = new Date(locked.departureAt).getTime() < new Date(readyAt).getTime();
      legs[i] = {
        ...leg,
        status: misses ? "conflict" : "ready",
        errorCode: misses ? "MISSED_CONNECTION" : undefined,
      };
      emit(legs[i]);
      readyAt = addMinutesIso(locked.arrivalAt, toStop.stayMinutes);
      continue;
    }

    legs[i] = { ...leg, status: "loading", errorCode: undefined };
    emit(legs[i]);

    let candidates: RouteCandidate[];
    try {
      candidates = await provider.searchRoutes({
        from: fromStop.station,
        to: toStop.station,
        departureAt: readyAt,
        preferences: DEFAULT_PREFERENCES,
      });
    } catch {
      if (isStale && isStale()) return legs;
      legs[i] = { ...leg, status: "error", errorCode: "PROVIDER_ERROR" };
      emit(legs[i]);
      blockRest(i + 1);
      return legs;
    }

    if (isStale && isStale()) return legs;

    if (candidates.length === 0) {
      legs[i] = {
        ...leg,
        status: "error",
        errorCode: "NO_ROUTE",
        candidates: [],
        selectedCandidateId: undefined,
      };
      emit(legs[i]);
      blockRest(i + 1);
      return legs;
    }

    const pick =
      candidates.find((c) => new Date(c.departureAt).getTime() >= new Date(readyAt).getTime()) ??
      candidates[0];
    legs[i] = {
      ...leg,
      status: "ready",
      errorCode: undefined,
      candidates,
      selectedCandidateId: pick.id,
      isLocked: false,
    };
    emit(legs[i]);
    readyAt = addMinutesIso(pick.arrivalAt, toStop.stayMinutes);
  }

  return legs;
}
