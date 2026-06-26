import 'server-only';
import {
  CognitoIdentityProviderClient,
  AdminDeleteUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
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
export async function findCognitoUsernameByEmail(email: string): Promise<string | null> {
  if (!email) return null;
  try {
    const res = await getClient().send(new ListUsersCommand({
      UserPoolId: ensurePool(),
      Filter: `email = "${email.replace(/"/g, '\\"')}"`,
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
