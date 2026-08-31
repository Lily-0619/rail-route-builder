import type { LegPlan, StopPlan } from "../types";
import { getSelectedCandidate } from "./chain";
import { minutesBetween } from "./time";

export type PlanTotals = {
  complete: boolean;
  departureAt?: string;
  arrivalAt?: string;
  totalMinutes?: number;
  moveMinutes: number;
  stayMinutes: number;
  transferCount: number;
  fareKnownYen: number;
  fareMissing: boolean;
  anyFareKnown: boolean;
};

export function computeTotals(stops: StopPlan[], legs: LegPlan[]): PlanTotals {
  const selections = legs.map(getSelectedCandidate);
  const complete = legs.length > 0 && selections.every((c) => c !== undefined);

  let moveMinutes = 0;
  let transferCount = 0;
  let fareKnownYen = 0;
  let fareMissing = false;
  let anyFareKnown = false;

  for (const cand of selections) {
    if (!cand) {
      fareMissing = true;
      continue;
    }
    moveMinutes += cand.durationMinutes;
    transferCount += cand.transferCount;
    if (cand.fareYen === null) {
      fareMissing = true;
    } else {
      fareKnownYen += cand.fareYen;
      anyFareKnown = true;
    }
  }

  let stayMinutes = 0;
  for (let i = 1; i < stops.length - 1; i++) {
    stayMinutes += stops[i].stayMinutes;
  }

  const first = selections[0];
  const last = selections[selections.length - 1];
  const departureAt = first?.departureAt;
  const arrivalAt = complete ? last?.arrivalAt : undefined;
  const totalMinutes =
    departureAt && arrivalAt ? minutesBetween(departureAt, arrivalAt) : undefined;

  return {
    complete,
    departureAt,
    arrivalAt,
    totalMinutes,
    moveMinutes,
    stayMinutes,
    transferCount,
    fareKnownYen,
    fareMissing,
    anyFareKnown,
  };
}
