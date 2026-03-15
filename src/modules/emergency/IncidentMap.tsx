import 'leaflet/dist/leaflet.css';
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ENVIRONMENTAL_HAZARDS, getNearestHub, LOGISTICS_HUBS } from '../../services/routing';

const JAMAICA_CENTER: [number, number] = [18.1096, -77.2975];

const SAFETY_RED = '#FF4136';

const userLocationIcon = new L.DivIcon({
  html: `<div class="safety-red-ripple" style="background:${SAFETY_RED};width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 0 16px rgba(255,65,54,0.9);"></div>`,
  className: 'bg-transparent border-0',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const hazardIcon = new L.DivIcon({
  html: '<div class="hazard-pulse" style="background:#FF4136;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(255,65,54,0.8);"></div>',
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

type SignalStatus = 'excellent' | 'good' | 'poor' | 'searching';

interface IncidentMapProps {
  userLocation?: [number, number] | null;
  locationAccuracy?: number | null;
  locationAcquiring?: boolean;
  totalDistance?: number;
  pathPoints?: number;
  pathHistory?: [number, number][];
  elapsedTime?: number;
  missionActive?: boolean;
  helpRequests?: { lat: number; lng: number; message: string }[];
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
}

function getSignalStatus(accuracy: number | null | undefined, acquiring: boolean): SignalStatus {
  if (acquiring || accuracy == null) return 'searching';
  if (accuracy < 10) return 'excellent';
  if (accuracy <= 30) return 'good';
  return 'poor';
}

const SIGNAL_CONFIG: Record<SignalStatus, { label: string; color: string; bars: number; progress: number }> = {
  excellent: { label: 'Excellent (Tactical)', color: 'text-green-400', bars: 3, progress: 100 },
  good: { label: 'Good', color: 'text-yellow-400', bars: 2, progress: 66 },
  poor: { label: 'Poor (Triangulating)', color: 'text-red-400', bars: 1, progress: 33 },
  searching: { label: 'Searching', color: 'text-amber-400', bars: 0, progress: 0 },
};

const LOCATION_ZOOM = 18;

function MapCenterOnIncidents({
  helpRequests,
  userLocation,
}: {
  helpRequests: { lat: number; lng: number }[];
  userLocation: [number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [...helpRequests.map((r) => [r.lat, r.lng] as [number, number])];
    if (userLocation) points.push(userLocation);
    if (points.length === 0) return;
    if (points.length === 1) {
      map.flyTo(points[0], LOCATION_ZOOM);
    } else {
      const bounds = L.latLngBounds(points).pad(0.15);
      map.flyToBounds(bounds);
    }
  }, [helpRequests, userLocation, map]);
  return null;
}

export default function IncidentMap({ userLocation, locationAccuracy, locationAcquiring = false, totalDistance = 0, pathPoints = 0, pathHistory = [], elapsedTime = 0, missionActive = false, helpRequests = [] }: IncidentMapProps) {
  const nearestHub = userLocation ? getNearestHub(userLocation, LOGISTICS_HUBS) : null;
  const lineToHub = userLocation && nearestHub ? [userLocation, nearestHub.hub.coords] as [number, number][] : null;
  const signalStatus = getSignalStatus(locationAccuracy ?? null, locationAcquiring);
  const signalConfig = SIGNAL_CONFIG[signalStatus];
  const avgSpeedKmh = elapsedTime > 0 ? totalDistance / (elapsedTime / 3600) : 0;

  return (
    <div className="rounded-lg overflow-hidden border-2 border-amber-500/50 relative" style={{ minHeight: '400px' }}>
      {/* GPS Status - Satellite Handshake */}
      <div className={`absolute top-2 right-2 z-[1000] bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-amber-500/30 shadow-lg ${signalStatus === 'searching' ? 'animate-pulse' : ''}`}>
        <p className="text-amber-400/90 text-xs font-bold uppercase tracking-wider mb-1.5">GPS Status</p>
        <div className="flex items-center gap-2">
          <div className="flex items-end gap-0.5 h-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-1.5 rounded-sm transition-colors ${
                  i <= signalConfig.bars
                    ? signalStatus === 'excellent'
                      ? 'bg-green-400'
                      : signalStatus === 'good'
                        ? 'bg-yellow-400'
                        : signalStatus === 'poor'
                          ? 'bg-red-400'
                          : 'bg-amber-400'
                    : 'bg-gray-600'
                }`}
                style={{ height: `${i * 5}px` }}
              />
            ))}
          </div>
          <span className={`text-xs font-medium ${signalConfig.color}`}>{signalConfig.label}</span>
        </div>
        <div className="mt-1.5 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              signalStatus === 'excellent'
                ? 'bg-green-400'
                : signalStatus === 'good'
                  ? 'bg-yellow-400'
                  : signalStatus === 'poor'
                    ? 'bg-red-400'
                    : 'bg-amber-400'
            }`}
            style={{ width: `${signalStatus === 'searching' ? 15 : signalConfig.progress}%` }}
          />
        </div>
      </div>
      {/* Trip Stats */}
      <div className="absolute top-2 left-2 z-[1000] bg-black/70 backdrop-blur-sm rounded-lg px-3 py-2 border border-amber-500/30 shadow-lg">
        <p className="text-amber-400/90 text-xs font-bold uppercase tracking-wider mb-1.5">Trip Stats</p>
        <p className="text-amber-200 text-sm">⏱️ Duration: {formatElapsed(elapsedTime)}</p>
        <p className="text-amber-200 text-sm">🛣️ Distance: {totalDistance.toFixed(2)} km</p>
        <p className="text-amber-200 text-sm">🚀 Avg Speed: {avgSpeedKmh.toFixed(1)} km/h</p>
        {!missionActive && (
          <p className="text-amber-500/70 text-xs mt-1">Click Start Mission to begin tracking</p>
        )}
      </div>
      <MapContainer
        center={JAMAICA_CENTER}
        zoom={9}
        style={{ height: '400px', width: '100%', background: '#1a1a1a' }}
        className="w-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <MapCenterOnIncidents helpRequests={helpRequests} userLocation={userLocation ?? null} />
        {userLocation && locationAccuracy != null && locationAccuracy > 0 && (
          <Circle
            center={userLocation}
            radius={locationAccuracy}
            pathOptions={{
              color: '#60a5fa',
              fillColor: '#60a5fa',
              fillOpacity: 0.15,
              weight: 2,
            }}
          />
        )}
        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup>
              Your location — help is on the way
              {locationAccuracy != null && (
                <>
                  <br />
                  <span className="text-gray-500 text-xs">GPS accuracy: ±{Math.round(locationAccuracy)} m</span>
                </>
              )}
            </Popup>
          </Marker>
        )}
        {lineToHub && (
          <Polyline
            positions={lineToHub}
            pathOptions={{ color: SAFETY_RED, weight: 3, opacity: 0.8, dashArray: '8, 8' }}
          />
        )}
        {pathHistory.length >= 2 && (
          <Polyline
            positions={pathHistory}
            pathOptions={{ color: '#60a5fa', weight: 2, opacity: 0.6 }}
          />
        )}
        {ENVIRONMENTAL_HAZARDS.map((h) => (
          <React.Fragment key={h.id}>
            <CircleMarker
              center={h.coords}
              radius={h.radiusKm * 3}
              pathOptions={{
                color: h.severity === 'red' ? '#FF4136' : '#f59e0b',
                fillColor: h.severity === 'red' ? '#FF4136' : '#f59e0b',
                fillOpacity: 0.2,
                weight: 2,
              }}
            />
            <Marker position={h.coords} icon={hazardIcon}>
              <Popup>
                <strong>{h.name}</strong>
                <br />
                {h.type} • {h.severity === 'red' ? 'Blocked' : 'Caution'}
              </Popup>
            </Marker>
          </React.Fragment>
        ))}
        {LOGISTICS_HUBS.map((hub) => (
          <Marker key={hub.id} position={hub.coords} icon={hubIcon}>
            <Popup>
              <strong>{hub.name}</strong>
              <br />
              Emergency Hub
              {nearestHub?.hub.id === hub.id && (
                <>
                  <br />
                  <span className="text-green-400 font-bold">Nearest to user</span>
                </>
              )}
            </Popup>
          </Marker>
        ))}
        {helpRequests.map((req, i) => (
          <CircleMarker
            key={`req-${i}`}
            center={[req.lat, req.lng]}
            radius={8}
            pathOptions={{
              color: '#FF4136',
              fillColor: '#FF4136',
              fillOpacity: 0.8,
              weight: 2,
            }}
          >
            <Popup>{req.message}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      {nearestHub && userLocation && (
        <div className="absolute bottom-2 left-2 right-2 bg-black/80 text-amber-400 text-xs p-2 rounded z-[1000]">
          Nearest hub: {nearestHub.hub.name} ({nearestHub.distanceKm.toFixed(1)} km)
          {locationAccuracy != null && (
            <span className="ml-2 text-blue-300">GPS ±{Math.round(locationAccuracy)} m</span>
          )}
        </div>
      )}
    </div>
  );
}
