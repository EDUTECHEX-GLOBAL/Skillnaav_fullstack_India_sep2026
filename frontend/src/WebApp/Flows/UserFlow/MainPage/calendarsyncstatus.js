// calendarsyncstatus.js
import React from "react";

/**
 * CalendarSyncStatus modal
 * Props:
 *  - open: boolean
 *  - onClose: fn
 *  - phase: 'idle' | 'starting' | 'working' | 'auth' | 'done' | 'error'
 *  - total: number
 *  - summary: { created:number, updated:number, deleted:number }
 *  - errorMsg: string
 */
export default function CalendarSyncStatus({
  open,
  onClose,
  phase = "idle",
  total = 0,
  summary = { created: 0, updated: 0, deleted: 0 },
  errorMsg = ""
}) {
  if (!open) return null;

  // Prefer live 'synced' from summary if supplied; otherwise derive from created+updated+deleted
  const derivedSynced = (summary?.created || 0) + (summary?.updated || 0) + (summary?.deleted || 0);
  const synced = typeof summary?.synced === 'number' ? summary.synced : derivedSynced;
  const safeTotal = Number.isFinite(total) ? total : 0;
  const remaining = Math.max(0, safeTotal - synced);
  const pct = safeTotal > 0 ? Math.min(100, Math.round((synced / safeTotal) * 100)) : 0;

  const isBlocking = phase === "working" || phase === "auth";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md relative">
        <button
          onClick={() => (isBlocking ? null : onClose?.())}
          className={`absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-xl ${isBlocking ? "opacity-50 cursor-not-allowed" : ""
            }`}
          aria-label="Close"
          disabled={isBlocking}
        >
          &times;
        </button>

        <h2 className="text-xl font-semibold text-gray-800 mb-2 text-center">
          Google Calendar Sync
        </h2>

        {(phase === "starting" || phase === "working") && (
          <>
            <p className="text-sm text-gray-600 mb-4 text-center">
              Sync in progress…
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
              <div className="h-2 bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-sm text-gray-700 space-y-1 text-center">
              <p>Total sessions: <strong>{total}</strong></p>
              <p>Synced so far: <strong>{synced}</strong></p>
              <p>Remaining: <strong>{remaining}</strong></p>
            </div>
          </>
        )}

        {phase === "auth" && (
          <div className="text-sm text-gray-700 text-center">
            <p className="text-indigo-600 font-medium mb-2">Google sign-in required</p>
            <p>Redirecting to Google…</p>
          </div>
        )}

        {phase === "done" && (
          <div className="text-sm text-gray-700 space-y-2 text-center">
            <p className="text-green-600 font-semibold mb-2">✅ Sync completed</p>
            <p>Total: <strong>{total}</strong></p>
            <p>Created: <strong>{summary.created || 0}</strong></p>
            <p>Updated: <strong>{summary.updated || 0}</strong></p>
            <p>Deleted Events: <strong>{summary.deleted || 0}</strong></p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        )}

        {phase === "error" && (
          <div className="text-sm text-center">
            <p className="text-red-600 font-medium mb-2">Sync failed</p>
            <p className="text-gray-700">{errorMsg || "Could not sync to Google Calendar"}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
