// src/services/corridorApi.ts
// Thin client for the Python routing backend (external_repo/app.py).
// Geocoding, OSRM routing, segmentation, risk scoring and rerouting all live in the backend.

export interface Location {
  name: string;
  display_name?: string;
  lat: number;
  lon: number;
}

export interface RouteLandmark {
  name: string;
  coords: [number, number];
}

export interface Milestone {
  km_marker: string;
  type: string;
  name: string;
  action: string;
}

/**
 * Why a sector was cut where it is, and where that point sits. Null on a sector's `boundary`
 * means it simply ends at the destination (no cut to explain).
 */
export interface SectorBoundary {
  /** "Checkpost" | "Junction" | "Bridge" | "Distance cut" */
  type: string;
  /** Landmark name, when the cut landed on a named one. */
  name: string | null;
  reason: string;
  coords: [number, number];
}

export interface SectorCard {
  segment_id: string;
  road_name: string;
  /** "Highway" or "Mountain climb" */
  segment_type: string;
  /** Where and why this sector ends; null for the last sector (ends at the destination). */
  boundary: SectorBoundary | null;
  distance: string;
  distance_km: number;
  eta: string;
  eta_mins: number;
  elevation: string;
  elevation_start_m: number;
  elevation_end_m: number;
  /** False when the elevation service could not be reached (values are placeholders). */
  elevation_known: boolean;
  slope_percent: number;
  upstream_feed: string;
  local_soil: string;
  landslide_risk: string;
  landslide_pct: number;
  flood_risk: string;
  flood_pct: number;
  network: string;
  network_level: 'good' | 'weak' | 'none';
  road_condition: string;
  risk_level: 'safe' | 'caution' | 'danger';
  confidence: string;
  status: string;
  polyline: [number, number][];
  embedded_milestones: Milestone[];
}

export interface RiskSummary {
  worst: SectorCard['risk_level'];
  sector_counts: Record<SectorCard['risk_level'], number>;
  km_by_level: Record<SectorCard['risk_level'], number>;
}

export interface CorridorEvaluation {
  corridor: string;
  origin: Location;
  destination: Location;
  routing_status: 'SUCCESS' | 'FALLBACK';
  routing_warning: string | null;
  routing_source: string;
  total_distance_km: number;
  total_journey_eta: string;
  total_journey_mins: number;
  risk: RiskSummary;
  full_polyline: [number, number][];
  junctions: RouteLandmark[];
  bridges: RouteLandmark[];
  sectors: SectorCard[];
}

/** A scored alternative road route between the same places (POST /api/route-options). */
export interface AlternativeRoute {
  polyline: [number, number][];
  distance_km: number;
  eta: string;
  eta_mins: number;
  risk: RiskSummary;
  sectors: SectorCard[];
  junctions: RouteLandmark[];
  bridges: RouteLandmark[];
}

export interface RouteOptionsResult {
  alternatives: AlternativeRoute[];
  /** False when the routing service could not be asked (see message). */
  searched: boolean;
  message?: string;
}

export interface CorridorRequest {
  road_name: string;
  /** A place name to geocode, or already-resolved coordinates. */
  origin: string | Location;
  destination: string | Location;
  scenario: '1' | '2';
}

// ─── Dynamic rerouting (POST /api/reroute) ────────────────────────────────────

export type DisruptionType = 'landslide' | 'flood' | 'bridge_closure' | 'road_block';
export type DisruptionSeverity = 'caution' | 'blocked';
/**
 * Simulation control for a blocking disruption:
 * - auto: real detour check at the reported spot
 * - force_reroute: if the spot has no real detour, the backend moves the disruption to the
 *   nearest spot ahead that has one (detours are always real roads)
 * - force_hold: simulates "every detour is closed too" (no search)
 */
export type SimulatedOutcome = 'auto' | 'force_reroute' | 'force_hold';

export interface Disruption {
  lat: number;
  lon: number;
  radius_km: number;
  type: DisruptionType;
  severity: DisruptionSeverity;
}

export type RerouteStatus =
  | 'NOT_ON_ROUTE'
  | 'BEHIND'
  | 'ADVISORY'
  | 'REROUTE_AVAILABLE'
  | 'NO_ALTERNATIVE'
  | 'ROUTING_UNAVAILABLE';

export interface RouteAlternative {
  id: string;
  recommended: boolean;
  polyline: [number, number][];
  distance_km: number;
  extra_km: number;
  eta: string;
  eta_mins: number;
  extra_mins: number;
  worst_risk: SectorCard['risk_level'];
  risk: RiskSummary;
  sectors: SectorCard[];
  junctions: RouteLandmark[];
  bridges: RouteLandmark[];
  divergence_point: [number, number];
  /** Where the bypass leaves and rejoins the current route (route km). */
  bypass: { exit_km: number; rejoin_km: number };
}

export interface HoldPoint {
  name: string;
  type: 'checkpost' | 'roadside';
  coords: [number, number];
  km: number;
}

export interface RerouteResult {
  status: RerouteStatus;
  message: string;
  truck_km: number;
  route_total_km: number;
  disruption: Disruption & { label: string };
  disruption_km?: number;
  distance_ahead_km?: number;
  affected_polyline: [number, number][];
  current_remaining?: { distance_km: number; eta: string; eta_mins: number };
  hold_point?: HoldPoint;
  alternatives: RouteAlternative[];
  outcome: SimulatedOutcome;
  /** True when the result is a scripted simulation (force_hold) rather than a real search. */
  simulated?: boolean;
  /** Set when force_reroute moved the disruption to a spot with a real detour. */
  relocated_from?: { lat: number; lon: number; km: number };
  search?: { requests: number; failed: number; routes_checked: number; rejected: number };
}

export interface RerouteRequest {
  /** The active route; its last point is the destination. */
  current_route: [number, number][];
  truck_position: [number, number];
  disruption: Disruption;
  road_name: string;
  scenario: '1' | '2';
  outcome: SimulatedOutcome;
}

const BACKEND_DOWN = 'Routing backend is unreachable. Start it with: python external_repo/app.py';

async function postJson(path: string, body: unknown): Promise<{ response: Response; data: any }> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(BACKEND_DOWN);
  }
  const data = await response.json().catch(() => null);
  if (!data) throw new Error(BACKEND_DOWN);
  return { response, data };
}

export async function evaluateReroute(req: RerouteRequest): Promise<RerouteResult> {
  const { response, data } = await postJson('/api/reroute', req);
  if (!response.ok || data.status === 'ERROR') {
    throw new Error(data.message || `Reroute evaluation failed (HTTP ${response.status})`);
  }
  return data as RerouteResult;
}

export async function evaluateCorridor(req: CorridorRequest): Promise<CorridorEvaluation> {
  const { response, data } = await postJson('/api/evaluate', req);
  if (!response.ok || data.status !== 'SUCCESS') {
    throw new Error(data.message || `Route evaluation failed (HTTP ${response.status})`);
  }
  return data as CorridorEvaluation;
}

export async function fetchRouteOptions(req: CorridorRequest): Promise<RouteOptionsResult> {
  const { response, data } = await postJson('/api/route-options', req);
  if (!response.ok || data.status !== 'SUCCESS') {
    throw new Error(data.message || `Could not check for other routes (HTTP ${response.status})`);
  }
  return data as RouteOptionsResult;
}
