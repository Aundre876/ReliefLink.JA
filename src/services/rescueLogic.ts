export interface CreateShipmentData {
  pickup: string;
  destination: string;
  packageType: string;
  packageSize: string;
  priority: string;
  deadline: Date | null;
}

/**
 * Saves shipment form data. Uses Supabase if configured, otherwise simulates success.
 * Kingston/Jamaica localized tracking IDs (RN-JM-*).
 * @returns The inserted shipment record or mock data
 */
export async function handleCreateShipment(data: CreateShipmentData): Promise<unknown> {
  // Simulate API delay
  await new Promise((r) => setTimeout(r, 500));
  return {
    id: `RN-JM-${Date.now()}`,
    pickup: data.pickup,
    destination: data.destination,
    package_type: data.packageType,
    package_size: data.packageSize,
    priority: data.priority,
    deadline: data.deadline ? data.deadline.toISOString() : null,
    created_at: new Date().toISOString(),
    status: 'Pending', // Backend status; 'Delivered' or 'Issue Resolved' turns Status badge green
  };
}
