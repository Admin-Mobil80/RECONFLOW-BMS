import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth/AuthContext";

export interface Organisation {
  readonly organisationId: string;
  readonly name: string;
  readonly baseCurrency: string;
  readonly ownerEmail: string;
  readonly createdAt: string;
}

const SLUG_RE = /^[a-z][a-z0-9-]{1,31}$/;

/**
 * Where customers come from. Creating an organisation writes its profile and
 * creates its owner in the portal's user pool; the owner's first email from
 * ReconFlow is a sign-in code.
 */
export default function Organisations() {
  const { idToken } = useAuth();
  const [items, setItems] = useState<Organisation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<Organisation | null>(null);

  async function load() {
    try {
      const result = await api<{ organisations?: Organisation[] }>("/organisations", idToken());
      setItems(result.organisations ?? []);
    } catch (cause) {
      setItems([]);
      setError(cause instanceof ApiError ? cause.message : "Could not load organisations.");
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    const organisationId = data.organisationId.trim().toLowerCase();

    setError(null);
    setCreated(null);
    if (!SLUG_RE.test(organisationId)) {
      setError("Identifier must be 2–32 characters: lowercase letters, digits and hyphens, starting with a letter.");
      return;
    }

    setSaving(true);
    try {
      const result = await api<{ organisation: Organisation }>("/organisations", idToken(), {
        method: "POST",
        body: {
          organisationId,
          name: data.name.trim(),
          baseCurrency: data.baseCurrency.trim().toUpperCase(),
          ownerEmail: data.ownerEmail.trim().toLowerCase(),
          ownerName: data.ownerName.trim(),
        },
      });
      setCreated(result.organisation);
      form.reset();
      await load();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not create the organisation.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h2>Organisations</h2>
        <p>
          Each customer is an organisation with an owner. The owner is created in the portal&rsquo;s
          user pool and can sign in straight away with an emailed code; they add their own
          administrators and reviewers from the portal.
        </p>
      </div>

      <section className="card" style={{ marginBottom: "2rem" }}>
        <h3>Create an organisation</h3>
        <form onSubmit={handleSubmit} noValidate>
          <div className="contact-grid">
            <label className="field">
              <span>Name</span>
              <input name="name" type="text" required maxLength={120} placeholder="Asian Development Bank" />
            </label>
            <label className="field">
              <span>
                Identifier <em>(used in data and URLs)</em>
              </span>
              <input name="organisationId" type="text" required pattern="[a-z][a-z0-9-]{1,31}" placeholder="adb" />
            </label>
            <label className="field">
              <span>Base currency</span>
              <input name="baseCurrency" type="text" required pattern="[A-Za-z]{3}" defaultValue="USD" maxLength={3} />
            </label>
          </div>
          <div className="contact-grid">
            <label className="field">
              <span>Owner&rsquo;s name</span>
              <input name="ownerName" type="text" required maxLength={120} />
            </label>
            <label className="field">
              <span>Owner&rsquo;s email</span>
              <input name="ownerEmail" type="email" required maxLength={320} />
            </label>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {created && (
            <p className="note" role="status">
              Created <b>{created.name}</b> ({created.organisationId}). Its owner, {created.ownerEmail}, can
              sign in to the portal now.
            </p>
          )}

          <div className="contact-actions">
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create organisation"}
            </button>
          </div>
        </form>
      </section>

      {items === null ? (
        <p className="count">Loading…</p>
      ) : items.length === 0 ? (
        <p className="count">No organisations yet.</p>
      ) : (
        <div className="iface-list">
          {items.map((org) => (
            <div className="iface-row" key={org.organisationId}>
              <div>
                <div className="iface-name">
                  {org.name}
                  <span className="tag">{org.organisationId}</span>
                  <span className="tag">{org.baseCurrency}</span>
                </div>
                <p className="iface-meta">
                  Owner {org.ownerEmail} · created {org.createdAt.slice(0, 10)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
