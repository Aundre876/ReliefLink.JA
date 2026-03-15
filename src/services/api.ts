import { supabase } from '../lib/supabaseClient';

export interface ShipmentPayload {
  pickup: string;
  destination: string;
  packageType: string;
  packageSize: string;
  priority: string;
  deadline: string | null;
  distanceKm?: number;
  etaMinutes?: number;
}

export interface ShipmentResponse {
  id?: string;
  status?: string;
  [key: string]: unknown;
}

/** Submit shipment - mock success (no localhost:5000) */
export async function submitShipment(_data: ShipmentPayload): Promise<ShipmentResponse> {
  return { id: 'mock', status: 'created' };
}

export async function createShipment(data: ShipmentPayload): Promise<ShipmentResponse> {
  return submitShipment(data);
}

export async function postShipment(data: ShipmentPayload): Promise<ShipmentResponse> {
  return submitShipment(data);
}

export interface ActiveShipment {
  id: string;
  pickup: string;
  destination: string;
  packageType: string;
  status: string;
  etaMinutes?: number;
  distanceKm?: number;
}

export interface WarehouseCapacity {
  id: string;
  name: string;
  capacityUsed: number;
  capacityTotal: number;
  items: string[];
}

const MOCK_SHIPMENTS: ActiveShipment[] = [
  { id: '1', pickup: 'Kingston (KCT)', destination: 'Spanish Town', packageType: 'Food', status: 'In Transit', etaMinutes: 45, distanceKm: 25 },
  { id: '2', pickup: 'Montego Bay', destination: 'Negril', packageType: 'Water', status: 'Scheduled', etaMinutes: 90, distanceKm: 80 },
];

const MOCK_WAREHOUSES: WarehouseCapacity[] = [
  { id: 'kct', name: 'Kingston (KCT)', capacityUsed: 72, capacityTotal: 100, items: ['Food', 'Water', 'Medicine'] },
  { id: 'mobay', name: 'Montego Bay Hub', capacityUsed: 45, capacityTotal: 80, items: ['Water', 'Equipment'] },
  { id: 'mandeville', name: 'Mandeville Regional', capacityUsed: 30, capacityTotal: 60, items: ['Food', 'Medicine'] },
];

/** Fetch active shipments - uses mock data (no localhost:5000) */
export async function getActiveShipments(): Promise<ActiveShipment[]> {
  return MOCK_SHIPMENTS;
}

export interface HelpRequestPayload {
  lat: number;
  lng: number;
  message: string;
  timestamp: number;
  severity?: number;
  guest_id?: string;
}

/** Submit help request - uses Supabase when configured, else resolves successfully (data stays in IndexedDB) */
export async function submitHelpRequest(data: HelpRequestPayload): Promise<{ id?: string; status?: string }> {
  try {
    const { data: inserted, error } = await supabase
      .from('help_requests')
      .insert({
        lat: data.lat,
        lng: data.lng,
        message: data.message,
        timestamp: data.timestamp,
        severity: data.severity ?? 7,
        guest_id: data.guest_id,
      })
      .select('id')
      .single();
    if (!error && inserted) return { id: (inserted as { id?: string })?.id, status: 'created' };
  } catch {
    /* Supabase not configured or table missing - resolve so caller marks as synced locally */
  }
  return { status: 'queued' };
}

/** Fetch warehouse capacity - uses mock data (no localhost:5000) */
export async function getWarehouseCapacity(): Promise<WarehouseCapacity[]> {
  return MOCK_WAREHOUSES;
}
