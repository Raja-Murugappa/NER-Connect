// src/services/connectivityApi.ts
// Thin client for GET /api/districts (external_repo/app.py) - the real district list. The
// route-accessibility check itself is a simulation (see simulateDistrictConnectivity below),
// generated instantly and differently each time, not real OSRM work.

export interface DistrictInfo {
  state: string;
  district: string;
  latitude: number;
  longitude: number;
}

export type ConnectivityLevel = 'isolated' | 'critical' | 'limited' | 'good';

export interface DistrictConnectivityCheck {
  totalRoutes: number;
  availableRoutes: number;
  level: ConnectivityLevel;
  label: string;
}

const BACKEND_DOWN = 'Routing backend is unreachable. Start it with: python external_repo/app.py';

export async function fetchDistricts(): Promise<DistrictInfo[]> {
  let response: Response;
  try {
    response = await fetch('/api/districts');
  } catch {
    throw new Error(BACKEND_DOWN);
  }
  const data = await response.json().catch(() => null);
  if (!data) throw new Error(BACKEND_DOWN);
  if (!response.ok || data.status !== 'SUCCESS') {
    throw new Error(data.message || `Could not load districts (HTTP ${response.status})`);
  }
  return data.districts as DistrictInfo[];
}

const randomInt = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/**
 * Simulated, not measured: a district's total road count and how many of those are
 * "currently available" both change on every check, standing in for a live feed this
 * project doesn't have. Never presented as real routing data - see the Connectivity page.
 */
export function simulateDistrictConnectivity(): DistrictConnectivityCheck {
  const totalRoutes = randomInt(1, 4);
  const availableRoutes = randomInt(0, totalRoutes);

  const level: ConnectivityLevel =
    availableRoutes === 0 ? 'isolated' : availableRoutes === 1 ? 'critical' : availableRoutes === 2 ? 'limited' : 'good';
  const label = {
    isolated: 'Isolated — no route currently available',
    critical: 'Critical — only one route available',
    limited: 'Limited — one backup route',
    good: 'Well connected',
  }[level];

  return { totalRoutes, availableRoutes, level, label };
}
