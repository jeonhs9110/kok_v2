import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';

/**
 * POST /api/customer/chatbot-leads
 *
 * Receives the lead-capture form payload submitted from inside the
 * storefront AI chatbot widget (`<AIChatbot />`). Used by the
 * "I'd like to connect you with our support team" escalation flow.
 *
 * Body: { email: string, name?: string, skin_type?: string, country?: string }
 * Returns: { ok: boolean }
 *
 * Anonymous — chatbot leads come from walk-up visitors, no Cognito
 * session expected. Per-IP rate limit: 5 leads per hour. A real user
 * submitting one form will never trip it; a bot trying to spam the
 * marketing-leads table gets a quiet 429.
 *
 * 2026-06-29: previously the storefront chatbot wrote DIRECTLY to
 * `supabase.from('chatbot_leads').insert(...)`. After the 2026-06-27
 * Supabase decommission, every lead submission silently failed
 * (handleContactSubmit caught the error and showed the "Thanks!"
 * message anyway), so the operator hasn't received any leads from
 * the chatbot for several days. This route restores the write path
 * via the standard USE_RDS dispatcher.
 */

const MAX_EMAIL_LEN = 320;
const MAX_NAME_LEN = 100;
const MAX_SKIN_LEN = 50;
const MAX_COUNTRY_LEN = 50;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const leadsLimiter = createRateLimiter({
  name: 'chatbot_leads',
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

export async function POST(req: Request) {
  if (!leadsLimiter.check(getRequestIp(req))) {
    return NextResponse.json({ ok: false, error: 'too_many_requests' }, { status: 429 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }
  const { email, name, skin_type, country } = body as {
    email?: unknown; name?: unknown; skin_type?: unknown; country?: unknown;
  };

  const emailStr = typeof email === 'string' ? email.trim().slice(0, MAX_EMAIL_LEN) : '';
  if (!emailStr || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailStr)) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 });
  }
  const nameStr     = typeof name      === 'string' && name.trim()      ? name.trim().slice(0, MAX_NAME_LEN)         : null;
  const skinStr     = typeof skin_type === 'string' && skin_type.trim() ? skin_type.trim().slice(0, MAX_SKIN_LEN)    : null;
  const countryStr  = typeof country   === 'string' && country.trim()   ? country.trim().slice(0, MAX_COUNTRY_LEN)   : null;

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      await pool.query(
        `INSERT INTO public.chatbot_leads (name, email, skin_type, country)
           VALUES ($1, $2, $3, $4)`,
        [nameStr, emailStr, skinStr, countryStr],
      );
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[customer/chatbot-leads] pg insert failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('chatbot_leads').insert({
    name: nameStr, email: emailStr, skin_type: skinStr, country: countryStr,
  });
  if (error) {
    console.error('[customer/chatbot-leads] supabase insert failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
