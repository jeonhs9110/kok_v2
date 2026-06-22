import 'server-only';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

/**
 * Phase D — Cognito JWT verification.
 *
 * One CognitoJwtVerifier instance per process. The library caches the
 * JWKS automatically (refreshes every 10 minutes by default) so the
 * verifier itself is hot-path cheap.
 *
 * AWS_REGION + COGNITO_USER_POOL_ID + COGNITO_CLIENT_ID come from the
 * outputs of `infrastructure/cognito.tf`. NEXT_PUBLIC_* mirrors of
 * these are added to .env.example so the browser-side sign-in flow
 * (added in a later phase) can also reach the pool — server code
 * keeps reading the non-public versions so a misconfigured deploy
 * fails fast instead of silently falling through to a wrong pool.
 *
 * This module is `server-only` — the verifier never touches the
 * browser bundle.
 */

interface CognitoIdClaims {
  sub: string;
  email?: string;
  'cognito:groups'?: string[];
  'cognito:username'?: string;
  email_verified?: boolean;
  exp: number;
  iat: number;
}

let _verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (_verifier) return _verifier;
  const userPoolId = process.env.COGNITO_USER_POOL_ID
    ?? process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID
    ?? process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!userPoolId || !clientId) {
    throw new Error(
      '[auth/cognito] COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set ' +
      'before calling verifyCognitoIdToken / verifyCognitoAccessToken.',
    );
  }
  _verifier = CognitoJwtVerifier.create({
    userPoolId,
    clientId,
    tokenUse: 'id',
  });
  return _verifier;
}

/**
 * Verify a Cognito ID token and return its claims.
 *
 * Returns null on every failure path (expired, wrong audience, JWKS
 * fetch failure, malformed token) — callers should treat null as
 * "unauthenticated" without trying to distinguish reasons. Specific
 * failures are logged server-side.
 */
export async function verifyCognitoIdToken(token: string): Promise<CognitoIdClaims | null> {
  try {
    const payload = await getVerifier().verify(token);
    return payload as unknown as CognitoIdClaims;
  } catch (err) {
    console.error('[auth/cognito] id token verification failed:', err);
    return null;
  }
}

/**
 * Convenience helper: parse the `cognito:groups` claim and tell us
 * whether the user is in the admins group. Other phases of the app
 * gate on `users.role === 'admin'` from Supabase; under Cognito we
 * lean on group membership (`infrastructure/cognito.tf` creates the
 * `admins` group at apply time).
 */
export function isAdminFromCognito(claims: CognitoIdClaims | null): boolean {
  if (!claims) return false;
  const groups = claims['cognito:groups'];
  if (!Array.isArray(groups)) return false;
  return groups.includes('admins');
}

export type { CognitoIdClaims };
