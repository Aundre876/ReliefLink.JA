import { supabase } from '../lib/supabaseClient';

const PENDING_SYNC_KEY = 'reliefLink_pending_missions';

/**
 * Expected missions table schema (Supabase):
 * - start_time: timestamptz
 * - end_time: timestamptz
 * - total_distance: float
 * - avg_speed: float
 * - path_data: jsonb (array of [lat, lng])
 * - user_id: uuid (nullable, references auth.users)
 */

export interface MissionPayload {
  start_time: string;
  end_time: string;
  total_distance: number;
  avg_speed: number;
  path_data: [number, number][];
  user_id: string | null;
}

export interface PendingMission {
  start_time: string;
  end_time: string;
  total_distance: number;
  avg_speed: number;
  path_data: [number, number][];
  user_id: string | null;
}

function getPendingMissions(): PendingMission[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setPendingMissions(missions: PendingMission[]) {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(missions));
  } catch {
    /* ignore */
  }
}

export async function saveMission(payload: MissionPayload): Promise<{ ok: boolean; offline?: boolean }> {
  if (!navigator.onLine) {
    const pending = getPendingMissions();
    pending.push(payload);
    setPendingMissions(pending);
    return { ok: true, offline: true };
  }
  try {
    const { error } = await supabase.from('missions').insert({
      start_time: payload.start_time,
      end_time: payload.end_time,
      total_distance: payload.total_distance,
      avg_speed: payload.avg_speed,
      path_data: payload.path_data,
      user_id: payload.user_id,
    });
    if (error) throw error;
    return { ok: true };
  } catch {
    const pending = getPendingMissions();
    pending.push(payload);
    setPendingMissions(pending);
    return { ok: true, offline: true };
  }
}

export async function syncPendingMissions(): Promise<number> {
  const pending = getPendingMissions();
  if (pending.length === 0) return 0;
  let synced = 0;
  const remaining: PendingMission[] = [];
  for (const m of pending) {
    try {
      const { error } = await supabase.from('missions').insert({
        start_time: m.start_time,
        end_time: m.end_time,
        total_distance: m.total_distance,
        avg_speed: m.avg_speed,
        path_data: m.path_data,
        user_id: m.user_id,
      });
      if (error) throw error;
      synced++;
    } catch {
      remaining.push(m);
    }
  }
  setPendingMissions(remaining);
  return synced;
}
