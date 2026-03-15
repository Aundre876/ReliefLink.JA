import React, { useState, useEffect } from 'react';
import { getAllHelpRequests, type HelpRequest } from '../../services/offlineDb';

function SeverityBadge({ severity }: { severity: number }) {
  const isCritical = severity >= 8;
  const isSevere = severity >= 6 && severity < 8;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
        isCritical ? 'bg-red-600 text-white' : isSevere ? 'bg-orange-500 text-white' : 'bg-amber-500 text-black'
      }`}
    >
      {severity}/10
    </span>
  );
}

interface PriorityQueueProps {
  refreshTrigger?: number;
}

export default function PriorityQueue({ refreshTrigger = 0 }: PriorityQueueProps) {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getAllHelpRequests().then((data) => {
      if (mounted) {
        setRequests(data);
        setLoading(false);
      }
    });
    return () => { mounted = false; };
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="p-4 text-amber-400/80 text-sm">Loading priority queue...</div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="p-4 text-amber-500/70 text-sm">
        No SOS alerts in queue. Incoming requests will appear here.
      </div>
    );
  }

  return (
    <div className="divide-y divide-amber-500/30 max-h-80 overflow-y-auto">
      {requests.map((req, idx) => (
        <div
          key={req.id}
          className="p-3 hover:bg-amber-500/10 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber-400 font-bold text-sm">#{idx + 1}</span>
                <SeverityBadge severity={req.severity ?? 7} />
              </div>
              <p className="text-amber-200 text-sm">{req.message}</p>
              <p className="text-amber-500/80 text-xs mt-1 font-mono">
                {req.lat.toFixed(4)}, {req.lng.toFixed(4)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
