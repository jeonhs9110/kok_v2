// See src/lib/db/pool.ts for why 'server-only' is intentionally absent.
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  GlobalSignOutCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  type AuthenticationResultType,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * Phase D2 — server-side Cognito sign-in/sign-up/recovery helpers.
 *
 * One CognitoIdentityProviderClient per process. AWS SDK v3 instances
 * are cheap to construct but share an HTTP connection pool so reusing
 * the same client across requests keeps the TLS handshake amortized.
 *
 * Credentials come from the standard provider chain (instance-profile
 * on EC2, env / shared config locally). Never read AWS_* secrets
 * explicitly here.
 *
 * The pool / client ID env vars match what the Phase D verifier uses
 * (`src/lib/auth/cognito.ts`) — same Cognito User Pool for both the
 * sign-in flow (this file) and the JWT verification path (that file).
 */

interface CognitoEnv {
  region: string;
  clientId: string;
}

function getEnv(): CognitoEnv {
  const region = process.env.AWS_REGION ?? 'ap-northeast-2';
  const clientId = process.env.COGNITO_CLIENT_ID
    ?? process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      '[auth/cognito-server] COGNITO_CLIENT_ID must be set before calling ' +
      'any cognito-server helper.',
    );
  }
  return { region, clientId };
}

let _client: CognitoIdentityProviderClient | null = null;
function getClient(): CognitoIdentityProviderClient {
  if (_client) return _client;
  _client = new CognitoIdentityProviderClient({ region: getEnv().region });
  return _client;
}

export interface SignInResult {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
}

/**
 * REFRESH_TOKEN_AUTH flow — mints new ID + access tokens from a valid
 * refresh token WITHOUT re-prompting the customer for credentials.
 * Called by /api/auth/cognito/refresh when the ID token cookie has
 * expired (default 1h) but the refresh cookie (30-day) is still live.
 *
 * Returns null on any Cognito error — caller treats that as "refresh
 * token no longer valid, force sign-out." Cognito's refresh response
 * does NOT include a new RefreshToken unless the pool has token
 * rotation enabled (opt-in via Terraform); the returned struct's
 * `refreshToken` echoes the input in that case so the caller can
 * unconditionally re-set the cookie.
 */
export async function refreshWithCognito(refreshToken: string): Promise<SignInResult | null> {
  try {
    const { clientId } = getEnv();
    const cmd = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: clientId,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    });
    const res = await getClient().send(cmd);
    const r = res.AuthenticationResult;
    if (!r?.IdToken || !r.AccessToken) return null;
    return {
      idToken: r.IdToken,
      accessToken: r.AccessToken,
      // Rotation returns a fresh RefreshToken; without rotation, the
      // input token stays valid and we echo it so the caller can
      // uniformly reset the cookie.
      refreshToken: r.RefreshToken ?? refreshToken,
      expiresInSeconds: r.ExpiresIn ?? 3600,
    };
  } catch (err) {
    // Same structured-warn shape as signIn — handoff engineer can key
    // on event=auth.refresh.failed to distinguish "customer's 30-day
    // refresh window elapsed" (NotAuthorizedException) from
    // credential-stuffing during the refresh flow.
    const name = err && typeof err === 'object' && 'name' in err
      ? String((err as { name: unknown }).name)
      : 'unknown';
    console.warn(JSON.stringify({
      event: 'auth.refresh.failed',
      reason: name,
    }));
    return null;
  }
}

/**
 * USER_PASSWORD_AUTH flow — the simplest of Cognito's auth flows and
 * the one the web app client is configured for in cognito.tf. SRP
 * would be incrementally more secure (password never leaves the
 * client) but the marginal benefit over TLS is small and the
 * implementation cost is large.
 */
