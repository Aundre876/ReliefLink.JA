import 'leaflet/dist/leaflet.css';
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import CrissChat from './CrissChat';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

/** Fix Leaflet default marker icons in React/Vite */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const JAMAICA_CENTER: [number, number] = [18.1096, -77.2975];

export type DashboardRole = 'customer' | 'driver' | 'admin';

interface DashboardProps {
  role: DashboardRole;
  onLogout?: () => void;
  onGoToCreateShipment?: () => void;
}

interface FeatureCardProps {
  title: string;
  onPress?: () => void;
}

function FeatureCard({ title, onPress }: FeatureCardProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="w-full text-left bg-white border-2 border-rescue-primary rounded-xl p-5 mb-4 min-h-[72px] flex items-center justify-center hover:bg-sky-50 transition-colors"
    >
      <p className="text-rescue-primary text-lg font-bold">{title}</p>
    </button>
  );
}

function Dashboard({ role, onLogout, onGoToCreateShipment }: DashboardProps) {
  return (
    <div className="min-h-screen bg-rescue-surface overflow-y-auto">
      <div className="p-5 sm:p-6 pb-10">
        <div className="mb-6 flex flex-row items-center justify-between">
          <div>
            <p className="text-rescue-primary text-2xl font-bold tracking-tight">
              Dashboard
            </p>
            <p className="text-rescue-secondary text-base mt-1 opacity-90 capitalize">
              {role}
            </p>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="bg-rescue-primary hover:bg-sky-800 px-4 py-2 rounded-lg text-white font-semibold transition-colors"
            >
              Log out
            </button>
          )}
        </div>

        <div className="mb-6 rounded-xl overflow-hidden border-2 border-gray-200" style={{ width: '100%' }}>
          <MapContainer
            center={JAMAICA_CENTER}
            zoom={9}
            style={{ height: '500px', width: '100%' }}
            className="z-0"
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <Marker position={JAMAICA_CENTER}>
              <Popup>Jamaica — ReliefLink Operations</Popup>
            </Marker>
          </MapContainer>
        </div>

        {role === 'customer' && (
          <>
            <FeatureCard title="New Shipping Request" onPress={onGoToCreateShipment} />
            <FeatureCard title="Track Delivery" onPress={() => {}} />
          </>
        )}

        {role === 'driver' && (
          <>
            <FeatureCard title="Available Loads" onPress={onGoToCreateShipment} />
            <FeatureCard title="Active Routes" onPress={() => {}} />
          </>
        )}

        {role === 'admin' && (
          <>
            <FeatureCard title="Resource Overview" onPress={() => {}} />
            <FeatureCard title="Emergency Mode Toggle" onPress={() => {}} />
          </>
        )}
      </div>

      <CrissChat userLocation={null} />
    </div>
  );
}

export default Dashboard;
