import { NextResponse } from 'next/server';
import { requireSuperAdmin, getCallerUserId } from '@/lib/auth/requireAdmin';
import { findCountry } from '@/lib/geo/countries';
import { auditLog } from '@/lib/audit/log';
import { kstDateString } from '@/lib/formatKstDate';

/**
 * GET /api/admin/users/export
 *
 * Returns every public.users row joined with their customer_profiles
 * data as a UTF-8 CSV with a BOM. Excel opens it directly with Korean
 * column headers intact.
 *
 * Returned fields (one row per registered customer):
 *   email, name, role, phone, gender, birthday, country, skin_type,
 *   marketing_consent, is_verified, registered_at
 *
 * Use case: the marketing team pulls this for email blast targeting
 * (filter by marketing_consent=true), age-bucket analysis (compute
 * from birthday), or country-segmented campaigns.
 *
 * SUPER-ADMIN only. The /admin/users/[id]/details route was already
 * gated to requireSuperAdmin because the column set contains PII
 * (phone, birthday, gender). Export ships the same PII in bulk so it
 * needs the same boundary — a regular admin operator must not be able
 * to dump every customer's PII into a spreadsheet.
 */
export async function GET() {
  const denied = await requireSuperAdmin();
  if (denied) return denied;
  // Capture the caller's Cognito sub for the audit line. requireSuperAdmin
  // has already verified the JWT so this only fails on the unhealthy
  // no-cookie edge case, which we treat as a null actor.
  const callerId = await getCallerUserId();

  try {
    const { getPgPool } = await import('@/lib/db/pool');
    const pool = getPgPool();
    const { rows } = await pool.query<{
      email: string;
      role: 'admin' | 'user';
      is_verified: boolean;
      created_at: string;
      name: string | null;
      phone: string | null;
      gender: string | null;
      birthday: string | null;
      country: string | null;
      skin_type: string | null;
      marketing_consent: boolean | null;
    }>(
      `SELECT
         u.email,
         u.role,
         u.is_verified,
         u.created_at,
         cp.name,
         cp.phone,
         cp.gender,
         cp.birthday,
         cp.country,
         cp.skin_type,
         cp.marketing_consent
       FROM public.users u
       LEFT JOIN public.customer_profiles cp ON cp.id = u.id
       ORDER BY u.created_at DESC`,
    );

    // Country code → readable Korean (English). Falls back to the raw
    // value (legacy free-text or unknown ISO) so historical rows still
    // export usefully instead of going blank.
    const renderCountry = (c: string | null): string => {
      if (!c) return '';
      const found = findCountry(c);
      return found ? `${found.nameKr} (${found.nameEn})` : c;
    };

    // CSV is RFC 4180: wrap every value in quotes, escape inner quotes
    // by doubling. Korean headers picked because the marketing team
    // works in Korean spreadsheets.
    const header = [
      '이메일', '이름', '권한', '전화번호', '성별', '생년월일',
      '국가', '피부 타입', '마케팅 동의', '이메일 인증', '가입일',
    ];
    const escape = (v: unknown): string => {
      const s = v === null || v === undefined ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [header.map(escape).join(',')];
    for (const r of rows) {
      lines.push([
        r.email,
        r.name ?? '',
        r.role === 'admin' ? '관리자' : '사용자',
        r.phone ?? '',
        r.gender ?? '',
        r.birthday ?? '',
        renderCountry(r.country),
        r.skin_type ?? '',
        r.marketing_consent ? '동의' : '',
        r.is_verified ? '인증' : '미인증',
        // KST calendar date — was UTC via toISOString().slice(0, 10),
        // which put registrations between 15:00 UTC and 24:00 UTC into
        // the previous day. A customer who signed up at 23:50 KST on
        // Jan 2 showed up as Jan 1 in the CSV, breaking cohort filters.
        r.created_at ? kstDateString(r.created_at) : '',
      ].map(escape).join(','));
    }
    // BOM so Excel auto-detects UTF-8 and the Korean headers survive.
    const body = '﻿' + lines.join('\r\n');

    const filename = `kokkok-customers-${kstDateString()}.csv`;
    // PIPA trail — bulk PII pull. Rows count only (no per-row PII in
    // the log itself); the operator's audit question is "was there a
    // large export I didn't authorize" not "which rows did they see".
    auditLog('admin.users.csv_exported', {
      actor: callerId,
      outcome: 'success',
      metadata: { row_count: rows.length },
    });
    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[admin/users/export] failed:', err);
    auditLog('admin.users.csv_exported', {
      actor: callerId,
      outcome: 'failure',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }
}