export async function signInWithCognito(
  email: string,
  password: string,
): Promise<SignInResult | null> {
  try {
    const { clientId } = getEnv();
    const cmd = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });
    const res = await getClient().send(cmd);
    return toSignInResult(res.AuthenticationResult);
  } catch (err) {
    // Cognito throws a typed exception for "bad credentials"
    // (NotAuthorizedException) — same surface as a wrong password
    // OR a missing user. Return null in both cases so the caller
    // doesn't leak which one to the UI. Structured log emits the
    // `.name` field only (NotAuthorized / UserNotFound / TooManyRequests
    // / NotConfirmed) so a handoff engineer triaging a sign-in spike
    // can distinguish credential-stuffing (repeated NotAuthorized from
    // a spread of hashed emails) from a JWKS/config break (Internal
    // Error) without staring at a wall of stack traces.
    const name = err && typeof err === 'object' && 'name' in err
      ? String((err as { name: unknown }).name)
      : 'unknown';
    console.warn(JSON.stringify({
      event: 'auth.signin.failed',
      reason: name,
    }));
    return null;
  }
}

function toSignInResult(r: AuthenticationResultType | undefined): SignInResult | null {
  if (!r?.IdToken || !r.AccessToken || !r.RefreshToken) return null;
  return {
    idToken: r.IdToken,
    accessToken: r.AccessToken,
    refreshToken: r.RefreshToken,
    expiresInSeconds: r.ExpiresIn ?? 3600,
  };
}

export type SignUpFailureCode =
  | 'username_exists'
  | 'weak_password'
  | 'invalid_email'
  | 'limit_exceeded'
  | 'unknown';

export type SignUpResult =
  | { ok: true; codeDeliveryDetails?: { destination: string; medium: string } }
  | { ok: false; code: SignUpFailureCode };

function mapSignUpError(err: unknown): SignUpFailureCode {
  const name = err && typeof err === 'object' && 'name' in err
    ? String((err as { name: unknown }).name)
    : '';
  switch (name) {
    case 'UsernameExistsException':
      return 'username_exists';
    case 'InvalidPasswordException':
      return 'weak_password';
    case 'InvalidParameterException':
      return 'invalid_email';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return 'limit_exceeded';
    default:
      return 'unknown';
  }
}

export async function signUpWithCognito(
  email: string,
  password: string,
): Promise<SignUpResult> {
  try {
    const { clientId } = getEnv();
    const cmd = new SignUpCommand({
      ClientId: clientId,
      Username: email,
      Password: password,
      UserAttributes: [{ Name: 'email', Value: email }],
    });
    const res = await getClient().send(cmd);
    return {
      ok: true,
      codeDeliveryDetails: res.CodeDeliveryDetails
        ? {
            destination: res.CodeDeliveryDetails.Destination ?? '',
            medium: res.CodeDeliveryDetails.DeliveryMedium ?? '',
          }
        : undefined,
    };
  } catch (err) {
    // Structured warn keyed on `.name` so a handoff engineer can
    // distinguish enumeration attempts (repeated UsernameExists from
    // one IP) from real signup failures. The email itself never
    // enters the log line.
    const name = err && typeof err === 'object' && 'name' in err
      ? String((err as { name: unknown }).name)
      : 'unknown';
    console.warn(JSON.stringify({
      event: 'auth.signup.failed',
      reason: name,
    }));
    return { ok: false, code: mapSignUpError(err) };
  }
}

export type ConfirmSignUpFailureCode =
  | 'invalid_code'
  | 'expired_code'
  | 'already_confirmed'
  | 'limit_exceeded'
  | 'user_not_found'
  | 'unknown';

export type ConfirmSignUpResult =
  | { ok: true }
  | { ok: false; code: ConfirmSignUpFailureCode };

function mapConfirmSignUpError(err: unknown): ConfirmSignUpFailureCode {
  const name = err && typeof err === 'object' && 'name' in err
    ? String((err as { name: unknown }).name)
    : '';
  switch (name) {
    case 'CodeMismatchException':
      return 'invalid_code';
    case 'ExpiredCodeException':
      return 'expired_code';
    case 'NotAuthorizedException':
      // Cognito returns NotAuthorized when the user is already
      // confirmed and the caller tries to re-confirm.
      return 'already_confirmed';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'limit_exceeded';
    case 'UserNotFoundException':
      return 'user_not_found';
    default:
      return 'unknown';
  }
}

