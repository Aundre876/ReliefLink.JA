import { supabase } from './supabaseClient';

export type DeliveryStatus = 'Pending Delivery' | 'Inter-hub Transfer';

interface Hub {
  id: number;
  location: string;
  parish: string;
  latitude: number;
  longitude: number;
  water_stock: number;
  food_stock: number;
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

/**
 * Finds the nearest storage hub in the same parish to the victim coordinates.
 *
 * @param victimParish Parish string of the victim (e.g. "Westmoreland", "St. James", "St. Elizabeth")
 * @param victimLatitude Victim's latitude
 * @param victimLongitude Victim's longitude
 */
export async function findNearestHub(
  victimParish: string,
  victimLatitude: number,
  victimLongitude: number
): Promise<(Hub & { distance: number }) | null> {
  const { data: hubs, error } = await supabase
    .from('hubs')
    .select('id, location, parish, latitude, longitude, water_stock, food_stock')
    .eq('parish', victimParish);

  if (error || !hubs || hubs.length === 0) {
    return null;
  }

  const nearest = (hubs as Hub[]).reduce<(Hub & { distance: number }) | null>((closest, hub) => {
    const dist = getDistance(victimLatitude, victimLongitude, hub.latitude, hub.longitude);
    if (!closest || dist < closest.distance) {
      return { ...hub, distance: dist };
    }
    return closest;
  }, null);

  return nearest;
}

/**
 * Determines delivery status from the nearest hub's stock.
 * - If the closest hub has the needed items in stock → 'Pending Delivery'
 * - If the hub is empty or cannot fulfill the need → 'Inter-hub Transfer'
 *
 * @param victimParish Parish (display name: "Westmoreland", "St. James", "St. Elizabeth")
 * @param victimLatitude Victim latitude (use 0 if unknown)
 * @param victimLongitude Victim longitude (use 0 if unknown)
 * @param needType One of "Medical" | "Food" | "Water" | "Shelter" (or other)
 */
export async function getDeliveryStatusFromHub(
  victimParish: string,
  victimLatitude: number,
  victimLongitude: number,
  needType: string
): Promise<DeliveryStatus> {
  const nearest = await findNearestHub(victimParish, victimLatitude, victimLongitude);

  if (!nearest) {
    return 'Inter-hub Transfer';
  }

  const need = needType.toLowerCase();
  const hasWater = nearest.water_stock > 0;
  const hasFood = nearest.food_stock > 0;

  if (need === 'water' && hasWater) return 'Pending Delivery';
  if (need === 'food' && hasFood) return 'Pending Delivery';
  if ((need === 'water' || need === 'food') && !hasWater && !hasFood) return 'Inter-hub Transfer';
  if ((need === 'water' || need === 'food') && (hasWater || hasFood)) return 'Pending Delivery';
  // Medical, Shelter, or other: no direct hub stock mapping → transfer
  return 'Inter-hub Transfer';
}