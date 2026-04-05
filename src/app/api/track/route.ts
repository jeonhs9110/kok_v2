import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function POST(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });

    const { path, referrer } = await req.json();
    const country = req.headers.get('x-vercel-ip-country') || req.headers.get('x-user-country') || 'UNKNOWN';

    await supabase.from('analytics').insert([{
      country,
      path: path || '/',
      referrer: referrer || null,
    }]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
