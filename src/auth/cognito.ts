import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  type AuthenticationResultType,
} from "@aws-sdk/client-cognito-identity-provider";
import { AuthError, EMAIL_RE, isAdministrator, type AuthClient, type Session, type UserRole } from "./auth";

export interface CognitoConfig {
  readonly region: string;
  readonly userPoolId: string;
  readonly clientId: string;
}

interface StoredTokens {
  readonly idToken: string;
  readonly accessToken: string;
  readonly refreshToken?: string;
}

const TOKENS_KEY = "reconflow.tokens";
/** Refresh this long before the ID token actually expires. */
const REFRESH_MARGIN_MS = 60_000;

function readTokens(): StoredTokens | null {
  try {
    const raw = window.localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as StoredTokens) : null;
  } catch {
    return null;
  }
}

function writeTokens(tokens: StoredTokens | null): void {
  try {
    if (tokens) window.localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    else window.localStorage.removeItem(TOKENS_KEY);
  } catch {
    // Non-fatal: the session will not survive a reload.
  }
}

interface IdTokenClaims {
  readonly email: string;
  readonly name?: string;
  readonly exp: number;
  readonly "custom:org"?: string;
  readonly "custom:role"?: string;
}

/** The ID token is verified by Cognito on issue; here it is only read. */
function claimsOf(idToken: string): IdTokenClaims {
  const payload = idToken.split(".")[1] ?? "";
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as IdTokenClaims;
}

function sessionFrom(idToken: string): Session {
  const claims = claimsOf(idToken);
  const role = (claims["custom:role"] ?? "reviewer") as UserRole;
  return {
    email: claims.email,
    name: claims.name,
    organisationId: claims["custom:org"] ?? "",
    role,
    isAdministrator: isAdministrator(role),
    expiresAt: new Date(claims.exp * 1000).toISOString(),
  };
}

function storeResult(result: AuthenticationResultType | undefined, previous?: StoredTokens | null): Session {
  if (!result?.IdToken || !result.AccessToken) throw new AuthError("Sign-in did not complete. Try again.");
  writeTokens({
    idToken: result.IdToken,
    accessToken: result.AccessToken,
    // A refresh does not return a new refresh token; keep the one we have.
    refreshToken: result.RefreshToken ?? previous?.refreshToken,
  });
  return sessionFrom(result.IdToken);
}

function friendly(error: unknown): AuthError {
  const name = (error as { name?: string })?.name ?? "";
  switch (name) {
    case "CodeMismatchException":
      return new AuthError("That code is not right. Check the email and try again.");
    case "ExpiredCodeException":
      return new AuthError("That code has expired. Send a new one.");
    case "NotAuthorizedException":
      // Reached after the third wrong code, or once the code has expired.
      return new AuthError("That code has expired or been tried too many times. Send a new code.");
    case "UserNotFoundException":
      return new AuthError("User does not exist. No ReconFlow account uses that email address here.");
    case "LimitExceededException":
    case "TooManyRequestsException":
      return new AuthError("Too many attempts. Wait a moment and try again.");
    default:
      return new AuthError("Could not sign in. Try again.");
  }
}

export function cognitoAuth(config: CognitoConfig): AuthClient {
  const client = new CognitoIdentityProviderClient({ region: config.region });

  return {
    isMock: false,

    async restore() {
      const tokens = readTokens();
      if (!tokens) return null;

      const expiresAt = claimsOf(tokens.idToken).exp * 1000;
      if (expiresAt - REFRESH_MARGIN_MS > Date.now()) return sessionFrom(tokens.idToken);
      if (!tokens.refreshToken) {
        writeTokens(null);
        return null;
      }
      try {
        const refreshed = await client.send(
          new InitiateAuthCommand({
            AuthFlow: "REFRESH_TOKEN_AUTH",
            ClientId: config.clientId,
            AuthParameters: { REFRESH_TOKEN: tokens.refreshToken },
          }),
        );
        return storeResult(refreshed.AuthenticationResult, tokens);
      } catch {
        writeTokens(null);
        return null;
      }
    },

    async requestCode(email) {
      const username = email.trim().toLowerCase();
      if (!EMAIL_RE.test(username)) throw new AuthError("Enter a valid work email address.");

      try {
        // CUSTOM_AUTH runs the pool's triggers: they mint a six-digit code,
        // email it, and hand back a challenge to answer. Every call starts a
        // fresh session and a fresh code.
        const response = await client.send(
          new InitiateAuthCommand({
            AuthFlow: "CUSTOM_AUTH",
            ClientId: config.clientId,
            AuthParameters: { USERNAME: username },
          }),
        );
        if (response.ChallengeName !== "CUSTOM_CHALLENGE" || !response.Session) {
          throw new AuthError("Email codes are not available for this account.");
        }
        return {
          email: username,
          challengeSession: response.Session,
          destination: response.ChallengeParameters?.destination,
          // Cognito answers with its own id for the user; that is what the
          // challenge response must carry.
          username: response.ChallengeParameters?.USERNAME,
          isDemo: response.ChallengeParameters?.demo === "true",
        };
      } catch (error) {
        throw error instanceof AuthError ? error : friendly(error);
      }
    },

    async submitCode(pending, code) {
      const trimmed = code.trim();
      if (!/^\d{6}$/.test(trimmed)) throw new AuthError("Enter the six-digit code from the email.");
      try {
        const response = await client.send(
          new RespondToAuthChallengeCommand({
            ClientId: config.clientId,
            ChallengeName: "CUSTOM_CHALLENGE",
            Session: pending.challengeSession,
            ChallengeResponses: { USERNAME: pending.username ?? pending.email, ANSWER: trimmed },
          }),
        );
        if (!response.AuthenticationResult) {
          // A wrong code comes back as another challenge under a new session,
          // not as an error. The next attempt must answer that session, and
          // the code itself is unchanged - the triggers re-issue it.
          throw new AuthError(
            "That code is not right. Check the email and try again.",
            response.Session ? { ...pending, challengeSession: response.Session } : undefined,
          );
        }
        return storeResult(response.AuthenticationResult);
      } catch (error) {
        throw error instanceof AuthError ? error : friendly(error);
      }
    },

    async signOut() {
      writeTokens(null);
    },
  };
}
