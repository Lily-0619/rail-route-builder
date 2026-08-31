export type Station = {
  id: string;
  name: string;
  secondaryText?: string;
  latitude?: number;
  longitude?: number;
  providerRef: string;
};

export type StopPlan = {
  id: string;
  station: Station;
  stayMinutes: number;
  memo?: string;
};

export type LegStatus = "idle" | "loading" | "ready" | "conflict" | "error";
export type LegErrorCode = "NO_ROUTE" | "MISSED_CONNECTION" | "PROVIDER_ERROR";

export type TransitSegment = {
  mode: "WALK" | "RAIL" | "SUBWAY" | "BUS" | "OTHER";
  lineName?: string;
  trainName?: string;
  headsign?: string;
  fromName: string;
  toName: string;
  departureAt: string;
  arrivalAt: string;
  stopCount?: number;
  color?: string;
};

export type RouteCandidate = {
  id: string;
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  transferCount: number;
  fareYen: number | null;
  segments: TransitSegment[];
  source: "mock" | "google" | "ekispert" | "odpt";
  fetchedAt: string;
};

export type LegPlan = {
  id: string;
  fromStopId: string;
  toStopId: string;
  status: LegStatus;
  candidates: RouteCandidate[];
  selectedCandidateId?: string;
  isLocked: boolean;
  errorCode?: LegErrorCode;
};

export type RoutePreferences = {
  fewerTransfers: boolean;
  lessWalking: boolean;
  railOnly: boolean;
};
