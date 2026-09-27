import React, { useEffect, useState } from 'react';
import { Database, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { fetchSyncStatus, triggerManualSync } from '../api/admin';
import { SyncStatus } from '../types/admin';

export const SyncStatusBadge: React.FC = () => {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadStatus = async () => {
    try {
      const res = await fetchSyncStatus();
      if (res.success) setStatus(res.data);
    } catch (_) {}
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 10000); // Check status every 10s
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    try {
      setIsSyncing(true);
      await triggerManualSync();
      await loadStatus();
    } catch (err: any) {
      alert(`Manual sync trigger failed: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!status) return null;

  const isPending = status.pending > 0 || status.processing > 0;
  const hasFailed = status.failed > 0;

  return (
    <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-xs shadow-sm">
      <div className="flex items-center space-x-1.5">
        <Database className="w-3.5 h-3.5 text-indigo-600" />
        <span className="font-semibold text-slate-700">PostgreSQL Live</span>
      </div>

      <span className="text-slate-300">|</span>

      <div className="flex items-center space-x-1.5">
        {hasFailed ? (
          <span className="flex items-center text-rose-600 font-semibold">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />
            Sheets Sync ({status.failed} Failed)
          </span>
        ) : isPending ? (
          <span className="flex items-center text-amber-600 font-semibold animate-pulse">
            <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
            Sheets Sync Pending ({status.pending})
          </span>
        ) : (
          <span className="flex items-center text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            Sheets Synced
          </span>
        )}

        <button
          onClick={handleManualSync}
          disabled={isSyncing}
          className="ml-1 text-slate-400 hover:text-indigo-600 p-0.5 rounded transition-colors"
          title="Trigger Outbox Sync Pass"
        >
          <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-indigo-600' : ''}`} />
        </button>
      </div>
    </div>
  );
};
