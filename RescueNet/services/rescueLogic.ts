import { supabase } from './supabaseClient';

export interface CreateShipmentData {
  pickup: string;
  destination: string;
  packageType: string;
  packageSize: string;
  priority: string;
  deadline: Date | null;
}

/**
 * Saves shipment form data to the Supabase 'shipments' table.
 * @returns The inserted shipment record
 */
export async function handleCreateShipment(data: CreateShipmentData) {
  const { data: row, error } = await supabase
    .from('shipments')
    .insert([
      {
        pickup: data.pickup,
        destination: data.destination,
        package_type: data.packageType,
        package_size: data.packageSize,
        priority: data.priority,
        deadline: data.deadline ? data.deadline.toISOString() : null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return row;
}
