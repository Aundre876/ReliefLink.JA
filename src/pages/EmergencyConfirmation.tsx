import 'leaflet/dist/leaflet.css';
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { getNearestHub, LOGISTICS_HUBS } from '../services/routing';

const SAFETY_RED = '#FF4136';
const DISPATCH_BLUE = '#2563eb';

const userLocationIcon = new L.DivIcon({
  html: `<div class="safety-red-ripple" style="background:${SAFETY_RED};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(255,65,54,0.9);"></div>`,
  className: 'bg-transparent border-0',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const hubIcon = new L.DivIcon({
  html: '<div style="background:#22c55e;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
  className: 'bg-transparent border-0',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function MapFitBounds({ userLocation, hubCoords }: { userLocation: [number, number]; hubCoords: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLngBounds([userLocation, hubCoords]).pad(0.2);
    map.fitBounds(bounds);
  }, [map, userLocation, hubCoords]);
  return null;
}

function ConfirmationMap({
  userLocation,
  hubCoords,
}: {
  userLocation: [number, number];
  hubCoords: [number, number];
}) {
  const linePositions: [number, number][] = [userLocation, hubCoords];
  const center: [number, number] = [
    (userLocation[0] + hubCoords[0]) / 2,
    (userLocation[1] + hubCoords[1]) / 2,
  ];

  return (
    <div className="rounded-lg overflow-hidden border-2 border-amber-500/40" style={{ height: '200px', width: '100%' }}>
      <MapContainer
        center={center}
        zoom={10}
        style={{ height: '200px', width: '100%', background: '#1a1a1a' }}
        className="w-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapFitBounds userLocation={userLocation} hubCoords={hubCoords} />
        <Marker position={userLocation} icon={userLocationIcon} />
        <Marker position={hubCoords} icon={hubIcon} />
        <Polyline
          positions={linePositions}
          pathOptions={{ color: DISPATCH_BLUE, weight: 4, opacity: 0.9 }}
        />
      </MapContainer>
    </div>
  );
}

export interface EmergencyConfirmationProps {
  userName?: string;
  hubName: string;
  userLocation: [number, number];
  distanceKm: number;
  onUpdateRequest?: () => void;
  onImNowSafe?: () => void;
  onBack?: () => void;
}

/** ETA in minutes: ~2.5 min per km (road conditions) */
function getEtaMinutes(distanceKm: number): number {
  return Math.max(5, Math.round(distanceKm * 2.5));
}

export default function EmergencyConfirmation({
  userName = 'there',
  hubName,
  userLocation,
  distanceKm,
  onUpdateRequest,
  onImNowSafe,
  onBack,
}: EmergencyConfirmationProps) {
  const nearestHub = getNearestHub(userLocation, LOGISTICS_HUBS);
  const hubCoords = nearestHub?.hub.coords ?? [18.1, -77.3];
  const etaMinutes = getEtaMinutes(distanceKm);

  return (
    <div className="min-h-screen bg-black text-amber-400 flex flex-col">
      <div className="p-4 sm:p-6 max-w-lg mx-auto w-full flex-1 flex flex-col">
        {/* Success Checkmark */}
        <div className="flex justify-center mb-6">
          <div className="success-checkmark-animation w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center border-4 border-green-500">
            <svg
              className="w-14 h-14 text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <p className="text-center text-green-400 font-bold text-lg uppercase tracking-wider mb-2">
          Success
        </p>

        {/* Main Heading */}
        <h1 className="text-2xl sm:text-3xl font-bold text-amber-100 text-center mb-2">
          Help is on the way, {userName}!
        </h1>
        <p className="text-amber-500/90 text-center mb-8">
          Your coordinates have been received by the {hubName} Parish Coordinator.
        </p>

        {/* Progress Stepper */}
        <div className="mb-8">
          <div className="space-y-4">
            {[
              { done: true, label: 'SOS Signal Received', pulse: false },
              { done: true, label: 'Location Verified via GPS', pulse: false },
              { done: false, label: `Dispatching Response Team from ${hubName}...`, pulse: true },
              { done: false, label: 'Response Team Arrived', pulse: false },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    step.done
                      ? 'bg-green-500'
                      : step.pulse
                        ? 'bg-blue-500 dispatch-pulse'
                        : 'bg-gray-600'
                  }`}
                >
                  {step.done ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-white text-sm font-bold">{i + 1}</span>
                  )}
                </div>
                <p
                  className={`pt-1 text-sm ${
                    step.done ? 'text-green-400' : step.pulse ? 'text-blue-400' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* While You Wait */}
        <section className="mb-8 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <h2 className="text-amber-400 font-bold mb-3">While You Wait</h2>
          <ul className="space-y-2 text-amber-200/90 text-sm">
            <li className="flex gap-2">
              <span className="text-amber-500 shrink-0">•</span>
              Stay exactly where you are so responders can find you.
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500 shrink-0">•</span>
              Keep your phone screen on high brightness if it is dark.
            </li>
            <li className="flex gap-2">
              <span className="text-amber-500 shrink-0">•</span>
              If the situation changes, use the button below to update us.
            </li>
          </ul>
        </section>

        {/* Mini Map */}
        <div className="mb-6">
          <ConfirmationMap userLocation={userLocation} hubCoords={hubCoords} />
          <p className="mt-2 text-center text-amber-500/90 text-sm">
            Estimated Time of Arrival: ~{etaMinutes} minutes
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mt-auto">
          {onUpdateRequest && (
            <button
              type="button"
              onClick={onUpdateRequest}
              className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-black font-bold"
            >
              Update My Situation
            </button>
          )}
          {onImNowSafe && (
            <button
              type="button"
              onClick={onImNowSafe}
              className="w-full py-2.5 rounded-xl border-2 border-gray-500 text-gray-400 hover:border-gray-400 hover:text-gray-300 text-sm font-medium"
            >
              I am now safe
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full py-2 text-amber-500/70 hover:text-amber-400 text-sm"
            >
              ← Back to Request
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
