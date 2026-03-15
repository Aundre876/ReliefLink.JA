import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllHelpRequests, saveHelpRequest } from '../../services/offlineDb';
import { saveMission, syncPendingMissions } from '../../services/missionSync';
import { supabase } from '../../lib/supabaseClient';
import { getLastKnownLocation, saveLastKnownLocation } from '../../services/locationPersistence';
import { getNearestHub, LOGISTICS_HUBS, JAMAICA_PARISHES, getHubCoordsForParish, getDirectDistance } from '../../services/routing';
import { getOrCreateGuestId, getGuestId } from '../../utils/session';
import PriorityQueue from './PriorityQueue';
import IncidentMap from './IncidentMap';
import CrissChat from '../../components/CrissChat';
import EmergencyConfirmation from '../../pages/EmergencyConfirmation';
import type { DispatchInfo } from '../../services/criss';

const USER_NAME_KEY = 'reliefLink_userName';

type ErTab = 'form' | 'queue' | 'map' | 'criss';

interface EmergencyResponseProps {
  isDistressUser?: boolean;
  isHighPriority?: boolean;
  onQuickExit?: () => void;
  onSwitchToSurvival?: () => void;
}

type HelpCategory = 'medical' | 'food' | 'rescue' | 'other';

const HELP_CATEGORIES: { id: HelpCategory; label: string; icon: string }[] = [
  { id: 'medical', label: 'Medical', icon: '🏥' },
  { id: 'food', label: 'Food', icon: '🍞' },
  { id: 'rescue', label: 'Rescue', icon: '🆘' },
  { id: 'other', label: 'Other', icon: '📋' },
];

const QUICK_SELECT_ITEMS = [
  'Drinking Water',
  'Medical First Aid',
  'Search & Rescue',
  'Road Clearance',
] as const;

const TOAST_DURATION_MS = 4000;

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, '0')).join(':');
}

