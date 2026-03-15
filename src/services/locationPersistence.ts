/**
 * Location persistence for Survival Mode.
 * Stores last known position in localStorage as reliefLink_last_pos.
 */

const STORAGE_KEY = 'reliefLink_last_pos';

export interface StoredLocation {
  lat: number;
  lng: number;
  timestamp: number;
  address?: string;
}

export function saveLastKnownLocation(lat: number, lng: number, address?: string): void {
  const data: StoredLocation = {
    lat,
    lng,
    timestamp: Date.now(),
    address,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or disabled
  }
}

export function getLastKnownLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as StoredLocation;
    if (typeof data.lat !== 'number' || typeof data.lng !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function formatLastSeen(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}
