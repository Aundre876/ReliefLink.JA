import React, { useState, useEffect } from 'react';
import { getActiveShipments, getWarehouseCapacity, type ActiveShipment, type WarehouseCapacity } from '../../services/api';
import CreateShipment from '../../components/CreateShipment';

type SlTab = 'stock' | 'shipments' | 'routes' | 'create';

export default function StandardLogistics({
  onBack,
  role,
}: {
  onBack?: () => void;
  role?: string;
}) {
  const [activeTab, setActiveTab] = useState<SlTab>('shipments');
  const [shipments, setShipments] = useState<ActiveShipment[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseCapacity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([getActiveShipments(), getWarehouseCapacity()]).then(([s, w]) => {
      if (mounted) {
        setShipments(s);
        setWarehouses(w);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, []);

  const tabs: { id: SlTab; label: string; icon: string }[] = [
    { id: 'stock', label: 'Stock Levels', icon: '📦' },
    { id: 'shipments', label: 'Active Shipments', icon: '🚚' },
    { id: 'routes', label: 'Route Optimization', icon: '🗺️' },
    { id: 'create', label: 'New Shipment', icon: '➕' },
  ];

  if (activeTab === 'create') {
    return (
      <div className="min-h-screen bg-logistics-surface">
        <CreateShipment onBack={() => setActiveTab('shipments')} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-logistics-surface text-gray-800">
      <div className="flex border-b border-logistics-primary/30 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-logistics-primary text-white border-b-2 border-logistics-secondary'
                : 'text-gray-600 hover:bg-logistics-surface'
            }`}
          >
            <span className="mr-1" aria-hidden>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        {activeTab === 'stock' && (
          <section>
            <h2 className="text-logistics-primary font-bold text-xl mb-4">Warehouse Capacity</h2>
            <p className="text-gray-600 text-sm mb-6">
              Stock levels across logistics hubs for food, water, and equipment.
            </p>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {warehouses.map((w) => (
                  <div
                    key={w.id}
                    className="bg-white border-2 border-logistics-primary/30 rounded-xl p-5 shadow-sm"
                  >
                    <h3 className="font-bold text-logistics-primary mb-2">{w.name}</h3>
                    <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-logistics-accent transition-all"
                        style={{ width: `${(w.capacityUsed / w.capacityTotal) * 100}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600">
                      {w.capacityUsed} / {w.capacityTotal} units
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {w.items.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'shipments' && (
          <section>
            <h2 className="text-logistics-primary font-bold text-xl mb-4">Active Shipments</h2>
            <p className="text-gray-600 text-sm mb-6">
              Non-emergency goods in transit. Delivery ETAs and status.
            </p>
            {loading ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              <div className="space-y-4">
                {shipments.map((s) => (
                  <div
                    key={s.id}
                    className="bg-white border-2 border-logistics-primary/30 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                  >
                    <div>
                      <h3 className="font-bold text-logistics-primary">{s.packageType}</h3>
                      <p className="text-sm text-gray-600">
                        {s.pickup} → {s.destination}
                      </p>
                      <span
                        className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${
                          s.status === 'In Transit' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="text-right">
                      {s.etaMinutes != null && (
                        <p className="text-logistics-secondary font-bold">ETA: {s.etaMinutes} min</p>
                      )}
                      {s.distanceKm != null && (
                        <p className="text-sm text-gray-500">{s.distanceKm} km</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'routes' && (
          <section>
            <h2 className="text-logistics-primary font-bold text-xl mb-4">Route Optimization</h2>
            <p className="text-gray-600 text-sm mb-6">
              Optimize delivery routes for the 31 parish logistics points. Use New Shipment to plan a route.
            </p>
            <div className="bg-white border-2 border-logistics-primary/30 rounded-xl p-8 text-center">
              <p className="text-gray-600 mb-4">
                Route optimization uses OSRM and hazard avoidance. Create a shipment to see optimized routes.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="px-6 py-3 bg-logistics-primary hover:bg-logistics-secondary text-white font-bold rounded-lg"
              >
                Open Route Planner
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
