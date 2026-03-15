import { supabase } from './supabaseClient';
import { getDeliveryStatusFromHub, type DeliveryStatus } from './hubLogics';

// 1. Define an interface for VictimRequest based on a presumed Supabase schema.
export interface VictimRequest {
  id?: number;
  full_name: string;
  contact_number: string;
  parish: string;
  address: string;
  need_type: string;
  number_of_people: number;
  latitude: number;
  longitude: number;
  notes?: string;
  created_at?: string;
  analyzed_sentiment?: string;
  /** Set from hub logic: 'Pending Delivery' | 'Inter-hub Transfer' */
  status?: DeliveryStatus;
}

// 2. Placeholder for Gemini analysis
export async function analyzeWithGemini(victimRequest: VictimRequest): Promise<{ analyzed_sentiment: string }> {
  // Placeholder implementation. Integrate Gemini API here.
  return {
    analyzed_sentiment: 'neutral',
  };
}

// 3. submitVictimRequest function — uses nearest hub to set status (Pending Delivery | Inter-hub Transfer)
export async function submitVictimRequest(request: VictimRequest) {
  const geminiResult = await analyzeWithGemini(request);

  const status = await getDeliveryStatusFromHub(
    request.parish,
    request.latitude,
    request.longitude,
    request.need_type
  );

  const enrichedRequest = {
    ...request,
    analyzed_sentiment: geminiResult.analyzed_sentiment,
    status,
  };

  const { data, error } = await supabase
    .from('victim_requests')
    .insert([enrichedRequest])
    .select()
    .single();

  if (error) throw error;
  return data as VictimRequest;
}

/** Form payload from ReportNeed / HurricaneVictimForm */
export interface ReportNeedFormData {
  name: string;
  parish: string; // "westmoreland" | "st_james" | "st_elizabeth"
  needsDescription: string;
  latitude?: number;
  longitude?: number;
}

const PARISH_TO_DISPLAY: Record<string, string> = {
  westmoreland: 'Westmoreland',
  st_james: 'St. James',
  st_elizabeth: 'St. Elizabeth',
};

function deriveNeedType(notes: string): string {
  const lower = notes.toLowerCase();
  if (lower.includes('water')) return 'Water';
  if (lower.includes('food') || lower.includes('meal')) return 'Food';
  if (lower.includes('medical') || lower.includes('medicine') || lower.includes('doctor')) return 'Medical';
  if (lower.includes('shelter') || lower.includes('housing')) return 'Shelter';
  return 'Other';
}

/**
 * Submit a ReportNeed form: maps to VictimRequest, runs hub logic for status, then inserts.
 * Status is set to 'Pending Delivery' if nearest hub has stock, else 'Inter-hub Transfer'.
 */
export async function submitReportNeed(form: ReportNeedFormData): Promise<VictimRequest> {
  const parishDisplay = PARISH_TO_DISPLAY[form.parish] ?? form.parish;
  const need_type = deriveNeedType(form.needsDescription);
  const lat = form.latitude ?? 0;
  const lon = form.longitude ?? 0;

  const request: VictimRequest = {
    full_name: form.name,
    contact_number: '',
    address: '',
    parish: parishDisplay,
    need_type,
    number_of_people: 1,
    latitude: lat,
    longitude: lon,
    notes: form.needsDescription,
  };

  return submitVictimRequest(request);
}

// 4. getNearestHub function
export async function getNearestHub(
  userLatitude: number,
  userLongitude: number
) {
  // Try to use PostGIS RPC if available
  // Assumes: find_nearest_hub(user_lat, user_lon, parishes) returns nearest facility in specified parishes
  const { data: postgisData, error: postgisError } = await supabase
    .rpc('find_nearest_hub', {
      user_lat: userLatitude,
      user_lon: userLongitude,
      parishes: ['Westmoreland', 'St. James', 'St. Elizabeth'],
    });

  if (!postgisError && postgisData && postgisData.length > 0) {
    return postgisData[0];
  }

  // Fallback: fetch facilities and select nearest with Haversine calculation
  const { data, error } = await supabase
    .from('facilities')
    .select('id, name, parish, latitude, longitude')
    .in('parish', ['Westmoreland', 'St. James', 'St. Elizabeth']);

  if (error || !data) {
    throw error || new Error('Failed to fetch facilities');
  }

  // Strongly type the facility
  interface Facility {
    id: number;
    name: string;
    parish: string;
    latitude: number;
    longitude: number;
  }

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const toRad = (val: number) => (val * Math.PI) / 180;
    const R = 6371; // Earth radius in km

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const nearest = (data as Facility[]).reduce<Facility & { distance: number } | null>((closest, facility) => {
    const dist = getDistance(userLatitude, userLongitude, facility.latitude, facility.longitude);
    if (!closest || dist < closest.distance) {
      return { ...facility, distance: dist };
    }
    return closest;
  }, null);

  return nearest;
}