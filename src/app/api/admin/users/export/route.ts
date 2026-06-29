import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { findCountry } from '@/lib/geo/countries';

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
 * Admin-only — gated by requireAdmin(). The same row set the admin
 * already has access to via /admin/users; export adds a download
 * instead of forcing them to copy-paste rows.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

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
        // ISO-8601 KST date — same shape as the admin user list display.
        r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
      ].map(escape).join(','));
    }
    // BOM so Excel auto-detects UTF-8 and the Korean headers survive.
    const body = '﻿' + lines.join('\r\n');

    const filename = `kokkok-customers-${new Date().toISOString().slice(0, 10)}.csv`;
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
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }
}
