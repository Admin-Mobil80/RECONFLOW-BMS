/**
 * Authentication seam.
 *
 * Sign-in is passwordless everywhere: an email address, then a one-time code
 * sent to it. There is no sign-up path in this app — accounts are provisioned
 * from the BMS.
 *
 * Everything outside this folder talks to `AuthClient`. `cognitoAuth`
 * (cognito.ts) is the real implementation; `mockAuth` stands in when no
 * Cognito configuration is present, and says so on every signed-in screen.
 */

export type UserRole = "root" | "owner" | "administrator" | "reviewer";

export interface Session {
  readonly email: string;
  readonly name?: string;
  readonly organisationId: string;
  readonly role: UserRole;
  /** Owners and administrators manage interfaces and users. */
  readonly isAdministrator: boolean;
  /** ISO timestamp after which the session must be refreshed or re-established. */
  readonly expiresAt?: string;
}

/** Step one of sign-in succeeded; a code is on its way. Opaque to the UI. */
export interface PendingSignIn {
  readonly email: string;
  readonly challengeSession: string;
  /** Masked address the code went to, as the provider reports it. */
  readonly destination?: string;
  /** The provider's own identifier for the user, when it differs from the email. */
  readonly username?: string;
  /**
   * A demonstration account: a fixed code and no email, so the screen must
   * not claim one was sent. The provider tells us; we do not keep a list.
   */
  readonly isDemo?: boolean;
}

export interface AuthClient {
  /** True while no real identity provider is connected. */
  readonly isMock: boolean;
  /** Returns the persisted session, refreshing it if needed, or null when signed out. */
  restore(): Promise<Session | null>;
  /** Sends a one-time code to the address. */
  requestCode(email: string): Promise<PendingSignIn>;
  /** Exchanges the code for a session. */
  submitCode(pending: PendingSignIn, code: string): Promise<Session>;
  signOut(): Promise<void>;
}

export class AuthError extends Error {
  /**
   * Set when the attempt failed but the provider kept the sign-in alive under
   * a new challenge (a wrong code, for instance): the UI must carry on with
   * this in place of the previous PendingSignIn.
   */
  readonly retryWith?: PendingSignIn;

  constructor(message: string, retryWith?: PendingSignIn) {
    super(message);
    this.retryWith = retryWith;
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAdministrator(role: UserRole): boolean {
  return role === "owner" || role === "administrator" || role === "root";
}

export function maskEmail(email: string): string {
  const [local, domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***`;
}

// --- mock -----------------------------------------------------------------------

const MOCK_KEY = "reconflow.mock-session";

function readStored(): Session | null {
  try {
    const raw = window.localStorage.getItem(MOCK_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeStored(session: Session | null): void {
  try {
    if (session) window.localStorage.setItem(MOCK_KEY, JSON.stringify(session));
    else window.localStorage.removeItem(MOCK_KEY);
  } catch {
    // Non-fatal: the session simply will not survive a reload.
  }
}

/** Accepts any well-formed email and any six-digit code. Never for production. */
export const mockAuth: AuthClient = {
  isMock: true,

  async restore() {
    return readStored();
  },

  async requestCode(email) {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) throw new AuthError("Enter a valid work email address.");
    return { email: trimmed, challengeSession: "mock", destination: maskEmail(trimmed) };
  },

  async submitCode(pending, code) {
    if (!/^\d{6}$/.test(code.trim())) throw new AuthError("Enter the six-digit code from the email.");
    const domain = pending.email.slice(pending.email.indexOf("@") + 1);
    const session: Session = {
      email: pending.email,
      organisationId: domain.split(".")[0],
      role: "administrator",
      isAdministrator: true,
    };
    writeStored(session);
    return session;
  },

  async signOut() {
    writeStored(null);
  },
};
