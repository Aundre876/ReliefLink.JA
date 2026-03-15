import 'leaflet/dist/leaflet.css';
import './lib/leafletFix';
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Session } from '@supabase/supabase-js';
import OfflineMode from './pages/OfflineMode';
import LandingGate from './pages/LandingGate';
import Login from './components/Login';
import SignUp from './pages/SignUp';
import EmergencyConfirmation from './pages/EmergencyConfirmation';
import { saveLastKnownLocation } from './services/locationPersistence';
import { reverseGeocode } from './services/nominatim';
import type { AuthRole } from './components/Login';
import ModeSwitcher, { type AppMode } from './components/ModeSwitcher';
import EmergencyResponse from './modules/emergency/EmergencyResponse';
import StandardLogistics from './modules/logistics/StandardLogistics';
import ProtectedRoute from './components/ProtectedRoute';
import { getOrCreateGuestId, getGuestId } from './utils/session';
import { getUnsyncedRequests, markAsSynced } from './services/offlineDb';
import { syncPendingMissions } from './services/missionSync';
import { submitHelpRequest } from './services/api';
import { supabase } from './lib/supabaseClient';
import './App.css';

const LOCATION_PING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export type UserRole = 'distress' | 'volunteer';

/** Sync unsynced help requests and pending missions when online */
function useHelpRequestSync() {
  useEffect(() => {
    const doSync = async () => {
      if (!navigator.onLine) return;
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
        await syncPendingMissions();
      } catch {
        /* ignore */
      }
    };
    const onOnline = () => doSync();
    window.addEventListener('online', onOnline);
    if (navigator.onLine) doSync();
    return () => window.removeEventListener('online', onOnline);
  }, []);
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [authRole, setAuthRole] = useState<AuthRole | null>(null);
  const [appMode, setAppMode] = useState<AppMode>('logistics');
  const [authReady, setAuthReady] = useState(true);

  useHelpRequestSync();

  // Supabase auth - bypassed when using placeholder so map can load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        supabase.from('profiles').select('role').eq('id', s.user.id).single().then(({ data }) => {
          setAuthRole(data?.role === 'admin' ? 'admin' : 'volunteer');
        });
      }
      setAuthReady(true);
    }).catch(() => setAuthReady(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s?.user) {
        supabase.from('profiles').select('role').eq('id', s.user.id).single().then(({ data }) => {
          setAuthRole(data?.role === 'admin' ? 'admin' : 'volunteer');
        });
      } else {
        setAuthRole(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#help' && location.pathname === '/') {
      getOrCreateGuestId();
      navigate('/emergency', { replace: true });
    }
    if (hash === '#survival' && location.pathname === '/') {
      getOrCreateGuestId();
      navigate('/emergency/survival', { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const ping = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          let address: string | undefined;
          try {
            if (navigator.onLine) address = await reverseGeocode(latitude, longitude);
          } catch {
            // ignore
          }
          saveLastKnownLocation(latitude, longitude, address);
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    };
    ping();
    const id = setInterval(ping, LOCATION_PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const handleNeedHelp = () => {
    getOrCreateGuestId();
    navigate('/emergency');
  };

  const handleVolunteer = () => {
    navigate('/login');
  };

  const handleQuickExit = () => {
    navigate('/');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAuthRole(null);
    setAppMode('logistics');
    navigate('/login');
  };

  const isAuthenticated = !!session;
  const isGuest = getGuestId() !== null && !isAuthenticated;

  // Bypass auth gate so Leaflet map loads without Supabase - comment out to restore
  // if (!authReady) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gray-100">
  //       <p className="text-gray-600">Loading...</p>
  //     </div>
  //   );
  // }

  return (
    <Routes>
      {/* Public Lane - Emergency Bypass (no login required) */}
      <Route path="/" element={<LandingGate onVolunteer={handleVolunteer} onNeedHelp={handleNeedHelp} />} />
      <Route
        path="/emergency"
        element={
          <EmergencyResponse
            isDistressUser
            isHighPriority
            onQuickExit={handleQuickExit}
            onSwitchToSurvival={() => navigate('/emergency/survival')}
          />
        }
      />
      <Route path="/emergency/survival" element={<OfflineMode isHighPriority onQuickExit={() => navigate('/emergency')} />} />
      <Route path="/request-help" element={<Navigate to="/emergency" replace />} />
      <Route
        path="/confirmation"
        element={
          (() => {
            const state = location.state as { hubName?: string; userLocation?: [number, number]; distanceKm?: number } | null;
            if (!state?.hubName || !state?.userLocation) {
              return <Navigate to="/emergency" replace />;
            }
            return (
              <EmergencyConfirmation
                hubName={state.hubName}
                userLocation={state.userLocation}
                distanceKm={state.distanceKm ?? 10}
                onUpdateRequest={() => navigate('/emergency')}
                onImNowSafe={() => navigate('/emergency')}
                onBack={() => navigate('/emergency')}
              />
            );
          })()
        }
      />

      {/* Login - Redirect to Dashboard if already logged in */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/logistics" replace />
          ) : (
            <Login
              onLoginSuccess={(role) => {
                setAuthRole(role);
                navigate('/logistics');
              }}
              onGoToCreateShipment={() => navigate('/logistics')}
            />
          )
        }
      />

      {/* Sign Up */}
      <Route path="/signup" element={isAuthenticated ? <Navigate to="/logistics" replace /> : <SignUp />} />

      {/* Protected Lane - Require Supabase auth */}
      <Route
        path="/logistics"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} isGuest={isGuest}>
            <>
              <ModeSwitcher mode={appMode} onModeChange={setAppMode} onLogout={handleLogout} authRole={authRole ?? 'volunteer'} showSwitchToEmergency />
              {appMode === 'emergency' ? (
                <EmergencyResponse />
              ) : (
                <StandardLogistics onBack={undefined} role={authRole ?? 'volunteer'} />
              )}
            </>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} isGuest={isGuest}>
            {isAuthenticated ? (
              <Navigate to="/logistics" replace />
            ) : (
              <Navigate to="/login" state={{ from: location }} replace />
            )}
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute isAuthenticated={isAuthenticated} isGuest={isGuest}>
            {isAuthenticated ? (
              <Navigate to="/logistics" replace />
            ) : (
              <Navigate to="/login" state={{ from: location }} replace />
            )}
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </div>
  );
}

export default App;
