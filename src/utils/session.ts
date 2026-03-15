/**
 * Guest session utilities for anonymous emergency users.
 * Generates and persists guest_id for users who bypass login via "I Need Help Now".
 */

const GUEST_ID_KEY = 'reliefLink_guest_id';
const GUEST_ID_PREFIX = 'RL-GUEST-';

/**
 * Generates a 4-digit random string for the guest ID suffix.
 */
function generateRandomDigits(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Gets the existing guest_id from localStorage, or generates and saves a new one.
 * Format: RL-GUEST-[4 random digits]
 * Call this as soon as the user clicks "I Need Help Now".
 */
export function getOrCreateGuestId(): string {
  if (typeof window === 'undefined') {
    return `${GUEST_ID_PREFIX}${generateRandomDigits()}`;
  }
  try {
    const existing = localStorage.getItem(GUEST_ID_KEY);
    if (existing && existing.startsWith(GUEST_ID_PREFIX)) {
      return existing;
    }
    const newId = `${GUEST_ID_PREFIX}${generateRandomDigits()}`;
    localStorage.setItem(GUEST_ID_KEY, newId);
    return newId;
  } catch {
    return `${GUEST_ID_PREFIX}${generateRandomDigits()}`;
  }
}

/**
 * Returns the current guest_id if one exists, or null.
 */
export function getGuestId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const id = localStorage.getItem(GUEST_ID_KEY);
    return id && id.startsWith(GUEST_ID_PREFIX) ? id : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the user has a guest_id (anonymous emergency user).
 */
export function isAnonymousEmergencyUser(): boolean {
  return getGuestId() !== null;
}
