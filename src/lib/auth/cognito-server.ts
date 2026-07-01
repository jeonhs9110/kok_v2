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
    // doesn't leak which one to the UI.
    console.error('[auth/cognito-server] signIn failed:', err);
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

export async function signUpWithCognito(
  email: string,
  password: string,
): Promise<{ ok: boolean; codeDeliveryDetails?: { destination: string; medium: string } }> {
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
    console.error('[auth/cognito-server] signUp failed:', err);
    return { ok: false };
  }
}

export async function confirmSignUpWithCognito(
  email: string,
  code: string,
): Promise<boolean> {
  try {
    const { clientId } = getEnv();
    const cmd = new ConfirmSignUpCommand({
      ClientId: clientId,
      Username: email,
      ConfirmationCode: code,
    });
    await getClient().send(cmd);
    return true;
  } catch (err) {
    console.error('[auth/cognito-server] confirmSignUp failed:', err);
    return false;
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
