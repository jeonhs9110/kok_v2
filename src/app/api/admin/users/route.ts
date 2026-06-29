import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

/**
 * GET /api/admin/users
 * Admin-only list of public.users rows for the /admin/users page.
 *
 * 2026-06-30: dropped the Supabase fallback branch. It was `select('*')`
 * which leaked PII (phone, birthday, skin_type, etc.) to any admin —
 * the pg branch already projects to id/email/role/is_verified/created_at
 * (the only columns the admin table actually renders). Post-cutoff
 * USE_RDS=true is the only live path, so the dead branch is gone.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { getAllUsersFromPg } = await import('@/lib/db/storefront-reads');
    const users = await getAllUsersFromPg();
    return NextResponse.json({ users, source: 'rds' });
  } catch (err) {
    console.error('[admin/users] pg list failed:', err);
    return NextResponse.json({ users: [], source: 'rds_error' }, { status: 500 });
  }
}