export default function EmergencyResponse({
  isDistressUser,
  isHighPriority,
  onQuickExit,
  onSwitchToSurvival,
}: EmergencyResponseProps = {}) {
  const [helpCategory, setHelpCategory] = useState<HelpCategory | null>(null);
  const [otherSpecify, setOtherSpecify] = useState('');
  const [otherConfirmed, setOtherConfirmed] = useState(false);
  const [activeTab, setActiveTab] = useState<ErTab>('form');
  const [helpRequests, setHelpRequests] = useState<{ lat: number; lng: number; message: string }[]>([]);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [queueRefresh, setQueueRefresh] = useState(0);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [specificNeeds, setSpecificNeeds] = useState('');
  const [quickSelectItems, setQuickSelectItems] = useState<Set<string>>(new Set());
  const [locationFailed, setLocationFailed] = useState(false);
  const [locationAcquiring, setLocationAcquiring] = useState(false);
  const [pathHistory, setPathHistory] = useState<[number, number][]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [missionActive, setMissionActive] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [missionSummaryOpen, setMissionSummaryOpen] = useState(false);
  const [missionSummaryData, setMissionSummaryData] = useState<{
    elapsedTime: number;
    totalDistance: number;
    pathPoints: number;
  } | null>(null);
  const [selectedParish, setSelectedParish] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);
  const [showCriss, setShowCriss] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    hubName: string;
    userLocation: [number, number];
    distanceKm: number;
  } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasDispatchedRef = useRef(false);
  const navigate = useNavigate();

  const userName = (typeof window !== 'undefined' && localStorage.getItem(USER_NAME_KEY)) || 'there';

  const showToast = useCallback((msg: string) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (watchIdRef.current != null) {
        navigator.geolocation?.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!missionActive || startTime == null) return;
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [missionActive, startTime]);

  const refreshHelpRequests = useCallback(() => {
    getAllHelpRequests().then((data) => {
      setHelpRequests(data.map((r) => ({ lat: r.lat, lng: r.lng, message: r.message })));
    });
  }, []);

  const JITTER_THRESHOLD_KM = 0.005;

  const triggerLocationPing = useCallback(
    (categoryLabel: string) => {
      if (!navigator.geolocation) {
        setLocationFailed(true);
        showToast('Enable High Accuracy in your device settings for precise disaster logistics.');
        return;
      }
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setPathHistory([]);
      setTotalDistance(0);
      hasDispatchedRef.current = false;
      setLocationAcquiring(true);
      setLocationFailed(false);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setPathHistory((prev) => {
            const last = prev[prev.length - 1];
            if (!last) {
              setUserLocation(coords);
              setLocationAccuracy(pos.coords.accuracy ?? null);
              setLocationAcquiring(false);
              setLocationFailed(false);
              saveLastKnownLocation(coords[0], coords[1]);
              if (!hasDispatchedRef.current) {
                hasDispatchedRef.current = true;
                const nearest = getNearestHub(coords, LOGISTICS_HUBS);
                const hubName = nearest?.hub.name ?? 'nearest hub';
                saveHelpRequest({
                  lat: coords[0],
                  lng: coords[1],
                  message: `Pending - ${categoryLabel} - Dispatching to ${hubName}`,
                  timestamp: Date.now(),
                  severity: 7,
                  ...(isDistressUser && { guestId: getGuestId() ?? getOrCreateGuestId() }),
                }).then(() => {
                  refreshHelpRequests();
                  setQueueRefresh((n) => n + 1);
                });
                showToast('Location captured. Dispatching coordinates to nearest hub...');
              }
              return [coords];
            }
            const distKm = getDirectDistance(last, coords);
            if (distKm <= JITTER_THRESHOLD_KM) {
              setLocationAccuracy(pos.coords.accuracy ?? null);
              return prev;
            }
            setUserLocation(coords);
            setLocationAccuracy(pos.coords.accuracy ?? null);
            setLocationAcquiring(false);
            saveLastKnownLocation(coords[0], coords[1]);
            setTotalDistance((d) => d + distKm);
            return [...prev, coords];
          });
        },
        () => {
          setLocationAcquiring(false);
          setLocationFailed(true);
          showToast('Enable High Accuracy in your device settings. Location denied or timed out.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    },
    [refreshHelpRequests, showToast, isDistressUser]
  );

  const handleCategorySelect = useCallback(
    (cat: HelpCategory) => {
      setHelpCategory(cat);
      if (cat !== 'other') setOtherSpecify('');
      const label = HELP_CATEGORIES.find((c) => c.id === cat)?.label ?? cat;
      if (!navigator.geolocation) {
        setLocationFailed(true);
        showToast('Enable High Accuracy in your device settings.');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
          setUserLocation(coords);
          setLocationAccuracy(pos.coords.accuracy ?? null);
          setLocationFailed(false);
          saveLastKnownLocation(coords[0], coords[1]);
          const nearest = getNearestHub(coords, LOGISTICS_HUBS);
          const hubName = nearest?.hub.name ?? 'nearest hub';
          saveHelpRequest({
            lat: coords[0],
            lng: coords[1],
            message: `Pending - ${label} - Dispatching to ${hubName}`,
            timestamp: Date.now(),
            severity: 7,
            ...(isDistressUser && { guestId: getGuestId() ?? getOrCreateGuestId() }),
          }).then(() => {
            refreshHelpRequests();
            setQueueRefresh((n) => n + 1);
          });
          showToast('Location captured. Dispatching coordinates to nearest hub...');
        },
        () => {
          setLocationFailed(true);
          showToast('Enable High Accuracy in your device settings. Location denied or timed out.');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    },
    [refreshHelpRequests, showToast, isDistressUser]
  );

  const handleDispatchConfirm = useCallback(
    async (dispatch: DispatchInfo) => {
      const loc = userLocation ?? [18.1, -77.3];
      await saveHelpRequest({
        lat: loc[0],
        lng: loc[1],
        message: `Criss: ${dispatch.incidentSummary} → ${dispatch.hubName} (ETA ~${dispatch.etaMinutes} min)`,
        timestamp: Date.now(),
        severity: 7,
      });
      refreshHelpRequests();
      setQueueRefresh((n) => n + 1);
      if (isDistressUser) {
        navigate('/confirmation', { state: { hubName: dispatch.hubName, userLocation: loc, distanceKm: dispatch.distanceKm } });
      } else {
        setConfirmationData({
          hubName: dispatch.hubName,
          userLocation: loc,
          distanceKm: dispatch.distanceKm,
        });
      }
    },
    [userLocation, refreshHelpRequests, isDistressUser, navigate]
  );

  useEffect(() => {
    const loc = getLastKnownLocation();
    if (loc) {
      setUserLocation([loc.lat, loc.lng]);
      setLocationAccuracy(null);
    }
  }, []);

  useEffect(() => {
    const onOnline = async () => {
      setIsOnline(true);
      const synced = await syncPendingMissions();
      if (synced > 0) showToast(`${synced} mission(s) synced to cloud`);
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [showToast]);

  useEffect(() => {
    refreshHelpRequests();
  }, [refreshHelpRequests]);

  const handleStartMission = useCallback(() => {
    setMissionActive(true);
    setStartTime(Date.now());
    setElapsedTime(0);
    const label = helpCategory ? (HELP_CATEGORIES.find((c) => c.id === helpCategory)?.label ?? helpCategory) : 'Mission';
    triggerLocationPing(label);
  }, [helpCategory, triggerLocationPing]);

  const handleEndMission = useCallback(async () => {
    setMissionActive(false);
    if (watchIdRef.current != null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    const endTime = new Date().toISOString();
    const startTimeIso = startTime != null ? new Date(startTime).toISOString() : endTime;
    const avgSpeed = elapsedTime > 0 ? totalDistance / (elapsedTime / 3600) : 0;
    setMissionSummaryData({ elapsedTime, totalDistance, pathPoints: pathHistory.length });
    setMissionSummaryOpen(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const result = await saveMission({
        start_time: startTimeIso,
        end_time: endTime,
        total_distance: totalDistance,
        avg_speed: avgSpeed,
        path_data: pathHistory,
        user_id: userId,
      });
      if (result.ok) {
        if (result.offline) {
          showToast('Mission saved offline — will sync when online');
        } else {
          showToast('Mission Data Synced');
        }
        setPathHistory([]);
        setTotalDistance(0);
        setElapsedTime(0);
        setStartTime(null);
      }
    } catch {
      showToast('Mission saved offline — will sync when online');
      setPathHistory([]);
      setTotalDistance(0);
      setElapsedTime(0);
      setStartTime(null);
    }
  }, [startTime, elapsedTime, totalDistance, pathHistory, showToast]);

  const handleParishSelect = useCallback(
    (parish: string) => {
      setSelectedParish(parish);
      const coords = getHubCoordsForParish(parish);
      if (coords) {
        setUserLocation(coords);
        setLocationAccuracy(null);
        setPathHistory([]);
        setTotalDistance(0);
        const nearest = getNearestHub(coords, LOGISTICS_HUBS);
        const hubName = nearest?.hub.name ?? parish;
        saveHelpRequest({
          lat: coords[0],
          lng: coords[1],
          message: `Pending - Manual parish (${parish}) - Dispatching to ${hubName}`,
          timestamp: Date.now(),
          severity: 7,
          ...(isDistressUser && { guestId: getGuestId() ?? getOrCreateGuestId() }),
        }).then(() => {
          refreshHelpRequests();
          setQueueRefresh((n) => n + 1);
        });
        showToast('Location set from parish. Dispatching to nearest hub...');
      }
    },
    [refreshHelpRequests, showToast, isDistressUser]
  );

  const handleQuickSos = useCallback(async () => {
    const loc = userLocation ?? [18.1, -77.3];
    const cat = helpCategory ? (helpCategory === 'other' && otherSpecify.trim() ? otherSpecify.trim() : helpCategory) : 'Need assistance';
    const needs = [Array.from(quickSelectItems), specificNeeds].flat().filter(Boolean).join('; ');
    const fullMsg = needs ? `${cat} - ${needs}` : `Quick SOS - ${cat}`;
    await saveHelpRequest({
      lat: loc[0],
      lng: loc[1],
      message: fullMsg,
      timestamp: Date.now(),
      severity: 8,
      ...(isDistressUser && { guestId: getGuestId() ?? getOrCreateGuestId() }),
    });
    refreshHelpRequests();
    setQueueRefresh((n) => n + 1);
    const nearest = getNearestHub(loc, LOGISTICS_HUBS);
    const hubName = nearest?.hub.name ?? 'Nearest';
    const distanceKm = nearest?.distanceKm ?? 10;
    if (isDistressUser) {
      navigate('/confirmation', { state: { hubName, userLocation: loc, distanceKm } });
    } else {
      setConfirmationData({ hubName, userLocation: loc, distanceKm });
    }
  }, [userLocation, helpCategory, otherSpecify, specificNeeds, quickSelectItems, refreshHelpRequests, isDistressUser, navigate]);

  const toggleQuickSelect = (item: string) => {
    setQuickSelectItems((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  };

  const canProceedFromOther = helpCategory === 'other' ? otherSpecify.trim().length > 0 : true;
  const showIntake = helpCategory === null || (helpCategory === 'other' && !otherConfirmed);

  const manualFormContext = [specificNeeds, ...Array.from(quickSelectItems)].filter(Boolean).join('. ');

  const tabs: { id: ErTab; label: string; icon: string }[] = [
    { id: 'form', label: 'Request', icon: '📝' },
    { id: 'queue', label: 'SOS Alerts', icon: '🚨' },
    { id: 'map', label: 'Incident Map', icon: '🗺️' },
  ];

  if (confirmationData) {
    return (
      <EmergencyConfirmation
        userName={userName}
        hubName={confirmationData.hubName}
        userLocation={confirmationData.userLocation}
        distanceKm={confirmationData.distanceKm}
        onUpdateRequest={() => setConfirmationData(null)}
        onImNowSafe={() => setConfirmationData(null)}
        onBack={() => setConfirmationData(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-amber-400 flex flex-col">
      {toast && (
        <div className="fixed top-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[10000] px-4 py-3 rounded-lg bg-emergency-primary/95 text-white text-sm font-medium shadow-lg animate-fadeIn">
          {toast}
        </div>
      )}

      {!showIntake && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-amber-500/40 bg-black/80 shrink-0">
          <div className="flex flex-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 px-4 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-emergency-primary text-white border-b-2 border-white'
                    : 'bg-black/50 text-amber-400/80 hover:bg-amber-500/10'
                }`}
              >
                <span className="mr-1" aria-hidden>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && onSwitchToSurvival && (
              <button
                type="button"
                onClick={onSwitchToSurvival}
                className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-black text-xs font-bold"
              >
                Switch to Survival Mode
              </button>
            )}
            {helpCategory && (
              <button
                type="button"
                onClick={() => { setHelpCategory(null); setOtherConfirmed(false); setOtherSpecify(''); }}
                className="px-2 py-1 text-amber-500/80 hover:text-amber-400 text-xs"
              >
                Change help type
              </button>
            )}
            {isDistressUser && onQuickExit && (
              <button
                type="button"
                onClick={onQuickExit}
                className="px-3 py-1.5 rounded-md bg-gray-600 hover:bg-gray-500 text-white text-xs font-medium"
              >
                Quick Exit
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`p-4 sm:p-6 flex-1 ${showIntake ? 'flex flex-col justify-center' : ''}`}>
        {showIntake && (
          <section className="max-w-md mx-auto w-full">
            <h2 className="text-amber-400 font-bold text-xl mb-6 text-center">
              What kind of help do you need?
            </h2>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {HELP_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategorySelect(cat.id)}
                  className={`flex flex-col items-center justify-center py-6 px-4 rounded-xl border-2 transition-all ${
                    helpCategory === cat.id
                      ? 'border-emergency-primary bg-emergency-primary/20 text-amber-300'
                      : 'border-amber-500/40 bg-amber-500/5 text-amber-400 hover:border-amber-500/60'
                  }`}
                >
                  <span className="text-3xl mb-2" aria-hidden>{cat.icon}</span>
                  <span className="font-bold text-sm">{cat.label}</span>
                </button>
              ))}
            </div>
            {helpCategory === 'other' && (
              <div className="mb-4">
                <input
                  type="text"
                  value={otherSpecify}
                  onChange={(e) => setOtherSpecify(e.target.value)}
                  placeholder="Other (please specify exactly what you need here)..."
                  className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-amber-500/40 text-amber-200 placeholder-amber-500/50 focus:outline-none focus:border-amber-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => canProceedFromOther && setOtherConfirmed(true)}
                  disabled={!canProceedFromOther}
                  className="mt-3 w-full py-3 rounded-xl bg-emergency-primary hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold"
                >
                  Continue
                </button>
              </div>
            )}
          </section>
        )}

        {!showIntake && activeTab === 'form' && (
          <section className="max-w-lg mx-auto">
            <h2 className="text-amber-400 font-bold text-lg mb-3">Specific Needs</h2>
            <p className="text-amber-500/80 text-sm mb-4">
              Describe your situation. This information is shared with dispatchers and Criss.
            </p>

            <div className="mb-4">
              <label className="block text-amber-400/90 text-sm font-medium mb-2">Quick-Select</label>
              <div className="flex flex-wrap gap-2">
                {QUICK_SELECT_ITEMS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleQuickSelect(item)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      quickSelectItems.has(item)
                        ? 'bg-emergency-primary text-white border-2 border-emergency-primary'
                        : 'bg-black/60 border-2 border-amber-500/40 text-amber-400 hover:border-amber-500/60'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-amber-400/90 text-sm font-medium mb-2">Describe your situation</label>
              <textarea
                value={specificNeeds}
                onChange={(e) => setSpecificNeeds(e.target.value)}
                placeholder="Type your situation here—location details, number of people, hazards..."
                rows={5}
                className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-amber-500/40 text-amber-200 placeholder-amber-500/50 focus:outline-none focus:border-amber-500 resize-y min-h-[120px]"
              />
            </div>

            {locationFailed && (
              <div className="mb-4 p-4 rounded-lg bg-amber-500/10 border-2 border-amber-500/50">
                <p className="text-amber-400 font-medium mb-2">Manually select your Parish/Location</p>
                <select
                  value={selectedParish}
                  onChange={(e) => handleParishSelect(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg bg-black/60 border-2 border-amber-500/40 text-amber-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="">Select parish...</option>
                  {JAMAICA_PARISHES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="mb-6 p-4 rounded-lg bg-black/40 border border-amber-500/30">
              <p className="text-amber-500/80 text-sm mb-2">Prefer to speak?</p>
              <button
                type="button"
                onClick={() => setShowCriss(true)}
                className="w-full py-3 rounded-xl bg-[#001F3F] hover:bg-[#002a4d] text-white font-bold text-sm flex items-center justify-center gap-2"
              >
                💬 Talk to Criss, our AI dispatcher
              </button>
            </div>

            <button
              type="button"
              onClick={handleQuickSos}
              className="w-full py-4 rounded-xl bg-emergency-primary hover:bg-red-600 text-white font-bold text-lg"
            >
              Send SOS Now
            </button>
          </section>
        )}

        {!showIntake && activeTab === 'queue' && (
          <section>
            <h2 className="text-amber-400 font-bold text-lg mb-3">Priority Queue</h2>
            <p className="text-amber-500/80 text-sm mb-4">
              Help requests ranked by AI severity (1–10). Highest first.
            </p>
            <div className="bg-black/60 border border-amber-500/40 rounded-lg overflow-hidden">
              <PriorityQueue refreshTrigger={queueRefresh} />
            </div>
          </section>
        )}

        {!showIntake && activeTab === 'map' && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-amber-400 font-bold text-lg">Incident Map</h2>
              <div className="flex gap-2">
                {!missionActive ? (
                  <button
                    type="button"
                    onClick={handleStartMission}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-bold text-sm"
                  >
                    ▶ Start Mission
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEndMission}
                    className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-sm"
                  >
                    ⏹ End Mission
                  </button>
                )}
              </div>
            </div>
            {!isOnline && (
              <p className="text-amber-500 text-sm mb-4">
                Map requires internet. Use &quot;Switch to Survival Mode&quot; above for offline features.
              </p>
            )}
            <p className="text-amber-500/80 text-sm mb-4">
              Your location (red), nearest hub, disaster hazards. Help is coming from the nearest of 31 logistics hubs.
            </p>
            <IncidentMap
              userLocation={userLocation}
              locationAccuracy={locationAccuracy}
              locationAcquiring={locationAcquiring}
              totalDistance={totalDistance}
              pathPoints={pathHistory.length}
              pathHistory={pathHistory}
              elapsedTime={elapsedTime}
              missionActive={missionActive}
              helpRequests={helpRequests}
            />
          </section>
        )}

        {missionSummaryOpen && missionSummaryData && (
          <div className="fixed inset-0 z-[10001] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-black border-2 border-amber-500/40 rounded-xl max-w-sm w-full p-6 shadow-xl">
              <h3 className="text-amber-400 font-bold text-lg mb-4">Mission Summary</h3>
              <div className="space-y-2 text-amber-200 text-sm">
                <p>⏱️ Duration: {formatElapsed(missionSummaryData.elapsedTime)}</p>
                <p>🛣️ Distance: {missionSummaryData.totalDistance.toFixed(2)} km</p>
                <p>🚀 Avg Speed: {missionSummaryData.elapsedTime > 0 ? ((missionSummaryData.totalDistance / (missionSummaryData.elapsedTime / 3600))).toFixed(1) : '0.0'} km/h</p>
                <p>📍 Path Points: {missionSummaryData.pathPoints}</p>
              </div>
              <button
                type="button"
                onClick={() => { setMissionSummaryOpen(false); setMissionSummaryData(null); }}
                className="mt-6 w-full py-3 rounded-lg bg-amber-600 hover:bg-amber-500 text-black font-bold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {showCriss && (
        <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-black border-2 border-amber-500/40 rounded-xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-3 flex items-center justify-between border-b border-amber-500/40">
              <h2 className="text-amber-400 font-bold">Criss AI Assistant</h2>
              <button
                type="button"
                onClick={() => setShowCriss(false)}
                className="text-amber-500/80 hover:text-amber-400 text-xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-h-[400px] overflow-hidden flex flex-col">
              <CrissChat
                userLocation={userLocation}
                darkMode
                isOffline={false}
                onDispatchConfirm={handleDispatchConfirm}
                initialContext={manualFormContext || undefined}
                embedded
                guestId={isDistressUser ? (getGuestId() ?? getOrCreateGuestId()) : undefined}
              />
            </div>
          </div>
        </div>
      )}

      {!showIntake && !showCriss && (
        <button
          type="button"
          onClick={() => setShowCriss(true)}
          className="fixed bottom-6 right-6 z-[9998] w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white font-bold text-lg bg-[#001F3F] hover:bg-[#002a4d] transition-transform hover:scale-105"
          aria-label="Talk to Criss"
        >
          💬
        </button>
      )}

      {onSwitchToSurvival && (
        <div className="p-4 text-center border-t border-amber-500/20 shrink-0">
          <button
            type="button"
            onClick={onSwitchToSurvival}
            className="text-amber-500/70 hover:text-amber-400 text-sm underline"
          >
            No Signal? Switch to Offline Mode
          </button>
        </div>
      )}
    </div>
  );
}
