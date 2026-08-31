import { describe, expect, it } from "vitest";
import { buildLegs, getSelectedCandidate, runChain } from "../src/lib/chain";
import { addMinutesIso, dayOffset, jstDate } from "../src/lib/time";
import { computeTotals } from "../src/lib/totals";
import { serializePlan } from "../src/state/persistence";
import type { TransitProvider } from "../src/providers/transit-provider";
import type { LegPlan, RouteCandidate, Station, StopPlan } from "../src/types";

function station(id: string): Station {
  return { id, name: id, providerRef: id };
}

function stop(id: string, stationId: string, stayMinutes = 10): StopPlan {
  return { id, station: station(stationId), stayMinutes };
}

function candidate(id: string, departureAt: string, arrivalAt: string, fareYen: number | null = 1000): RouteCandidate {
  return {
    id,
    departureAt,
    arrivalAt,
    durationMinutes: Math.round(
      (new Date(arrivalAt).getTime() - new Date(departureAt).getTime()) / 60_000,
    ),
    transferCount: 0,
    fareYen,
    segments: [],
    source: "mock",
    fetchedAt: "2026-08-27T00:00:00Z",
  };
}

type Call = { from: string; to: string; departureAt: string };

function makeProvider(calls: Call[], waitMinutes = 5, rideMinutes = 60): TransitProvider {
  return {
    name: "fake",
    capabilities: {
      stationSearch: true,
      routeSchedules: true,
      fullStationTimetable: false,
      multiViaSearch: false,
    },
    async searchStations() {
      return [];
    },
    async searchRoutes({ from, to, departureAt }) {
      calls.push({ from: from.id, to: to.id, departureAt });
      const dep = addMinutesIso(departureAt, waitMinutes);
      const arr = addMinutesIso(dep, rideMinutes);
      return [candidate(`${from.id}_${to.id}_${dep}`, dep, arr)];
    },
  };
}

describe("buildLegs", () => {
  it("3駅から2区間を生成する", () => {
    const stops = [stop("s1", "名古屋"), stop("s2", "大阪難波"), stop("s3", "吉野")];
    const legs = buildLegs(stops, []);
    expect(legs).toHaveLength(2);
    expect(legs[0].fromStopId).toBe("s1");
    expect(legs[0].toStopId).toBe("s2");
    expect(legs[1].fromStopId).toBe("s2");
    expect(legs[1].toStopId).toBe("s3");
  });

  it("駅順変更後も同じ区間の状態を引き継ぐ", () => {
    const stops = [stop("s1", "A"), stop("s2", "B"), stop("s3", "C")];
    const legs = buildLegs(stops, []);
    const locked: LegPlan = { ...legs[0], isLocked: true };
    const reordered = [stops[2], stops[0], stops[1]];
    const rebuilt = buildLegs(reordered, [locked, legs[1]]);
    expect(rebuilt).toHaveLength(2);
    expect(rebuilt[0].id).toBe("leg_s3_s1");
    expect(rebuilt[0].isLocked).toBe(false);
    expect(rebuilt[1].id).toBe("leg_s1_s2");
    expect(rebuilt[1].isLocked).toBe(true);
  });
});

