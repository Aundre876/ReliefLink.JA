import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getLastKnownLocation, formatLastSeen, saveLastKnownLocation } from '../services/locationPersistence';
import { saveHelpRequest, saveVoiceSos, getUnsyncedRequests, getUnsyncedVoiceSos, markAsSynced, markVoiceSosSynced } from '../services/offlineDb';
import { submitHelpRequest } from '../services/api';
import { getOrCreateGuestId } from '../utils/session';
import CrissChat from '../components/CrissChat';

function useLastKnownLocation() {
  const [location, setLocation] = useState<ReturnType<typeof getLastKnownLocation>>(null);
  useEffect(() => {
    setLocation(getLastKnownLocation());
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          saveLastKnownLocation(pos.coords.latitude, pos.coords.longitude);
          setLocation(getLastKnownLocation());
        },
        () => {},
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    }
  }, []);
  return location;
}

function useOfflineSync() {
  const syncRef = useRef(false);
  const doSync = useCallback(async () => {
    if (syncRef.current) return;
    syncRef.current = true;
    try {
      const unsynced = await getUnsyncedRequests();
      for (const req of unsynced) {
        try {
          await submitHelpRequest({
            lat: req.lat,
            lng: req.lng,
            message: req.message,
            timestamp: req.timestamp,
            severity: req.severity,
            guest_id: req.guestId,
          });
          await markAsSynced(req.id);
        } catch {
          /* Leave unsynced for retry */
        }
      }
      const unsyncedVoice = await getUnsyncedVoiceSos();
      for (const voice of unsyncedVoice) {
        await markVoiceSosSynced(voice.id);
      }
    } finally {
      syncRef.current = false;
    }
  }, []);

  useEffect(() => {
    const onOnline = () => doSync();
    window.addEventListener('online', onOnline);
    if (navigator.onLine) doSync();
    return () => window.removeEventListener('online', onOnline);
  }, [doSync]);
}

interface OfflineModeProps {
  isHighPriority?: boolean;
  onQuickExit?: () => void;
}