export async function confirmSignUpWithCognito(
  email: string,
  code: string,
): Promise<ConfirmSignUpResult> {
  try {
    const { clientId } = getEnv();
    const cmd = new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
    });
    await getClient().send(cmd);
    return { ok: true };
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err
      ? String((err as { name: unknown }).name)
      : 'unknown';
    console.warn(JSON.stringify({
      event: 'auth.confirm.failed',
      reason: name,
    }));
    return { ok: false, code: mapConfirmSignUpError(err) };
  }
}

export async function resendConfirmationCodeWithCognito(email: string): Promise<boolean> {
  try {
    const { clientId } = getEnv();
    const cmd = new ResendConfirmationCodeCommand({
      ClientId: clientId,
      Username: email,
    });
    await getClient().send(cmd);
    return true;
  } catch (err) {
    console.error('[auth/cognito-server] resendConfirmationCode failed:', err);
    // Same enumeration-resistance reasoning as forgotPassword — return
    // true regardless of UserNotFound so the UI can't probe whether an
    // email is registered.
    return true;
  }
}

export async function forgotPasswordWithCognito(email: string): Promise<boolean> {
  try {
    const { clientId } = getEnv();
    const cmd = new ForgotPasswordCommand({
      ClientId: clientId,
      Username: email,
    });
    await getClient().send(cmd);
    return true;
  } catch (err) {
    console.error('[auth/cognito-server] forgotPassword failed:', err);
    // Cognito will throw UserNotFound for unknown emails; we still
    // return true so the UI can't be used to enumerate which emails
    // are registered. Real users see the same "check your email"
    // response either way.
    return true;
  }
}

export type ResetPasswordFailureCode =
  | 'invalid_code'
  | 'expired_code'
  | 'weak_password'
  | 'limit_exceeded'
  | 'unknown';

export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; code: ResetPasswordFailureCode };

/**
 * Map Cognito's `name` field on ConfirmForgotPassword failures to a
 * closed set the UI can render. The default is `unknown` so a novel
 * failure name still resolves to a safe "please try again" message.
 */
function mapResetPasswordError(err: unknown): ResetPasswordFailureCode {
  const name = err && typeof err === 'object' && 'name' in err
    ? String((err as { name: unknown }).name)
    : '';
  switch (name) {
    case 'CodeMismatchException':
      return 'invalid_code';
    case 'ExpiredCodeException':
      return 'expired_code';
    case 'InvalidPasswordException':
      return 'weak_password';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'limit_exceeded';
    default:
      return 'unknown';
  }
}

export async function resetPasswordWithCognito(
  email: string,
  code: string,
  newPassword: string,
): Promise<ResetPasswordResult> {
  try {
    const { clientId } = getEnv();
    const cmd = new ConfirmForgotPasswordCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
      Password: newPassword,
    });
    await getClient().send(cmd);
    return { ok: true };
  } catch (err) {
    console.error('[auth/cognito-server] resetPassword failed:', err);
    return { ok: false, code: mapResetPasswordError(err) };
  }
}

/**
 * Invalidates ALL of a user's tokens server-side. Cookie clearing has
 * to happen in the API route since this module doesn't touch cookies.
 */
export async function signOutFromCognito(accessToken: string): Promise<void> {
  try {
    const cmd = new GlobalSignOutCommand({ AccessToken: accessToken });
    await getClient().send(cmd);
  } catch (err) {
    // GlobalSignOut errors are not user-visible — the cookie is the
    // primary auth surface client-side; the AWS-side invalidation is
    // belt-and-suspenders.
    console.error('[auth/cognito-server] signOut failed:', err);
  }
}
