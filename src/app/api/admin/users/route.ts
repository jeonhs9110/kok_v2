import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * GET /api/admin/users
 * Admin-only list of public.users rows for the /admin/users page.
 * Dispatches to RDS when USE_RDS=true, falls back to Supabase otherwise.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (process.env.USE_RDS === 'true') {
    try {
      const { getAllUsersFromPg } = await import('@/lib/db/storefront-reads');
      const users = await getAllUsersFromPg();
      return NextResponse.json({ users, source: 'rds' });
    } catch (err) {
      console.error('[admin/users] pg list failed:', err);
      return NextResponse.json({ users: [], source: 'rds_error' }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ users: [], source: 'supabase_missing' }, { status: 500 });
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[admin/users] supabase list failed:', error);
    return NextResponse.json({ users: [], source: 'supabase_error' }, { status: 500 });
  }
  return NextResponse.json({ users: data ?? [], source: 'supabase' });
}