export default function OfflineMode({ isHighPriority, onQuickExit }: OfflineModeProps = {}) {
  const lastLocation = useLastKnownLocation();
  const [meshStatus, setMeshStatus] = useState<'SEARCHING...' | 'CONNECTED' | 'OFFLINE'>('SEARCHING...');
  const [gpsLock, setGpsLock] = useState<'ACTIVE' | 'SEARCHING...' | 'UNAVAILABLE'>('SEARCHING...');
  const [helpSent, setHelpSent] = useState(false);
  const [messageQueued, setMessageQueued] = useState(false);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const [voiceSosSaved, setVoiceSosSaved] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [compassHeading, setCompassHeading] = useState<number | null>(null);
  const [showFirstAid, setShowFirstAid] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useOfflineSync();

  useEffect(() => {
    setMeshStatus(navigator.onLine ? 'CONNECTED' : 'OFFLINE');
  }, []);

  useEffect(() => {
    const onOnline = () => setMeshStatus('CONNECTED');
    const onOffline = () => setMeshStatus('OFFLINE');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    setGpsLock(lastLocation ? 'ACTIVE' : (navigator.geolocation ? 'SEARCHING...' : 'UNAVAILABLE'));
  }, [lastLocation]);

  useEffect(() => {
    if (!('DeviceOrientationEvent' in window)) return;
    const handler = (e: DeviceOrientationEvent) => {
      if (e.alpha != null) setCompassHeading(Math.round(e.alpha));
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, []);

  const handleSendSos = useCallback(async () => {
    const loc = lastLocation || { lat: 0, lng: 0, timestamp: Date.now() };
    const guestId = getOrCreateGuestId();
    try {
      await saveHelpRequest({
        lat: loc.lat,
        lng: loc.lng,
        message: 'SOS - Need assistance',
        timestamp: Date.now(),
        guestId,
      });
      setHelpSent(true);
      setMessageQueued(true);
      setTimeout(() => setMessageQueued(false), 4000);
    } catch (e) {
      console.error('Failed to save help request:', e);
    }
  }, [lastLocation]);

  const handleRecordVoiceSos = useCallback(() => {
    if (voiceRecording) {
      mediaRecorderRef.current?.stop();
      setVoiceRecording(false);
      return;
    }
    setVoiceSosSaved(false);
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const loc = lastLocation || { lat: 0, lng: 0, timestamp: Date.now() };
        const guestId = getOrCreateGuestId();
        await saveVoiceSos(loc.lat, loc.lng, blob, 'Voice SOS - Need assistance');
        await saveHelpRequest({ lat: loc.lat, lng: loc.lng, message: 'Voice SOS - Need assistance', timestamp: Date.now(), guestId });
        setVoiceSosSaved(true);
        setMessageQueued(true);
        setTimeout(() => setMessageQueued(false), 4000);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setVoiceRecording(true);
    }).catch(() => setVoiceSosSaved(false));
  }, [lastLocation, voiceRecording]);

  const handleReconnect = useCallback(async () => {
    setReconnecting(true);
    try {
      if (navigator.onLine) {
        window.location.hash = '';
        window.location.reload();
      } else {
        setMeshStatus('OFFLINE');
      }
    } finally {
      setReconnecting(false);
    }
  }, []);

  return (
    <div className={`min-h-screen bg-black text-amber-400 ${flashlightOn ? 'overflow-hidden' : ''}`}>
      {flashlightOn && (
        <button
          type="button"
          onClick={() => setFlashlightOn(false)}
          className="fixed inset-0 z-50 bg-white"
          aria-label="Turn off flashlight"
        />
      )}

      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        {/* Status Indicators */}
        <div className="flex justify-between items-center mb-6 text-xs font-bold tracking-wider">
          <span className="text-amber-500">
            Mesh Network Status: <span className={meshStatus === 'CONNECTED' ? 'text-green-400' : 'text-amber-400'}>{meshStatus}</span>
          </span>
          <span className="text-amber-500">
            GPS Lock: <span className={gpsLock === 'ACTIVE' ? 'text-green-400' : 'text-amber-400'}>{gpsLock}</span>
          </span>
        </div>

        {/* Message Queued Notification */}
        {messageQueued && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/20 border border-amber-500 text-amber-400 text-sm font-medium text-center">
            Message Queued for Sync
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-amber-400 text-lg font-bold uppercase tracking-wider">
            Survival Mode
            {isHighPriority && <span className="ml-2 text-red-400 text-sm">HIGH PRIORITY</span>}
          </h1>
          <div className="flex gap-2">
            {onQuickExit && (
              <button
                type="button"
                onClick={onQuickExit}
                className="px-2 py-1 rounded bg-gray-600/80 text-white text-xs font-medium"
              >
                Quick Exit
              </button>
            )}
            <button
              type="button"
              onClick={() => onQuickExit?.() ?? (window.location.hash = '')}
              className="text-amber-500/80 text-xs hover:text-amber-400"
            >
              {onQuickExit ? '← Back to Portal' : '← Back'}
            </button>
          </div>
        </div>

        {/* Massive Pulsing SEND SOS Button */}
        <div className="mb-8 flex flex-col items-center">
          <button
            type="button"
            onClick={handleSendSos}
            disabled={helpSent}
            className="w-full max-w-xs py-12 rounded-full border-4 border-amber-500 bg-amber-500/20 text-amber-400 font-black text-2xl sm:text-3xl uppercase tracking-widest animate-pulse hover:bg-amber-500/30 active:scale-95 transition-all disabled:opacity-60 disabled:animate-none"
          >
            {helpSent ? '✓ SOS SENT' : 'SEND SOS'}
          </button>
          {helpSent && (
            <p className="mt-3 text-amber-500/80 text-sm">Stored offline. Will sync when connection returns.</p>
          )}
        </div>

        {/* Voice SOS */}
        <div className="mb-8">
          <button
            type="button"
            onClick={handleRecordVoiceSos}
            className={`w-full py-4 rounded-xl border-2 font-bold text-sm flex items-center justify-center gap-2 ${
              voiceRecording ? 'border-red-500 bg-red-500/20 text-red-400 animate-pulse' : 'border-amber-500/60 bg-amber-500/10 text-amber-400'
            }`}
          >
            {voiceRecording ? '⏹ Stop & Save Voice SOS' : '🎤 Record Voice SOS (with GPS)'}
          </button>
          {voiceSosSaved && (
            <p className="mt-2 text-amber-500/80 text-sm text-center">Voice SOS saved to IndexedDB. Will sync when online.</p>
          )}
        </div>

        {/* Last Known Location */}
        <section className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-500/5">
          <h2 className="text-amber-400 font-bold text-sm mb-2">Last Known Location</h2>
          {lastLocation ? (
            <>
              <p className="text-amber-300 font-mono text-sm">{lastLocation.lat.toFixed(6)}, {lastLocation.lng.toFixed(6)}</p>
              <p className="text-amber-500/90 text-xs mt-1">
                Last seen {formatLastSeen(lastLocation.timestamp)}
                {lastLocation.address && ` • ${lastLocation.address}`}
              </p>
            </>
          ) : (
            <p className="text-amber-500/70 text-sm">No location data. Enable location during normal use.</p>
          )}
        </section>

        {/* Survival Toolkit */}
        <section className="mb-6 p-4 border border-amber-500/40 rounded-lg bg-amber-500/5">
          <h2 className="text-amber-400 font-bold text-sm mb-3">Survival Toolkit</h2>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setFlashlightOn((v) => !v)}
              className={`px-4 py-2 rounded-lg border-2 font-bold text-sm ${
                flashlightOn ? 'bg-amber-500/30 border-amber-500' : 'border-amber-500/50'
              }`}
            >
              🔦 Flashlight
            </button>
            <div className="px-4 py-2 rounded-lg border-2 border-amber-500/50 font-bold text-sm">
              🧭 Compass {compassHeading != null ? `${compassHeading}°` : '—'}
            </div>
            <button
              type="button"
              onClick={() => setShowFirstAid((v) => !v)}
              className="px-4 py-2 rounded-lg border-2 border-amber-500/50 font-bold text-sm hover:bg-amber-500/10"
            >
              🩹 First Aid Tips
            </button>
          </div>
          {showFirstAid && (
            <div className="mt-4 p-3 rounded-lg bg-black/50 text-amber-300 text-xs space-y-2">
              <p><strong>Bleeding:</strong> Apply direct pressure. Elevate if possible.</p>
              <p><strong>Shock:</strong> Lie down, elevate legs, keep warm.</p>
              <p><strong>Burns:</strong> Cool with water 10+ min. Cover with clean cloth.</p>
              <p><strong>CPR:</strong> 30 chest compressions, 2 breaths. Call for help.</p>
            </div>
          )}
        </section>

        {/* Reconnect Button */}
        <div className="mb-6">
          <button
            type="button"
            onClick={handleReconnect}
            disabled={reconnecting}
            className="w-full py-3 rounded-xl border-2 border-amber-500/60 bg-amber-500/10 text-amber-400 font-bold text-sm disabled:opacity-50"
          >
            {reconnecting ? 'Reconnecting...' : 'Reconnect'}
          </button>
          <p className="mt-1 text-amber-500/60 text-xs text-center">Reload when connection returns</p>
        </div>

        <p className="text-amber-500/50 text-xs text-center">Designed for total network failure • Battery-optimized</p>
      </div>

      <CrissChat
        userLocation={lastLocation ? [lastLocation.lat, lastLocation.lng] : null}
        darkMode
        isOffline
        guestId={getOrCreateGuestId()}
        onDispatchConfirm={async () => { await handleSendSos(); }}
      />
    </div>
  );
}
