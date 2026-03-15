/**
 * OSRM-based routing for Jamaica road paths.
 * Uses router.project-osrm.org (OpenStreetMap data).
 */

const OSRM_BASE = 'https://router.project-osrm.org';

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  coordinates: [number, number][];
}

export interface OSRMRouteResponse {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry?: { coordinates: [number, number][] };
  }>;
}

export async function fetchRoute(
  from: [number, number],
  to: [number, number],
  alternatives = false
): Promise<RouteResult | null> {
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson${alternatives ? '&alternatives=true' : ''}`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as OSRMRouteResponse;
  const route = data.routes?.[0];
  if (!route) return null;

  const coordsList = route.geometry?.coordinates?.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [];
  return {
    distanceKm: route.distance / 1000,
    durationMinutes: Math.round(route.duration / 60),
    coordinates: coordsList,
  };
}

export async function fetchRouteAlternatives(from: [number, number], to: [number, number]): Promise<RouteResult[]> {
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=true`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as OSRMRouteResponse;
  const routes = data.routes ?? [];

  return routes.map((r) => {
    const coordsList = r.geometry?.coordinates?.map(([lng, lat]) => [lat, lng] as [number, number]) ?? [];
    return {
      distanceKm: r.distance / 1000,
      durationMinutes: Math.round(r.duration / 60),
      coordinates: coordsList,
    };
  });
}

/** Hub type for logistics points */
export interface LogisticsHub {
  id: string;
  name: string;
  coords: [number, number];
  isMajorHub?: boolean;
  parish?: string;
}

/** 31 parish logistics hubs for ReliefLink.JA */
export const LOGISTICS_HUBS: LogisticsHub[] = [
  { id: 'kct', name: 'Kingston (KCT)', coords: [17.965, -76.804], isMajorHub: true, parish: 'Kingston' },
  { id: 'mobay', name: 'Montego Bay (Logistics Hub)', coords: [18.466, -77.917], isMajorHub: true, parish: 'St. James' },
  { id: 'mandeville', name: 'Mandeville (Regional Center)', coords: [18.033, -77.507], isMajorHub: true, parish: 'Manchester' },
  { id: 'standrew1', name: 'St. Andrew', coords: [18.04, -76.8], parish: 'St. Andrew' },
  { id: 'standrew2', name: 'St. Andrew', coords: [18.08, -76.75], parish: 'St. Andrew' },
  { id: 'stcatherine1', name: 'Spanish Town (St. Catherine)', coords: [17.996, -76.955], parish: 'St. Catherine' },
  { id: 'stcatherine2', name: 'Old Harbour (St. Catherine)', coords: [17.94, -77.1], parish: 'St. Catherine' },
  { id: 'clarendon1', name: 'May Pen (Clarendon)', coords: [17.964, -77.243], parish: 'Clarendon' },
  { id: 'clarendon2', name: 'Hayes (Clarendon)', coords: [17.88, -77.23], parish: 'Clarendon' },
  { id: 'manchester1', name: 'Porus (Manchester)', coords: [18.03, -77.41], parish: 'Manchester' },
  { id: 'manchester2', name: 'Christiana (Manchester)', coords: [18.17, -77.48], parish: 'Manchester' },
  { id: 'stelizabeth1', name: 'Black River (St. Elizabeth)', coords: [18.021, -77.851], parish: 'St. Elizabeth' },
  { id: 'stelizabeth2', name: 'Santa Cruz (St. Elizabeth)', coords: [18.05, -77.7], parish: 'St. Elizabeth' },
  { id: 'westmoreland1', name: 'Sav-la-Mar (Westmoreland)', coords: [18.218, -78.127], parish: 'Westmoreland' },
  { id: 'westmoreland2', name: 'Grange Hill (Westmoreland)', coords: [18.37, -78.2], parish: 'Westmoreland' },
  { id: 'hanover1', name: 'Lucea (Hanover)', coords: [18.451, -78.173], parish: 'Hanover' },
  { id: 'hanover2', name: 'Hopewell (Hanover)', coords: [18.47, -78.03], parish: 'Hanover' },
  { id: 'stjames1', name: 'Rose Hall (St. James)', coords: [18.51, -77.8], parish: 'St. James' },
  { id: 'stjames2', name: 'Cambridge (St. James)', coords: [18.29, -77.89], parish: 'St. James' },
  { id: 'trelawny1', name: 'Falmouth (Trelawny)', coords: [18.493, -77.656], parish: 'Trelawny' },
  { id: 'trelawny2', name: 'Duncans (Trelawny)', coords: [18.46, -77.53], parish: 'Trelawny' },
  { id: 'stann1', name: "St. Ann's Bay (St. Ann)", coords: [18.435, -77.202], parish: 'St. Ann' },
  { id: 'stann2', name: 'Browns Town (St. Ann)', coords: [18.4, -77.36], parish: 'St. Ann' },
  { id: 'stmary1', name: 'Port Maria (St. Mary)', coords: [18.374, -76.889], parish: 'St. Mary' },
  { id: 'stmary2', name: 'Annotto Bay (St. Mary)', coords: [18.27, -76.77], parish: 'St. Mary' },
  { id: 'portland1', name: 'Port Antonio (Portland)', coords: [18.176, -76.45], parish: 'Portland' },
  { id: 'portland2', name: 'Buff Bay (Portland)', coords: [18.23, -76.66], parish: 'Portland' },
  { id: 'stthomas1', name: 'Morant Bay (St. Thomas)', coords: [17.881, -76.409], parish: 'St. Thomas' },
  { id: 'stthomas2', name: 'Yallahs (St. Thomas)', coords: [17.87, -76.56], parish: 'St. Thomas' },
];

