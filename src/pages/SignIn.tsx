import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthError, type PendingSignIn } from "../auth/auth";
import { useAuth } from "../auth/AuthContext";
import { PlainHeader } from "../components/Chrome";
import CodeInput from "../components/CodeInput";

/** Two steps, no password: an email address, then the six-digit code sent to it. */
export default function SignIn() {
  const { session, loading, isMock, requestCode, submitCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<PendingSignIn | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (!loading && session) return <Navigate to={from} replace />;

  async function run(action: () => Promise<void>, fallback: string) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (cause) {
      if (cause instanceof AuthError) {
        setError(cause.message);
        if (cause.retryWith) setPending(cause.retryWith);
      } else {
        setError(fallback);
      }
    } finally {
      setBusy(false);
    }
  }

  function handleEmail(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      setPending(await requestCode(email));
      setCode("");
      setResent(false);
    }, "Could not send a code. Try again.");
  }

  function submit(value: string) {
    if (!pending || busy) return;
    void run(async () => {
      await submitCode(pending, value);
      navigate(from, { replace: true });
    }, "Could not sign in. Try again.");
  }

  function resend() {
    if (!pending) return;
    void run(async () => {
      setPending(await requestCode(pending.email));
      setCode("");
      setResent(true);
    }, "Could not send a new code. Try again.");
  }

  return (
    <>
      <PlainHeader />
      <main className="auth-main">
        <div className="auth-card">
          {!pending ? (
            <>
              <h1>Sign in</h1>
              <p className="sub">Platform administration. We&rsquo;ll email you a six-digit code.</p>
              <form onSubmit={handleEmail} noValidate>
                <label className="field">
                  <span>Email</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="username"
                    autoFocus
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div style={{ marginTop: "1.5rem" }}>
                  <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                    {busy ? "Sending code…" : "Email me a code"}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              <h1>Check your email</h1>
              <p className="sub">
                We sent a six-digit code to <b>{pending.email}</b>.
                {resent && " A new code is on its way."}
              </p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  submit(code);
                }}
                noValidate
              >
                <CodeInput value={code} onChange={setCode} onComplete={submit} autoFocus disabled={busy} />
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div style={{ marginTop: "1.5rem" }}>
                  <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
                    {busy ? "Signing in…" : "Sign in"}
                  </button>
                </div>
              </form>
              <p className="note" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                <button className="linklike" type="button" onClick={resend} disabled={busy}>
                  Send a new code
                </button>
                <button
                  className="linklike"
                  type="button"
                  onClick={() => {
                    setPending(null);
                    setError(null);
                  }}
                  disabled={busy}
                >
                  Use a different email
                </button>
              </p>
            </>
          )}
          <p className="note">
            Only platform accounts can sign in here. Customer organisations use the portal.
            {isMock && (
              <>
                {" "}
                <b>Authentication is not connected — any six-digit code is accepted.</b>
              </>
            )}
          </p>
        </div>
      </main>
    </>
  );
}
