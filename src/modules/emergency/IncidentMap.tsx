import 'leaflet/dist/leaflet.css';
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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

interface IncidentMapProps {
  userLocation?: [number, number] | null;
  helpRequests?: { lat: number; lng: number; message: string }[];
}

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
      map.flyTo(points[0], 14);
    } else {
      const bounds = L.latLngBounds(points).pad(0.15);
      map.flyToBounds(bounds);
    }
  }, [helpRequests, userLocation, map]);
  return null;
}

export default function IncidentMap({ userLocation, helpRequests = [] }: IncidentMapProps) {
  const nearestHub = userLocation ? getNearestHub(userLocation, LOGISTICS_HUBS) : null;
  const lineToHub = userLocation && nearestHub ? [userLocation, nearestHub.hub.coords] as [number, number][] : null;

  return (
    <div className="rounded-lg overflow-hidden border-2 border-amber-500/50 relative" style={{ minHeight: '400px' }}>
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
        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup>Your location — help is on the way</Popup>
          </Marker>
        )}
        {lineToHub && (
          <Polyline
            positions={lineToHub}
            pathOptions={{ color: SAFETY_RED, weight: 3, opacity: 0.8, dashArray: '8, 8' }}
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
        </div>
      )}
    </div>
  );
}
