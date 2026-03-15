/**
 * Nominatim (OpenStreetMap) API for reverse geocoding and address search.
 * Jamaica-focused (countrycodes=jm).
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'RescueNet Jamaica (disaster-response)';

async function fetchNominatim<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error('Geocoding request failed');
  return res.json();
}

export interface NominatimReverseResult {
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
  const data = await fetchNominatim<NominatimReverseResult>(url);
  return data.display_name || `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export interface NominatimSearchResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

export async function searchAddresses(query: string): Promise<NominatimSearchResult[]> {
  if (!query || query.trim().length < 3) return [];
  const encoded = encodeURIComponent(query.trim());
  const url = `${NOMINATIM_BASE}/search?format=json&q=${encoded}&countrycodes=jm&limit=5`;
  const data = await fetchNominatim<NominatimSearchResult[]>(url);
  return data || [];
}
