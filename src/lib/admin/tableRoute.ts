import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

/**
 * Phase C2b — generic admin table route factory.
 *
 * Each per-resource route under /api/admin/<table>/route.ts exports
 * the GET / POST / PATCH / DELETE handlers returned from
 * makeAdminTableRoute(). The factory wires `requireAdmin()` at the
 * boundary and dispatches to the generic pg helpers in admin-writes.ts.
 *
 * The route ONLY accepts columns listed in `allowedColumns` — anything
 * else in the payload is silently dropped. This keeps the surface
 * explicit at the route boundary instead of relying on the DB column
 * set to reject unknowns (which, post-RLS, no longer happens).
 */

export interface AdminTableConfig {
  /** Table name in public.* — must be a known constant (NEVER user input). */
  table: string;
  /** Columns the route accepts on insert/update. Strict allow-list. */
  allowedColumns: string[];
  /** Column the LIST view orders by. Defaults to `created_at`. */
  orderBy?: string;
  /** Direction for the LIST view. Defaults to `DESC`. */
  direction?: 'ASC' | 'DESC';
  /** Columns required to be present + non-empty on POST. */
  required?: string[];
  /** Defaults merged into the payload on POST only. */
  insertDefaults?: Record<string, unknown>;
  /**
   * Set to false for tables WITHOUT an `is_active` column — disables
   * the PATCH toggle path so the route doesn't try to UPDATE a
   * non-existent column.
   */
  hasIsActive?: boolean;
}

function pickAllowed(
  body: unknown,
  allowed: string[],
): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const k of allowed) {
    if (Object.hasOwn(body as Record<string, unknown>, k)) {
      out[k] = (body as Record<string, unknown>)[k];
    }
  }
  return out;
}

function missingRequired(
  payload: Record<string, unknown>,
  required: string[],
): string | null {
  for (const r of required) {
    const v = payload[r];
    if (v === undefined || v === null) return r;
    if (typeof v === 'string' && v.trim().length === 0) return r;
  }
  return null;
}

export function makeAdminTableRoute(config: AdminTableConfig) {
  const orderBy = config.orderBy ?? 'created_at';
  const direction = config.direction ?? 'DESC';
  const hasIsActive = config.hasIsActive ?? true;

  return {
    async GET() {
      const denied = await requireAdmin();
      if (denied) return denied;
      try {
        const { genericListInPg } = await import('@/lib/db/admin-writes');
        const rows = await genericListInPg(config.table, orderBy, direction);
        return NextResponse.json({ rows });
      } catch (err) {
        console.error(`[api/admin/${config.table} GET] failed:`, err);
        return NextResponse.json({ error: 'list_failed' }, { status: 500 });
      }
    },

    async POST(request: Request) {
      const denied = await requireAdmin();
      if (denied) return denied;
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
      }
      const payload = pickAllowed(body, config.allowedColumns);
      const missing = missingRequired(payload, config.required ?? []);
      if (missing) {
        return NextResponse.json({ error: `${missing}_required` }, { status: 400 });
      }
      try {
        const { genericInsertInPg } = await import('@/lib/db/admin-writes');
        const row = await genericInsertInPg(config.table, payload, config.insertDefaults);
        if (!row) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
        return NextResponse.json({ row });
      } catch (err) {
        console.error(`[api/admin/${config.table} POST] failed:`, err);
        return NextResponse.json({ error: 'create_failed' }, { status: 500 });
      }
    },

    async PATCH(request: Request) {
      const denied = await requireAdmin();
      if (denied) return denied;
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
      }
      // Toggle-only fast path — operator clicks 활성/비활성 on the list view.
      if (
        hasIsActive
        && body
        && typeof body === 'object'
        && Object.keys(body as object).length === 1
        && typeof (body as Record<string, unknown>).is_active === 'boolean'
      ) {
        try {
          const { genericSetActiveInPg } = await import('@/lib/db/admin-writes');
          const ok = await genericSetActiveInPg(
            config.table,
            id,
            (body as { is_active: boolean }).is_active,
          );
          return NextResponse.json({ ok });
        } catch (err) {
          console.error(`[api/admin/${config.table} PATCH toggle] failed:`, err);
          return NextResponse.json({ error: 'toggle_failed' }, { status: 500 });
        }
      }
      const payload = pickAllowed(body, config.allowedColumns);
      if (Object.keys(payload).length === 0) {
        return NextResponse.json({ error: 'no_allowed_fields' }, { status: 400 });
      }
      try {
        const { genericUpdateInPg } = await import('@/lib/db/admin-writes');
        const ok = await genericUpdateInPg(config.table, id, payload);
        return NextResponse.json({ ok });
      } catch (err) {
        console.error(`[api/admin/${config.table} PATCH] failed:`, err);
        return NextResponse.json({ error: 'update_failed' }, { status: 500 });
      }
    },

    async DELETE(request: Request) {
      const denied = await requireAdmin();
      if (denied) return denied;
      const url = new URL(request.url);
      const id = url.searchParams.get('id');
      if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });
      try {
        const { genericDeleteInPg } = await import('@/lib/db/admin-writes');
        const ok = await genericDeleteInPg(config.table, id);
        return NextResponse.json({ ok });
      } catch (err) {
        console.error(`[api/admin/${config.table} DELETE] failed:`, err);
        return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
      }
    },
  };
}
