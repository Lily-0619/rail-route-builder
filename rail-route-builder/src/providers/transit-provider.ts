import type { RouteCandidate, RoutePreferences, Station } from "../types";

export interface TransitProvider {
  readonly name: string;
  readonly capabilities: {
    stationSearch: boolean;
    routeSchedules: boolean;
    fullStationTimetable: boolean;
    multiViaSearch: boolean;
  };

  searchStations(query: string, sessionToken?: string): Promise<Station[]>;
  searchRoutes(input: {
    from: Station;
    to: Station;
    departureAt: string;
    preferences: RoutePreferences;
  }): Promise<RouteCandidate[]>;
}

export const DEFAULT_PREFERENCES: RoutePreferences = {
  fewerTransfers: false,
  lessWalking: false,
  railOnly: true,
};
