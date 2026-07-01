import 'server-only';
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUserGlobalSignOutCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * Admin-side Cognito operations used by /api/admin/users routes.
 * EC2 role kokkok-ec2-role must have cognito-idp Admin* perms on the
 * user pool. Without those grants these calls AccessDeniedException,
 * which the routes log and bubble up as 500.
 */

const REGION = process.env.AWS_REGION ?? 'ap-northeast-2';
const POOL_ID = process.env.COGNITO_USER_POOL_ID
  ?? process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID
  ?? '';

let _client: CognitoIdentityProviderClient | null = null;
function getClient(): CognitoIdentityProviderClient {
  if (_client) return _client;
  _client = new CognitoIdentityProviderClient({ region: REGION });
  return _client;
}

function ensurePool(): string {
  if (!POOL_ID) throw new Error('COGNITO_USER_POOL_ID not set');
  return POOL_ID;
}

/**
 * Find the Cognito user that owns the given email. Returns the
 * Cognito username (a uuid-shaped sub for email-attribute pools) or
 * null when not found.
 */
// RFC-5322-ish email shape. Rejects control chars, whitespace, and
// any character Cognito filter grammar treats specially — so the
// filter-injection surface below is closed at the boundary instead
// of trying to escape every metacharacter.
const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;

export async function findCognitoUsernameByEmail(email: string): Promise<string | null> {
  if (!email) return null;
  // Reject anything that isn't a legitimate email BEFORE building
  // the Cognito filter. Prior code only escaped `"` but left `\`
  // through — an attacker-supplied email with a backslash could
  // alter the filter grammar and match a different user, causing
  // the caller (deleteCognitoUserByEmail / group ops) to hit the
  // wrong Cognito identity.
  if (!EMAIL_RE.test(email)) return null;
  try {
    const res = await getClient().send(new ListUsersCommand({
      UserPoolId: ensurePool(),
      // Belt-and-suspenders escape: even with EMAIL_RE guarding above,
      // escape backslash BEFORE quote so an unlikely regex-passing
      // email containing `\` can't inject an escape.
      Filter: `email = "${email.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
      Limit: 1,
    }));
    return res.Users?.[0]?.Username ?? null;
  } catch (err) {
    console.error('[cognito-admin] findUsernameByEmail failed:', err);
    return null;
  }
}

export async function deleteCognitoUserByEmail(email: string): Promise<boolean> {
  const username = await findCognitoUsernameByEmail(email);
  if (!username) return false;
  try {
    await getClient().send(new AdminDeleteUserCommand({
      UserPoolId: ensurePool(),
      Username: username,
    }));
    return true;
  } catch (err) {
    console.error('[cognito-admin] deleteUserByEmail failed:', err);
    return false;
  }
}

export async function addUserToGroup(email: string, groupName: string): Promise<boolean> {
  const username = await findCognitoUsernameByEmail(email);
  if (!username) return false;
  try {
    await getClient().send(new AdminAddUserToGroupCommand({
      UserPoolId: ensurePool(),
      Username: username,
      GroupName: groupName,
    }));
    return true;
  } catch (err) {
    console.error('[cognito-admin] addUserToGroup failed:', err);
    return false;
  }
}

export async function removeUserFromGroup(email: string, groupName: string): Promise<boolean> {
  const username = await findCognitoUsernameByEmail(email);
  if (!username) return false;
  try {
    await getClient().send(new AdminRemoveUserFromGroupCommand({
      UserPoolId: ensurePool(),
      Username: username,
      GroupName: groupName,
    }));
    return true;
  } catch (err) {
    console.error('[cognito-admin] removeUserFromGroup failed:', err);
    return false;
  }
}

/**
 * Invalidate every outstanding token for the target user. Group
 * membership + role changes are baked into a JWT at issuance and
 * Cognito does NOT rotate them on group mutation — so a demoted
 * admin's cookie still carries `cognito:groups: ['admins']` for up
 * to the token TTL (1h default). Same story for a password reset:
 * without a global sign-out, an attacker who stole the refresh token
 * before the reset can mint fresh access tokens for the full 30-day
 * refresh window even after the customer changed their password.
 *
 * Best-effort — logs on failure but doesn't throw; the caller has
 * already committed the DB / password change.
 */
export async function globalSignOutByEmail(email: string): Promise<boolean> {
  const username = await findCognitoUsernameByEmail(email);
  if (!username) return false;
  try {
    await getClient().send(new AdminUserGlobalSignOutCommand({
      UserPoolId: ensurePool(),
      Username: username,
    }));
    return true;
  } catch (err) {
    console.error('[cognito-admin] globalSignOutByEmail failed:', err);
    return false;
  }
}