describe("runChain", () => {
  it("到着時刻＋滞在時間が次区間の検索開始時刻になる", async () => {
    const calls: Call[] = [];
    const stops = [stop("s1", "A"), stop("s2", "B", 90), stop("s3", "C")];
    await runChain({
      stops,
      legs: buildLegs(stops, []),
      startIso: "2026-09-01T08:00:00+09:00",
      provider: makeProvider(calls),
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].departureAt).toBe("2026-09-01T08:00:00+09:00");
    // 1区間目: 08:05発 → 09:05着、滞在90分 → 10:35から検索
    expect(calls[1].departureAt).toBe("2026-09-01T10:35:00+09:00");
  });

  it("固定した便に間に合わない場合はconflictになり、勝手に変更しない", async () => {
    const calls: Call[] = [];
    const stops = [stop("s1", "A"), stop("s2", "B")];
    const legs = buildLegs(stops, []);
    const early = candidate("early", "2026-09-01T08:10:00+09:00", "2026-09-01T09:00:00+09:00");
    legs[0] = { ...legs[0], candidates: [early], selectedCandidateId: "early", isLocked: true };
    const result = await runChain({
      stops,
      legs,
      startIso: "2026-09-01T09:00:00+09:00",
      provider: makeProvider(calls),
    });
    expect(result[0].status).toBe("conflict");
    expect(result[0].errorCode).toBe("MISSED_CONNECTION");
    expect(result[0].selectedCandidateId).toBe("early");
    expect(calls).toHaveLength(0);
  });

  it("固定していない区間だけ再検索する", async () => {
    const calls: Call[] = [];
    const stops = [stop("s1", "A"), stop("s2", "B"), stop("s3", "C"), stop("s4", "D")];
    const legs = buildLegs(stops, []);
    const lockedCand = candidate("lock", "2026-09-01T10:00:00+09:00", "2026-09-01T11:00:00+09:00");
    legs[1] = { ...legs[1], candidates: [lockedCand], selectedCandidateId: "lock", isLocked: true };
    const result = await runChain({
      stops,
      legs,
      startIso: "2026-09-01T08:00:00+09:00",
      provider: makeProvider(calls),
    });
    expect(calls.map((c) => `${c.from}→${c.to}`)).toEqual(["A→B", "C→D"]);
    expect(result[1].selectedCandidateId).toBe("lock");
    expect(result[1].status).toBe("ready");
  });

  it("深夜0時をまたぐと日付が進む", async () => {
    const calls: Call[] = [];
    const stops = [stop("s1", "A"), stop("s2", "B", 40), stop("s3", "C")];
    await runChain({
      stops,
      legs: buildLegs(stops, []),
      startIso: "2026-09-01T23:05:00+09:00",
      provider: makeProvider(calls, 5, 40),
    });
    // 1区間目: 23:10発 → 23:50着、滞在40分 → 翌0:30から検索
    expect(calls[1].departureAt).toBe("2026-09-02T00:30:00+09:00");
    expect(jstDate(calls[1].departureAt)).toBe("2026-09-02");
    expect(dayOffset(calls[1].departureAt, "2026-09-01")).toBe(1);
  });

  it("経路なしのとき後続区間を未検索に戻す", async () => {
    const stops = [stop("s1", "A"), stop("s2", "B"), stop("s3", "C")];
    const provider: TransitProvider = {
      ...makeProvider([]),
      async searchRoutes() {
        return [];
      },
    };
    const result = await runChain({
      stops,
      legs: buildLegs(stops, []),
      startIso: "2026-09-01T08:00:00+09:00",
      provider,
    });
    expect(result[0].status).toBe("error");
    expect(result[0].errorCode).toBe("NO_ROUTE");
    expect(result[1].status).toBe("idle");
    expect(getSelectedCandidate(result[1])).toBeUndefined();
  });
});

describe("computeTotals", () => {
  it("運賃が一部nullなら合計を確定額にしない", () => {
    const stops = [stop("s1", "A"), stop("s2", "B", 30), stop("s3", "C")];
    const legs = buildLegs(stops, []);
    const c1 = candidate("c1", "2026-09-01T08:00:00+09:00", "2026-09-01T09:00:00+09:00", 1500);
    const c2 = candidate("c2", "2026-09-01T09:30:00+09:00", "2026-09-01T10:30:00+09:00", null);
    legs[0] = { ...legs[0], candidates: [c1], selectedCandidateId: "c1", status: "ready" };
    legs[1] = { ...legs[1], candidates: [c2], selectedCandidateId: "c2", status: "ready" };
    const totals = computeTotals(stops, legs);
    expect(totals.complete).toBe(true);
    expect(totals.fareMissing).toBe(true);
    expect(totals.fareKnownYen).toBe(1500);
    expect(totals.stayMinutes).toBe(30);
    expect(totals.totalMinutes).toBe(150);
  });
});

describe("serializePlan", () => {
  it("保存対象に検索結果（区間・候補）を含めない", () => {
    const stops = [stop("s1", "A"), stop("s2", "B")];
    const source = {
      planId: "p1",
      title: "テスト旅程",
      travelDate: "2026-09-01",
      departureTime: "08:00",
      stops,
      legs: buildLegs(stops, []),
      searching: true,
    };
    const saved = serializePlan(source);
    expect(saved).not.toHaveProperty("legs");
    expect(saved).not.toHaveProperty("searching");
    expect(saved.stops).toHaveLength(2);
    expect(saved.stops[0].station.name).toBe("A");
    expect(JSON.stringify(saved)).not.toContain("candidates");
  });
});