/** Unique parishes for manual location fallback */
export const JAMAICA_PARISHES = [
  'Kingston', 'St. Andrew', 'St. Catherine', 'Clarendon', 'Manchester', 'St. Elizabeth',
  'Westmoreland', 'Hanover', 'St. James', 'Trelawny', "St. Ann", 'St. Mary', 'Portland', 'St. Thomas',
] as const;

/** Get hub coords for a parish (first hub in that parish) */
export function getHubCoordsForParish(parish: string): [number, number] | null {
  const hub = LOGISTICS_HUBS.find((h) => h.parish?.toLowerCase() === parish.toLowerCase());
  return hub ? hub.coords : null;
}

/** Find nearest hub to user location using Haversine formula */
export function getNearestHub(
  userLocation: [number, number],
  hubsArray: LogisticsHub[]
): { hub: LogisticsHub; distanceKm: number } | null {
  if (!hubsArray.length) return null;
  let nearest: LogisticsHub = hubsArray[0];
  let minDist = getDirectDistance(userLocation, hubsArray[0].coords);
  for (let i = 1; i < hubsArray.length; i++) {
    const d = getDirectDistance(userLocation, hubsArray[i].coords);
    if (d < minDist) {
      minDist = d;
      nearest = hubsArray[i];
    }
  }
  return { hub: nearest, distanceKm: minDist };
}

/** Haversine formula: d = 2R arcsin(sqrt(sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2))) */
export function getDirectDistance(from: [number, number], to: [number, number]): number {
  const R = 6371; // Earth radius km
  const φ1 = (from[0] * Math.PI) / 180;
  const φ2 = (to[0] * Math.PI) / 180;
  const Δφ = ((to[0] - from[0]) * Math.PI) / 180;
  const Δλ = ((to[1] - from[1]) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  return R * c;
}

/** Environmental hazard zones for disaster avoidance */
export interface EnvironmentalHazard {
  id: string;
  name: string;
  coords: [number, number];
  radiusKm: number;
  type: 'blockage' | 'flooding' | 'landslide';
  severity: 'red' | 'yellow'; // red = blocked, yellow = heavy traffic / high wind
}

export const ENVIRONMENTAL_HAZARDS: EnvironmentalHazard[] = [
  { id: 'bogwalk', name: 'Bog Walk Gorge - Landslide', coords: [18.05, -77.02], radiusKm: 2.5, type: 'landslide', severity: 'red' },
  { id: 'marcusgarvey', name: 'Marcus Garvey Drive - Flooding', coords: [17.97, -76.79], radiusKm: 1.8, type: 'flooding', severity: 'red' },
];

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

/** Returns 'red' if in hazard zone, 'yellow' if within 2x radius (heavy traffic), 'green' otherwise */
export function getSegmentStatus(
  coord: [number, number],
  hazards: EnvironmentalHazard[] = ENVIRONMENTAL_HAZARDS
): 'green' | 'yellow' | 'red' {
  for (const h of hazards) {
    const d = haversineKm(coord, h.coords);
    if (d <= h.radiusKm) return 'red';
    if (d <= h.radiusKm * 2) return 'yellow';
  }
  return 'green';
}

/** Check if route passes through any red (blocked) hazard */
export function routeIntersectsBlockedHazard(
  coordinates: [number, number][],
  hazards: EnvironmentalHazard[] = ENVIRONMENTAL_HAZARDS
): boolean {
  return coordinates.some((c) => getSegmentStatus(c, hazards) === 'red');
}

/** Count yellow segments for delay penalty (20 min per yellow zone crossed) */
export function countYellowZonesOnRoute(
  coordinates: [number, number][],
  hazards: EnvironmentalHazard[] = ENVIRONMENTAL_HAZARDS
): number {
  let count = 0;
  let inYellow = false;
  for (const c of coordinates) {
    const status = getSegmentStatus(c, hazards);
    if (status === 'yellow' && !inYellow) {
      inYellow = true;
      count++;
    } else if (status !== 'yellow') {
      inYellow = false;
    }
  }
  return count;
}

/** Split route into colored segments for traffic overlay */
export function getRouteSegmentsByStatus(
  coordinates: [number, number][],
  hazards: EnvironmentalHazard[] = ENVIRONMENTAL_HAZARDS
): { positions: [number, number][]; status: 'green' | 'yellow' | 'red' }[] {
  if (coordinates.length < 2) return [];
  const segments: { positions: [number, number][]; status: 'green' | 'yellow' | 'red' }[] = [];
  let current: [number, number][] = [coordinates[0]];
  let currentStatus = getSegmentStatus(coordinates[0], hazards);

  for (let i = 1; i < coordinates.length; i++) {
    const status = getSegmentStatus(coordinates[i], hazards);
    if (status === currentStatus) {
      current.push(coordinates[i]);
    } else {
      current.push(coordinates[i]);
      if (current.length >= 2) segments.push({ positions: [...current], status: currentStatus });
      current = [coordinates[i]];
      currentStatus = status;
    }
  }
  if (current.length >= 2) segments.push({ positions: current, status: currentStatus });
  return segments;
}
