import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";

export interface AuditEntry {
  readonly at: string;
  readonly action: string;
  readonly actor: string;
  readonly surface: "portal" | "bms";
  readonly scope: string;
  readonly summary: string;
  readonly subject?: string;
}

const ACTION_LABELS: Record<string, string> = {
  "sign-in": "Sign-in",
  "organisation.created": "Organisation created",
  "user.added": "User added",
  "user.suspended": "User suspended",
  "user.restored": "User restored",
  "decision.recorded": "Decision",
  "demo.event": "Demonstration event",
  "demo.reset": "Demonstration reset",
};

/** Actions that change who can reach the system read as more consequential. */
const NOTABLE = new Set(["organisation.created", "user.added", "user.suspended", "user.restored", "decision.recorded"]);

function when(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { day: "2-digit", month: "short" })} ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * Everything anyone has done, newest first. The root's page alone: it spans
 * every organisation, so a platform administrator should not read one
 * customer's activity from another's console.
 */
export default function Audit() {
  const { idToken, session } = useAuth();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("all");
  const [surface, setSurface] = useState("all");

  // Hiding the nav link is presentation; this is the guard. The API refuses a
  // non-root caller as well, so neither side is trusted alone.
  const allowed = session?.role === "root";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntries((await api<{ entries: AuditEntry[] }>("/audit", idToken())).entries);
      setError(null);
    } catch (cause) {
      setEntries([]);
      setError(cause instanceof ApiError ? cause.message : "Could not load the activity log.");
    } finally {
      setLoading(false);
    }
  }, [idToken]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const actions = useMemo(
    () => [...new Set((entries ?? []).map((e) => e.action))].sort(),
    [entries],
  );
  const visible = useMemo(
    () =>
      (entries ?? []).filter(
        (e) => (action === "all" || e.action === action) && (surface === "all" || e.surface === surface),
      ),
    [entries, action, surface],
  );

  if (session && !allowed) return <Navigate to="/" replace />;

  return (
    <>
      <div className="page-head head-row">
        <div>
          <h2>Audit</h2>
          <p className="muted">
            Every action anyone has taken, across both surfaces and every organisation — who did it, what it
            was, and when. Entries are appended and never changed.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => void load()} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {entries === null ? (
        <p className="count">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="count">
          Nothing recorded yet. The log starts from when it was switched on — earlier activity is not in it.
        </p>
      ) : (
        <>
          <div className="filter-bar">
            <label>
              <span>Action</span>
              <select value={action} onChange={(e) => setAction(e.target.value)}>
                <option value="all">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {ACTION_LABELS[a] ?? a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Surface</span>
              <select value={surface} onChange={(e) => setSurface(e.target.value)}>
                <option value="all">Both</option>
                <option value="portal">Portal</option>
                <option value="bms">BMS</option>
              </select>
            </label>
            <span className="count">
              {visible.length} of {entries.length}
            </span>
          </div>

          <div className="iface-list">
            {visible.map((e) => (
              <div className="iface-row" key={`${e.at}-${e.actor}-${e.action}`}>
                <div>
                  <div className="iface-name">
                    <span className={NOTABLE.has(e.action) ? "" : "muted"}>{ACTION_LABELS[e.action] ?? e.action}</span>
                    <span className="tag">{e.surface === "bms" ? "BMS" : "Portal"}</span>
                    <span className="tag">{e.scope}</span>
                  </div>
                  <p className="iface-meta">{e.summary}</p>
                </div>
                <span className="muted small" style={{ whiteSpace: "nowrap" }}>
                  {when(e.at)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
