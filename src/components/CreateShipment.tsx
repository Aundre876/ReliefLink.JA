import 'leaflet/dist/leaflet.css';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { postShipment } from '../services/api';
import { saveShipmentOffline } from '../services/offlineDb';
import { reverseGeocode, searchAddresses } from '../services/nominatim';
import {
  fetchRouteAlternatives,
  getDirectDistance,
  getNearestHub,
  ENVIRONMENTAL_HAZARDS,
  routeIntersectsBlockedHazard,
  countYellowZonesOnRoute,
  getRouteSegmentsByStatus,
} from '../services/routing';
import CrissChat from './CrissChat';

// Pickup marker: Deep Navy #001F3F
const pickupIcon = new L.DivIcon({
  html: '<div style="background:#001F3F;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
  className: 'bg-transparent border-0',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Destination marker: Safety Red #FF4136
const destinationIcon = new L.DivIcon({
  html: '<div style="background:#FF4136;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
  className: 'bg-transparent border-0',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Disaster-resilience network: Primary Hubs + Parish points (2 per parish)
const LOGISTICS_POINTS = [
  // Primary Hubs (isMajorHub: true, radius 12, glow)
  { id: 'kct', name: 'Kingston (KCT)', coords: [17.965, -76.804] as [number, number], isMajorHub: true },
  { id: 'mobay', name: 'Montego Bay (Logistics Hub)', coords: [18.466, -77.917] as [number, number], isMajorHub: true },
  { id: 'mandeville', name: 'Mandeville (Regional Center)', coords: [18.033, -77.507] as [number, number], isMajorHub: true },
  // Parish Network (2 per parish)
  { id: 'standrew1', name: 'St. Andrew', coords: [18.04, -76.8] as [number, number], parish: 'St. Andrew' },
  { id: 'standrew2', name: 'St. Andrew', coords: [18.08, -76.75] as [number, number], parish: 'St. Andrew' },
  { id: 'stcatherine1', name: 'Spanish Town (St. Catherine)', coords: [17.996, -76.955] as [number, number], parish: 'St. Catherine' },
  { id: 'stcatherine2', name: 'Old Harbour (St. Catherine)', coords: [17.94, -77.1] as [number, number], parish: 'St. Catherine' },
  { id: 'clarendon1', name: 'May Pen (Clarendon)', coords: [17.964, -77.243] as [number, number], parish: 'Clarendon' },
  { id: 'clarendon2', name: 'Hayes (Clarendon)', coords: [17.88, -77.23] as [number, number], parish: 'Clarendon' },
  { id: 'manchester1', name: 'Porus (Manchester)', coords: [18.03, -77.41] as [number, number], parish: 'Manchester' },
  { id: 'manchester2', name: 'Christiana (Manchester)', coords: [18.17, -77.48] as [number, number], parish: 'Manchester' },
  { id: 'stelizabeth1', name: 'Black River (St. Elizabeth)', coords: [18.021, -77.851] as [number, number], parish: 'St. Elizabeth' },
  { id: 'stelizabeth2', name: 'Santa Cruz (St. Elizabeth)', coords: [18.05, -77.7] as [number, number], parish: 'St. Elizabeth' },
  { id: 'westmoreland1', name: 'Sav-la-Mar (Westmoreland)', coords: [18.218, -78.127] as [number, number], parish: 'Westmoreland' },
  { id: 'westmoreland2', name: 'Grange Hill (Westmoreland)', coords: [18.37, -78.2] as [number, number], parish: 'Westmoreland' },
  { id: 'hanover1', name: 'Lucea (Hanover)', coords: [18.451, -78.173] as [number, number], parish: 'Hanover' },
  { id: 'hanover2', name: 'Hopewell (Hanover)', coords: [18.47, -78.03] as [number, number], parish: 'Hanover' },
  { id: 'stjames1', name: 'Rose Hall (St. James)', coords: [18.51, -77.8] as [number, number], parish: 'St. James' },
  { id: 'stjames2', name: 'Cambridge (St. James)', coords: [18.29, -77.89] as [number, number], parish: 'St. James' },
  { id: 'trelawny1', name: 'Falmouth (Trelawny)', coords: [18.493, -77.656] as [number, number], parish: 'Trelawny' },
  { id: 'trelawny2', name: 'Duncans (Trelawny)', coords: [18.46, -77.53] as [number, number], parish: 'Trelawny' },
  { id: 'stann1', name: "St. Ann's Bay (St. Ann)", coords: [18.435, -77.202] as [number, number], parish: 'St. Ann' },
  { id: 'stann2', name: 'Browns Town (St. Ann)', coords: [18.4, -77.36] as [number, number], parish: 'St. Ann' },
  { id: 'stmary1', name: 'Port Maria (St. Mary)', coords: [18.374, -76.889] as [number, number], parish: 'St. Mary' },
  { id: 'stmary2', name: 'Annotto Bay (St. Mary)', coords: [18.27, -76.77] as [number, number], parish: 'St. Mary' },
  { id: 'portland1', name: 'Port Antonio (Portland)', coords: [18.176, -76.45] as [number, number], parish: 'Portland' },
  { id: 'portland2', name: 'Buff Bay (Portland)', coords: [18.23, -76.66] as [number, number], parish: 'Portland' },
  { id: 'stthomas1', name: 'Morant Bay (St. Thomas)', coords: [17.881, -76.409] as [number, number], parish: 'St. Thomas' },
  { id: 'stthomas2', name: 'Yallahs (St. Thomas)', coords: [17.87, -76.56] as [number, number], parish: 'St. Thomas' },
];

function MapCenterController({
  pickup,
  destination,
}: {
  pickup: [number, number] | null;
  destination: [number, number] | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (pickup && destination) {
      const bounds = L.latLngBounds([pickup, destination]).pad(0.2);
      map.flyToBounds(bounds);
    } else if (pickup) {
      map.flyTo(pickup, 16);
    }
  }, [pickup, destination, map]);
  return null;
}

const PACKAGE_TYPES = [
  { label: 'Medicine', value: 'medicine' },
  { label: 'Food', value: 'food' },
  { label: 'General', value: 'general' },
  { label: 'Other...', value: 'other' },
];

const PACKAGE_SIZES = [
  { label: 'Small', value: 'small' },
  { label: 'Medium', value: 'medium' },
  { label: 'Large', value: 'large' },
];

const PRIORITIES = [
  { label: 'Urgent', value: 'high', bg: 'bg-red-600', border: 'border-red-900' },
  { label: 'Normal Logistics', value: 'medium', bg: 'bg-orange-500', border: 'border-orange-500' },
  { label: 'Non-urgent', value: 'low', bg: 'bg-blue-800', border: 'border-blue-900' },
];

const JAMAICA_CENTER: [number, number] = [18.1096, -77.2975];
const KCT_HUB = LOGISTICS_POINTS.find((p) => p.id === 'kct')!;

// Pulsing gold ring for selected dispatch hub
const goldRingIcon = new L.DivIcon({
  html: '<div class="hub-gold-pulse" style="width:44px;height:44px;border-radius:50%;border:4px solid #D4AF37;background:transparent;box-shadow:0 0 16px rgba(212,175,55,0.6);"></div>',
  className: 'bg-transparent border-0',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

// Hazard icon: Pulsing red warning
const hazardIcon = new L.DivIcon({
  html: '<div class="hazard-pulse" style="background:#FF4136;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 12px rgba(255,65,54,0.8);"></div>',
  className: 'bg-transparent border-0',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const RESOLVED_STATUSES = ['Delivered', 'Issue Resolved', 'Resolved', 'Processed'];

interface CreateShipmentProps {
  onBack?: () => void;
}

function DraggableMarker({
  position,
  onPositionChange,
}: {
  position: [number, number] | null;
  onPositionChange: (lat: number, lng: number) => void;
}) {
  if (!position) return null;

  return (
    <Marker
      position={position}
      icon={pickupIcon}
      draggable
      eventHandlers={{
        dragend: (e) => {
          const { lat, lng } = e.target.getLatLng();
          onPositionChange(lat, lng);
        },
      }}
    />
  );
}

export default function CreateShipment({ onBack }: CreateShipmentProps) {
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [packageType, setPackageType] = useState(PACKAGE_TYPES[0].value);
  const [packageSize, setPackageSize] = useState(PACKAGE_SIZES[0].value);
  const [priority, setPriority] = useState(PRIORITIES[0].value);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);

  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(null);
  const [pickupCoords, setPickupCoords] = useState<[number, number] | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<[number, number] | null>(null);
  const [routeOptions, setRouteOptions] = useState<{ distanceKm: number; durationMinutes: number; coordinates: [number, number][] }[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routeLoading, setRouteLoading] = useState(false);
  const [liveEnvironmentalStatus, setLiveEnvironmentalStatus] = useState(false);
  const [routeBlockedRerouted, setRouteBlockedRerouted] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearestHubNotification, setNearestHubNotification] = useState<string | null>(null);
  const [selectedHubId, setSelectedHubId] = useState<string | null>(null);
  const [hasAttemptedInitialLocation, setHasAttemptedInitialLocation] = useState(false);

  const [pickupSuggestions, setPickupSuggestions] = useState<{ display_name: string; lat: string; lon: string; place_id: number }[]>([]);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [pickupSuggestionsLoading, setPickupSuggestionsLoading] = useState(false);
  const [pickupNotFound, setPickupNotFound] = useState(false);
  const [destinationNotFound, setDestinationNotFound] = useState(false);
  const [destinationSuggestions, setDestinationSuggestions] = useState<{ display_name: string; lat: string; lon: string; place_id: number }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const destinationInputRef = useRef<HTMLInputElement>(null);
  const pickupInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const pickupSuggestionsRef = useRef<HTMLDivElement>(null);
  const otherTypeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pickup && selectedHubId) {
      const hub = LOGISTICS_POINTS.find((p) => p.id === selectedHubId);
      if (hub && pickup !== hub.name) {
        setSelectedHubId(null);
        setNearestHubNotification(null);
      }
    }
  }, [pickup, selectedHubId]);

  const onWebDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDeadline(val ? new Date(val) : null);
  };

  const isResolved = backendStatus && RESOLVED_STATUSES.includes(backendStatus);

  const applyAutoDispatch = useCallback(
    async (userCoords: [number, number]) => {
      const result = getNearestHub(userCoords, LOGISTICS_POINTS);
      if (result) {
        const { hub, distanceKm } = result;
        setPickup(hub.name);
        setPickupCoords(hub.coords);
        setMarkerPosition(null);
        setDestinationCoords(userCoords);
        try {
          const address = await reverseGeocode(userCoords[0], userCoords[1]);
          setDestination(address);
        } catch {
          setDestination(`${userCoords[0].toFixed(6)}, ${userCoords[1].toFixed(6)}`);
        }
        setSelectedHubId(hub.id);
        setNearestHubNotification(`Automatically routed to nearest hub: ${hub.name} (${distanceKm.toFixed(1)} km away)`);
      }
    },
    []
  );

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setPickup(KCT_HUB.name);
      setPickupCoords(KCT_HUB.coords);
      setMarkerPosition(null);
      setSelectedHubId(KCT_HUB.id);
      setNearestHubNotification(`GPS unavailable. Defaulting to ${KCT_HUB.name} (national anchor).`);
      return;
    }
    setLocationLoading(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        await applyAutoDispatch(coords);
        setLocationLoading(false);
      },
      (err) => {
        setLocationError(err.message || 'Could not get your location.');
        setPickup(KCT_HUB.name);
        setPickupCoords(KCT_HUB.coords);
        setSelectedHubId(KCT_HUB.id);
        setNearestHubNotification(`GPS unavailable. Defaulting to ${KCT_HUB.name} (national anchor).`);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [applyAutoDispatch]);

  const handleMarkerDrag = useCallback(async (lat: number, lng: number) => {
    const coords: [number, number] = [lat, lng];
    setMarkerPosition(coords);
    setPickupCoords(coords);
    try {
      const address = await reverseGeocode(lat, lng);
      setPickup(address);
    } catch {
      setPickup(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  }, []);

  const fetchPickupSuggestions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 3) {
      setPickupSuggestions([]);
      setShowPickupSuggestions(false);
      setPickupNotFound(false);
      return;
    }
    setPickupSuggestionsLoading(true);
    setPickupNotFound(false);
    try {
      const results = await searchAddresses(query);
      setPickupSuggestions(results);
      setShowPickupSuggestions(true);
      setPickupNotFound(results.length === 0);
    } catch {
      setPickupSuggestions([]);
      setPickupNotFound(true);
    } finally {
      setPickupSuggestionsLoading(false);
    }
  }, []);

  const fetchDestinationSuggestions = useCallback(async (query: string) => {
    if (!query || query.trim().length < 3) {
      setDestinationSuggestions([]);
      setShowSuggestions(false);
      setDestinationNotFound(false);
      return;
    }
    setSuggestionsLoading(true);
    setDestinationNotFound(false);
    try {
      const results = await searchAddresses(query);
      setDestinationSuggestions(results);
      setShowSuggestions(true);
      setDestinationNotFound(results.length === 0);
    } catch {
      setDestinationSuggestions([]);
      setDestinationNotFound(true);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAttemptedInitialLocation) return;
    setHasAttemptedInitialLocation(true);
    if (!navigator.geolocation) {
      setPickup(KCT_HUB.name);
      setPickupCoords(KCT_HUB.coords);
      setSelectedHubId(KCT_HUB.id);
      setNearestHubNotification(`GPS unavailable. Defaulting to ${KCT_HUB.name} (national anchor).`);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        applyAutoDispatch(coords);
      },
      () => {
        setPickup(KCT_HUB.name);
        setPickupCoords(KCT_HUB.coords);
        setSelectedHubId(KCT_HUB.id);
        setNearestHubNotification(`GPS unavailable. Defaulting to ${KCT_HUB.name} (national anchor).`);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, [hasAttemptedInitialLocation, applyAutoDispatch]);

  const pickupDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const q = pickup.trim();
    if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    if (q.length < 3) {
      setPickupSuggestions([]);
      setShowPickupSuggestions(false);
      setPickupNotFound(false);
      return;
    }
    pickupDebounceRef.current = setTimeout(() => fetchPickupSuggestions(q), 300);
    return () => {
      if (pickupDebounceRef.current) clearTimeout(pickupDebounceRef.current);
    };
  }, [pickup, fetchPickupSuggestions]);

  const destinationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const q = destination.trim();
    if (destinationDebounceRef.current) clearTimeout(destinationDebounceRef.current);
    if (q.length < 3) {
      setDestinationSuggestions([]);
      setShowSuggestions(false);
      setDestinationNotFound(false);
      return;
    }
    destinationDebounceRef.current = setTimeout(() => fetchDestinationSuggestions(q), 300);
    return () => {
      if (destinationDebounceRef.current) clearTimeout(destinationDebounceRef.current);
    };
  }, [destination, fetchDestinationSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(target) &&
        destinationInputRef.current && !destinationInputRef.current.contains(target)
      ) {
        setShowSuggestions(false);
      }
      if (
        pickupSuggestionsRef.current && !pickupSuggestionsRef.current.contains(target) &&
        pickupInputRef.current && !pickupInputRef.current.contains(target)
      ) {
        setShowPickupSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectPickupSuggestion = (displayName: string, lat?: string, lon?: string) => {
    setPickup(displayName);
    if (lat && lon) setPickupCoords([parseFloat(lat), parseFloat(lon)]);
    setMarkerPosition(null);
    setSelectedHubId(null);
    setNearestHubNotification(null);
    setShowPickupSuggestions(false);
    setPickupSuggestions([]);
    setPickupNotFound(false);
  };

  const selectSuggestion = (displayName: string, lat?: string, lon?: string) => {
    setDestination(displayName);
    if (lat && lon) setDestinationCoords([parseFloat(lat), parseFloat(lon)]);
    setShowSuggestions(false);
    setDestinationSuggestions([]);
    setDestinationNotFound(false);
  };

  const effectivePickupCoords = pickupCoords ?? markerPosition;

  useEffect(() => {
    if (!effectivePickupCoords || !destinationCoords) {
      setRouteOptions([]);
      return;
    }
    if (!navigator.onLine) {
      setRouteOptions([]);
      return;
    }
    setRouteLoading(true);
    fetchRouteAlternatives(effectivePickupCoords, destinationCoords)
      .then((routes) => {
        if (routes.length > 0) {
          const sortedByTime = [...routes].sort((a, b) => a.durationMinutes - b.durationMinutes);
          const sortedByDist = [...routes].sort((a, b) => a.distanceKm - b.distanceKm);
          const fastest = sortedByTime[0];
          const shortest = sortedByDist[0];
          const allRoutes = fastest === shortest ? [fastest] : [fastest, shortest];
          // Smart avoidance: prefer routes that don't intersect blocked hazards
          const safeRoutes = allRoutes.filter((r) => !routeIntersectsBlockedHazard(r.coordinates));
          const hasBlockedRoute = allRoutes.some((r) => routeIntersectsBlockedHazard(r.coordinates));
          const preferred = safeRoutes.length > 0 ? safeRoutes : allRoutes;
          const usedSafeReroute = hasBlockedRoute && safeRoutes.length > 0;
          setRouteOptions(preferred);
          setSelectedRouteIdx(0);
          setRouteBlockedRerouted(usedSafeReroute);
        } else {
          setRouteOptions([]);
          setRouteBlockedRerouted(false);
        }
      })
      .catch(() => setRouteOptions([]))
      .finally(() => setRouteLoading(false));
  }, [effectivePickupCoords, destinationCoords]);

  const [syncLaterNotification, setSyncLaterNotification] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const currentRoute = routeOptions[selectedRouteIdx];
  const yellowZoneCount = currentRoute ? countYellowZonesOnRoute(currentRoute.coordinates) : 0;
  const delayPenaltyMinutes = yellowZoneCount * 20;
  const adjustedEtaMinutes = currentRoute ? currentRoute.durationMinutes + delayPenaltyMinutes : 0;
  const directDistance = effectivePickupCoords && destinationCoords
    ? getDirectDistance(effectivePickupCoords, destinationCoords)
    : 0;

  const onSubmit = async () => {
    if (!pickup.trim()) {
      alert('Please enter a pickup location.');
      return;
    }
    if (!destination.trim()) {
      alert('Please enter a destination.');
      return;
    }
    setSubmitting(true);
    setBackendStatus(null);
    setSyncLaterNotification(false);
    const payload = {
      pickup: pickup.trim(),
      destination: destination.trim(),
      packageType,
      packageSize,
      priority,
      deadline: deadline ? deadline.toISOString() : null,
      distanceKm: currentRoute?.distanceKm ?? (isOffline ? directDistance : undefined),
      etaMinutes: currentRoute ? currentRoute.durationMinutes + delayPenaltyMinutes : undefined,
    };
    try {
      const result = await postShipment(payload);
      setBackendStatus(result?.status ?? 'Processed');
      if (priority === 'high') {
        alert('Priority Logistics Activated');
      } else {
        alert('Shipment created successfully.');
      }
      setPickup('');
      setDestination('');
      setMarkerPosition(null);
      setPickupCoords(null);
      setDestinationCoords(null);
      setRouteOptions([]);
      setSelectedHubId(null);
      setNearestHubNotification(null);
      setPackageType(PACKAGE_TYPES[0].value);
      setPackageSize(PACKAGE_SIZES[0].value);
      setPriority(PRIORITIES[0].value);
      setDeadline(null);
    } catch (e) {
      try {
        await saveShipmentOffline(payload);
        setBackendStatus('Pending');
        setSyncLaterNotification(true);
      } catch {
        const message = e instanceof Error ? e.message : 'Failed to save shipment.';
        alert(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl mx-auto p-6 sm:p-8">
        <div className="flex flex-row items-center justify-between mb-6">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="py-2 pr-4 text-rescue-primary font-semibold hover:underline transition-colors"
            >
              ← Back to Login
            </button>
          )}
          <h1 className="text-2xl font-bold text-rescue-primary flex-1">
            Create Shipment
          </h1>
        </div>

        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-2">Status</p>
          <span
            className={`inline-flex px-4 py-2 rounded-md text-sm font-semibold ${
              isResolved ? 'bg-green-500 text-white' : 'bg-gray-400 text-gray-100'
            }`}
          >
            {backendStatus ?? 'Pending'}
          </span>
          {syncLaterNotification && (
            <p className="mt-2 text-amber-600 text-sm font-medium">Sync Later — Saved to device. Will upload when online.</p>
          )}
        </div>

        {/* Pickup with Geolocation & Autocomplete */}
        <div className="mb-5 relative">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Pickup Address
          </label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={pickupInputRef}
                type="text"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                onFocus={() => pickupSuggestions.length > 0 && setShowPickupSuggestions(true)}
                placeholder="Pickup: Norman Manley Airport"
                className="w-full bg-white border border-gray-200 rounded-md p-3 pr-10 text-[#001F3F] placeholder:font-semibold placeholder:text-gray-500 focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F] focus:outline-none transition-colors"
              />
              {pickupSuggestionsLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#001F3F] border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={locationLoading}
              className="shrink-0 px-3 py-2 bg-rescue-primary hover:bg-sky-800 disabled:opacity-60 text-white rounded-md font-medium text-sm transition-colors flex items-center gap-1.5"
            >
              {locationLoading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>📍</span>
                  <span className="hidden sm:inline">Use My Location</span>
                </>
              )}
            </button>
          </div>
          {showPickupSuggestions && pickupSuggestions.length > 0 && (
            <div
              ref={pickupSuggestionsRef}
              className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
            >
              {pickupSuggestions.map((s) => (
                <button
                  key={s.place_id}
                  type="button"
                  onClick={() => selectPickupSuggestion(s.display_name, s.lat, s.lon)}
                  className="w-full text-left px-3 py-2.5 text-sm text-[#001F3F] hover:bg-gray-100 border-b border-gray-100 last:border-0 transition-colors"
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
          {pickup.trim().length >= 3 && !pickupSuggestionsLoading && pickupNotFound && !selectedHubId && (
            <p className="mt-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Location not found, please try a different street name
            </p>
          )}
          {locationError && (
            <p className="mt-1 text-sm text-red-600">{locationError}</p>
          )}
          {nearestHubNotification && (
            <p className="mt-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {nearestHubNotification}
            </p>
          )}
        </div>

        {/* Destination with live suggestions */}
        <div className="mb-5 relative">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Destination Address
          </label>
          <div className="relative">
            <input
              ref={destinationInputRef}
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onFocus={() => destinationSuggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Destination: Mandeville Hospital"
              className="w-full bg-white border border-gray-200 rounded-md p-3 pr-10 text-[#001F3F] placeholder:font-semibold placeholder:text-gray-500 focus:border-[#001F3F] focus:ring-1 focus:ring-[#001F3F] focus:outline-none transition-colors"
            />
            {suggestionsLoading && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#001F3F] border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {showSuggestions && destinationSuggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
            >
              {destinationSuggestions.map((s) => (
                <button
                  key={s.place_id}
                  type="button"
                  onClick={() => selectSuggestion(s.display_name, s.lat, s.lon)}
                  className="w-full text-left px-3 py-2.5 text-sm text-[#001F3F] hover:bg-gray-100 border-b border-gray-100 last:border-0 transition-colors"
                >
                  {s.display_name}
                </button>
              ))}
            </div>
          )}
          {destination.trim().length >= 3 && !suggestionsLoading && destinationNotFound && (
            <p className="mt-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Location not found, please try a different street name
            </p>
          )}
        </div>

        {/* Map - Island-wide logistics network with routing */}
        <div className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-gray-700">Pickup location & logistics network</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={liveEnvironmentalStatus}
                onChange={(e) => setLiveEnvironmentalStatus(e.target.checked)}
                className="rounded border-gray-300 text-rescue-primary focus:ring-rescue-primary"
              />
              <span className="text-xs font-medium text-gray-700">Live Environmental Status</span>
            </label>
          </div>
          <div className="rounded-xl shadow-md overflow-hidden border border-gray-200 relative" style={{ height: '224px', width: '100%' }}>
            <MapContainer
              center={effectivePickupCoords || destinationCoords || markerPosition || JAMAICA_CENTER}
              zoom={effectivePickupCoords || destinationCoords ? 10 : markerPosition ? 16 : 8}
              style={{ height: '224px', width: '100%' }}
              className="w-full z-0"
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapCenterController pickup={effectivePickupCoords || markerPosition} destination={destinationCoords} />
              <DraggableMarker position={markerPosition} onPositionChange={handleMarkerDrag} />
              {destinationCoords && (
                <Marker position={destinationCoords} icon={destinationIcon} />
              )}
              {effectivePickupCoords && !markerPosition && (
                <Marker position={effectivePickupCoords} icon={pickupIcon} />
              )}
              {effectivePickupCoords && destinationCoords && (
                <>
                  {isOffline ? (
                    <Polyline
                      positions={[effectivePickupCoords, destinationCoords]}
                      pathOptions={{ color: '#2563eb', weight: 4, dashArray: '10, 10' }}
                    />
                  ) : currentRoute ? (
                    liveEnvironmentalStatus ? (
                      getRouteSegmentsByStatus(currentRoute.coordinates).map((seg, i) => (
                        <Polyline
                          key={i}
                          positions={seg.positions}
                          pathOptions={{
                            color: seg.status === 'red' ? '#FF4136' : seg.status === 'yellow' ? '#eab308' : '#22c55e',
                            weight: 5,
                          }}
                        />
                      ))
                    ) : (
                      <Polyline
                        positions={currentRoute.coordinates}
                        pathOptions={{ color: '#2563eb', weight: 5 }}
                      />
                    )
                  ) : routeLoading ? (
                    <Polyline
                      positions={[effectivePickupCoords, destinationCoords]}
                      pathOptions={{ color: '#94a3b8', weight: 2, dashArray: '5, 5' }}
                    />
                  ) : null}
                </>
              )}
              {ENVIRONMENTAL_HAZARDS.map((hazard) => (
                <React.Fragment key={hazard.id}>
                  <CircleMarker
                    center={hazard.coords}
                    radius={hazard.radiusKm * 3}
                    pathOptions={{ color: '#FF4136', fillColor: '#FF4136', fillOpacity: 0.15, weight: 1 }}
                  />
                  <Marker position={hazard.coords} icon={hazardIcon}>
                    <Popup>
                      <div className="text-sm min-w-[160px]">
                        <p className="font-bold text-red-700">⚠ {hazard.name}</p>
                        <p className="text-gray-600 text-xs mt-0.5 capitalize">{hazard.type}</p>
                        <p className="text-amber-600 text-xs font-semibold mt-1">Road blocked / Impassable</p>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              ))}
              {LOGISTICS_POINTS.map((point) => (
                <React.Fragment key={point.id}>
                  {selectedHubId === point.id && (
                    <Marker position={point.coords} icon={goldRingIcon} zIndexOffset={100} />
                  )}
                  {point.isMajorHub && (
                    <CircleMarker
                      center={point.coords}
                      radius={18}
                      pathOptions={{ color: 'yellow', fillColor: 'yellow', fillOpacity: 0.25, weight: 0 }}
                    />
                  )}
                  <CircleMarker
                    center={point.coords}
                    radius={point.isMajorHub ? 12 : 5}
                    pathOptions={{
                      color: 'yellow',
                      fillColor: 'yellow',
                      fillOpacity: point.isMajorHub ? 0.8 : 0.5,
                      weight: point.isMajorHub ? 2 : 1,
                    }}
                  >
                    <Popup>
                      <div className="text-sm min-w-[140px]">
                        <p className="font-bold text-gray-800">{point.name}</p>
                        {point.isMajorHub && (
                          <p className="text-amber-600 text-xs font-semibold">Major Hub</p>
                        )}
                        <p className="text-green-600 mt-1 font-medium">Emergency Supplies: Ready</p>
                        <button
                          type="button"
                          onClick={() => {
                            setPickup(point.name);
                            setPickupCoords(point.coords);
                            setMarkerPosition(null);
                            setSelectedHubId(point.id);
                            setNearestHubNotification(`Manually selected: ${point.name}`);
                          }}
                          className="mt-2 w-full py-1.5 px-2 rounded bg-rescue-primary text-white text-xs font-semibold hover:bg-sky-800"
                        >
                          Quick-Dispatch
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDestination(point.name);
                            setDestinationCoords(point.coords);
                          }}
                          className="mt-1 w-full py-1.5 px-2 rounded border border-gray-300 text-gray-700 text-xs font-semibold hover:bg-gray-100"
                        >
                          Set as Destination
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                </React.Fragment>
              ))}
            </MapContainer>
            {effectivePickupCoords && destinationCoords && (
              <div className="absolute bottom-2 left-2 right-2 z-[1000] bg-white/95 rounded-lg shadow-lg p-2 border border-gray-200">
                <p className="text-xs font-bold text-gray-700 mb-1">Route Info</p>
                {isOffline ? (
                  <>
                    <p className="text-xs text-amber-700">Direct Signal Path (Offline)</p>
                    <p className="text-xs text-gray-600">~{directDistance.toFixed(1)} km direct</p>
                  </>
                ) : routeLoading ? (
                  <p className="text-xs text-gray-500">Calculating route...</p>
                ) : currentRoute ? (
                  <>
                    {routeBlockedRerouted && (
                      <p className="text-xs text-amber-700 font-semibold mb-1">
                        Main route blocked. Re-routing via safest alternative...
                      </p>
                    )}
                    <p className="text-xs text-gray-700">
                      {currentRoute.distanceKm.toFixed(1)} km • ETA ~{adjustedEtaMinutes} min
                      {delayPenaltyMinutes > 0 && (
                        <span className="text-amber-600 ml-1">(+{delayPenaltyMinutes} min delay)</span>
                      )}
                    </p>
                    {routeOptions.length > 1 && (
                      <div className="flex gap-1 mt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRouteIdx(0)}
                          className={`flex-1 py-0.5 text-xs rounded ${selectedRouteIdx === 0 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                          Fastest
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedRouteIdx(1)}
                          className={`flex-1 py-0.5 text-xs rounded ${selectedRouteIdx === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                        >
                          Shortest
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-gray-500">No route found</p>
                )}
              </div>
            )}
            <div className="absolute top-2 right-2 z-[1000] bg-white/95 rounded-lg shadow-md px-2 py-1.5 text-xs border border-gray-200">
              <p className="font-semibold text-gray-700 mb-1">Legend</p>
              <p><span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 mr-1 align-middle"></span> Active Logistics Hub</p>
              <p><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1 align-middle"></span> Major Obstruction</p>
              <p><span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600 mr-1 align-middle"></span> Optimized Safe Path</p>
              {liveEnvironmentalStatus && (
                <>
                  <p className="border-t border-gray-200 mt-1 pt-1 font-semibold text-gray-600">Route Status</p>
                  <p><span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1 align-middle"></span> Clear</p>
                  <p><span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-1 align-middle"></span> Heavy traffic</p>
                  <p><span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1 align-middle"></span> Blocked</p>
                </>
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {markerPosition ? 'Drag the navy marker to fine-tune pickup.' : 'Use Quick-Dispatch or Set as Destination on map points.'}
          </p>
        </div>

        <div className="mb-5">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Package Type
          </label>
          <div className="relative">
            <select
              value={PACKAGE_TYPES.some((t) => t.value === packageType) ? packageType : 'other'}
              onChange={(e) => {
                const val = e.target.value;
                setPackageType(val);
                if (val === 'other') {
                  setTimeout(() => otherTypeInputRef.current?.focus(), 50);
                }
              }}
              className="w-full bg-white border border-gray-200 rounded-md p-3 pr-10 text-gray-800 appearance-none focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors cursor-pointer"
            >
              {PACKAGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          {(packageType === 'other' || !PACKAGE_TYPES.slice(0, -1).some((t) => t.value === packageType)) && (
            <input
              ref={otherTypeInputRef}
              type="text"
              value={packageType === 'other' ? '' : packageType}
              onChange={(e) => setPackageType(e.target.value)}
              onFocus={(e) => {
                e.target.classList.remove('bg-gray-100');
                e.target.classList.add('bg-white', 'border-[#001F3F]');
              }}
              onBlur={(e) => {
                if (!e.target.value) {
                  e.target.classList.add('bg-gray-100');
                  e.target.classList.remove('bg-white', 'border-[#001F3F]');
                }
              }}
              placeholder="Other (please specify exactly what you need here)..."
              className="mt-2 w-full rounded-md p-3 text-gray-800 placeholder-gray-500 border border-gray-200 bg-gray-100 transition-all duration-300 ease-in-out"
              style={{ animation: 'fadeIn 0.3s ease-in-out' }}
            />
          )}
        </div>

        <div className="mb-5">
          <p className="text-sm font-semibold text-gray-700 mb-2">Package Size</p>
          <div className="flex rounded-full bg-gray-200 p-1">
            {PACKAGE_SIZES.map((size) => (
              <button
                key={size.value}
                type="button"
                onClick={() => setPackageSize(size.value)}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  packageSize === size.value
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-300/60'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 border border-red-100 p-4 rounded-md bg-red-50/30">
          <p className="text-sm font-semibold text-gray-700 mb-3">Priority</p>
          <div className="flex flex-col sm:flex-row gap-3">
            {PRIORITIES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setPriority(item.value)}
                className={`flex-1 py-3 px-4 rounded-md text-center font-semibold transition-all ${
                  priority === item.value
                    ? `${item.bg} ${item.border} border-2 text-white shadow-md`
                    : 'bg-white border-2 border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Delivery Deadline
          </label>
          <input
            type="date"
            value={deadline ? deadline.toISOString().split('T')[0] : ''}
            onChange={onWebDateChange}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-white border border-gray-200 rounded-md p-3 text-gray-800 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-colors"
          />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="w-full bg-rescue-primary hover:bg-sky-800 disabled:opacity-70 rounded-lg py-4 flex items-center justify-center gap-2 text-white font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
        >
          {submitting ? (
            <>
              <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Sending to Backend...</span>
            </>
          ) : (
            'Create Shipment'
          )}
        </button>
      </div>

      <CrissChat
        userLocation={destinationCoords ?? markerPosition}
        onDispatchConfirm={(dispatch) => {
          setPickup(dispatch.hubName);
          const hub = LOGISTICS_POINTS.find((p) => p.name === dispatch.hubName);
          if (hub) {
            setPickupCoords(hub.coords);
            setSelectedHubId(hub.id);
            setNearestHubNotification(`Criss dispatch: ${dispatch.hubName} alerted. ETA ~${dispatch.etaMinutes} min`);
          }
        }}
      />
    </div>
  );
}
