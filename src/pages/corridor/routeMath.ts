// src/pages/corridor/routeMath.ts
// Distance helpers for showing the truck's progress along a route (display only;
// all routing decisions are made by the Python backend).

const EARTH_RADIUS_KM = 6371;

function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Kilometres travelled from the first point to each point of the polyline. */
export function cumulativeKm(polyline: [number, number][]): number[] {
  const out = new Array<number>(polyline.length).fill(0);
  for (let i = 1; i < polyline.length; i++) {
    out[i] = out[i - 1] + haversineKm(polyline[i - 1], polyline[i]);
  }
  return out;
}

/** A round interval (10/20/25/50/100... km) giving roughly `target` markers along `totalKm`. */
function markerStepKm(totalKm: number, target: number): number {
  const steps = [5, 10, 20, 25, 50, 100, 200, 250];
  const raw = totalKm / target;
  return steps.find((s) => s >= raw) ?? steps[steps.length - 1];
}

/** Points spaced every `markerStepKm(...)` along the route, for "X km" markers on the map. */
export function distanceMarkers(
  polyline: [number, number][],
  targetCount = 6
): { km: number; point: [number, number] }[] {
  if (polyline.length < 2) return [];
  const cum = cumulativeKm(polyline);
  const total = cum[cum.length - 1];
  const step = markerStepKm(total, targetCount);
  const marks: { km: number; point: [number, number] }[] = [];
  let idx = 0;
  for (let km = step; km < total - step / 2; km += step) {
    while (idx < cum.length - 1 && cum[idx] < km) idx++;
    marks.push({ km: Math.round(km), point: polyline[idx] });
  }
  return marks;
}
