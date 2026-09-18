import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { mockAuth, type AuthClient, type PendingSignIn, type Session } from "./auth";
import { cognitoAuth } from "./cognito";

/**
 * The BMS signs into its own Cognito pool, which holds the platform root and
 * nobody else - membership is what keeps customer accounts out. A public
 * client id in a public bundle is normal; defaulting it here means a deploy
 * needs no extra configuration. VITE_* variables override it.
 */
const DEFAULT_COGNITO = {
  region: "ap-south-1",
  userPoolId: "ap-south-1_60AUTnpEV",
  clientId: "6ihjip0v3j01c9ct30172rkins",
};

function chooseClient(): AuthClient {
  const env = import.meta.env;
  if (env.VITE_AUTH_MOCK === "1") return mockAuth;
  return cognitoAuth({
    region: env.VITE_AWS_REGION || DEFAULT_COGNITO.region,
    userPoolId: env.VITE_COGNITO_USER_POOL_ID || DEFAULT_COGNITO.userPoolId,
    clientId: env.VITE_COGNITO_CLIENT_ID || DEFAULT_COGNITO.clientId,
  });
}

const client = chooseClient();

interface AuthState {
  session: Session | null;
  loading: boolean;
  isMock: boolean;
  requestCode(email: string): Promise<PendingSignIn>;
  submitCode(pending: PendingSignIn, code: string): Promise<void>;
  signOut(): Promise<void>;
  /** The signed-in user's ID token, for calls to the BMS API. */
  idToken(): string | null;
}

const AuthContext = createContext<AuthState | null>(null);

function readIdToken(): string | null {
  try {
    const raw = window.localStorage.getItem("reconflow.tokens");
    return raw ? ((JSON.parse(raw) as { idToken?: string }).idToken ?? null) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    client
      .restore()
      .then((restored) => {
        if (active) setSession(restored);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const requestCode = useCallback((email: string) => client.requestCode(email), []);
  const submitCode = useCallback(async (pending: PendingSignIn, code: string) => {
    setSession(await client.submitCode(pending, code));
  }, []);
  const signOut = useCallback(async () => {
    await client.signOut();
    setSession(null);
  }, []);
  const idToken = useCallback(() => (client.isMock ? "mock" : readIdToken()), []);

  const value = useMemo<AuthState>(
    () => ({ session, loading, isMock: client.isMock, requestCode, submitCode, signOut, idToken }),
    [session, loading, requestCode, submitCode, signOut, idToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
