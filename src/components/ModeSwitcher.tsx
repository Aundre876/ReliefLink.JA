import React from 'react';

export type AppMode = 'emergency' | 'logistics';

interface ModeSwitcherProps {
  mode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onLogout?: () => void;
  authRole?: string | null;
  showSwitchToEmergency?: boolean;
}

export default function ModeSwitcher({
  mode,
  onModeChange,
  onLogout,
  authRole,
  showSwitchToEmergency = true,
}: ModeSwitcherProps) {
  const isEmergency = mode === 'emergency';

  return (
    <header
      className={`flex items-center justify-between px-4 py-3 shadow-md ${
        isEmergency
          ? 'bg-black border-b-2 border-emergency-primary'
          : 'bg-logistics-primary border-b-2 border-logistics-secondary'
      }`}
    >
      <div className="flex items-center gap-4">
        <h1 className="text-white font-bold text-lg sm:text-xl tracking-tight">
          ReliefLink.JA
        </h1>
        <div className="flex rounded-lg overflow-hidden border border-white/30">
          <button
            type="button"
            onClick={() => onModeChange('logistics')}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              !isEmergency
                ? 'bg-logistics-secondary text-white'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <span aria-hidden>📦</span>
            Logistics Mode
          </button>
          <button
            type="button"
            onClick={() => onModeChange('emergency')}
            className={`px-4 py-2 text-sm font-bold transition-colors flex items-center gap-2 ${
              isEmergency
                ? 'bg-emergency-primary text-white'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <span aria-hidden>🚨</span>
            Emergency Mode
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showSwitchToEmergency && !isEmergency && (
          <button
            type="button"
            onClick={() => onModeChange('emergency')}
            className="px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
          >
            Switch to Emergency
          </button>
        )}
        {authRole && onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="px-3 py-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-medium"
          >
            Log out
          </button>
        )}
      </div>
    </header>
  );
}
