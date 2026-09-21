import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";

export interface PlatformUser {
  readonly email: string;
  readonly name: string;
  readonly role: "root" | "administrator";
  readonly status: "active" | "disabled";
  readonly createdAt: string;
  readonly createdBy?: string;
  readonly notified?: boolean;
}

/**
 * Who can administer the platform. The root account comes with the pool and
 * is permanent; administrators are added here. Accounts are suspended, never
 * deleted, so the record of who created which organisation survives.
 */
export default function Users() {
  const { idToken, session } = useAuth();
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [created, setCreated] = useState<PlatformUser | null>(null);

  const load = useCallback(async () => {
    try {
      setUsers((await api<{ users: PlatformUser[] }>("/users", idToken())).users);
    } catch (cause) {
      setUsers([]);
      setError(cause instanceof ApiError ? cause.message : "Could not load platform accounts.");
    }
  }, [idToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    setSaving("create");
    setError(null);
    setCreated(null);
    try {
      const result = await api<{ user: PlatformUser }>("/users", idToken(), { method: "POST", body: data });
      setCreated(result.user);
      form.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not add the account.");
    } finally {
      setSaving(null);
    }
  }

  async function setEnabled(user: PlatformUser, enabled: boolean) {
    setSaving(user.email);
    setError(null);
    try {
      await api(`/users/${encodeURIComponent(user.email)}/${enabled ? "enable" : "disable"}`, idToken(), {
        method: "POST",
      });
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not update the account.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>Users</h2>
        <p className="muted">
          Platform accounts. An administrator can create organisations and their owners, and run the demonstration
          controls — everything this console does. They sign in with an emailed six-digit code, like everyone else.
        </p>
      </div>

      <section className="card" style={{ marginBottom: "2rem" }}>
        <h3>Add an administrator</h3>
        <form onSubmit={create} noValidate>
          <div className="contact-grid">
            <label className="field">
              <span>Name</span>
              <input name="name" type="text" required maxLength={120} />
            </label>
            <label className="field">
              <span>Work email</span>
              <input name="email" type="email" required maxLength={320} />
            </label>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {created && (
            <p className="note" role="status">
              Added <b>{created.name}</b> ({created.email}).{" "}
              {created.notified === false
                ? "The welcome email could not be sent — tell them directly that they have access."
                : "They have been emailed and can sign in now."}
            </p>
          )}
          <div className="contact-actions">
            <button className="btn btn-primary" type="submit" disabled={saving !== null}>
              {saving === "create" ? "Adding…" : "Add administrator"}
            </button>
          </div>
        </form>
      </section>

      {users === null ? (
        <p className="count">Loading…</p>
      ) : (
        <div className="iface-list">
          {users.map((u) => (
            <div className="iface-row" key={u.email}>
              <div>
                <div className="iface-name">
                  {u.name}
                  <span className="tag">{u.role === "root" ? "Root" : "Administrator"}</span>
                  {u.status === "disabled" && <span className="tag tag-proprietary">Suspended</span>}
                  {u.email === session?.email && <span className="tag">You</span>}
                </div>
                <p className="iface-meta">
                  {u.email}
                  {u.createdAt && ` · added ${u.createdAt.slice(0, 10)}`}
                  {u.createdBy && ` by ${u.createdBy}`}
                </p>
              </div>
              {u.role !== "root" && u.email !== session?.email && (
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  disabled={saving !== null}
                  onClick={() => void setEnabled(u, u.status === "disabled")}
                >
                  {saving === u.email ? "Saving…" : u.status === "disabled" ? "Restore" : "Suspend"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
