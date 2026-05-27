import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Previously returned hardcoded { show_global: true, show_domestic: false }
// on every failure path, which meant the chatbot looked enabled even when
// the DB was unreachable or the chatbot_config row was missing. Now a
// failure returns 503 + null body so the client component can hide the
// chatbot entirely and the operator sees a real 5xx in CloudWatch.
export async function GET() {
  if (!supabase) {
    console.error('[chat/config] Supabase client not configured');
    return NextResponse.json({ error: 'supabase-unavailable' }, { status: 503 });
  }
  try {
    const { data, error } = await supabase
      .from('chatbot_config')
      .select('show_global, show_domestic, greeting_en, greeting_kr')
      .single();
    if (error) throw error;
    if (!data) {
      // Row missing — chatbot is intentionally not configured. Tell the
      // client to hide it rather than silently defaulting to "enabled".
      return NextResponse.json({ show_global: false, show_domestic: false, greeting_en: '', greeting_kr: '' });
    }
    return NextResponse.json({
      show_global: data.show_global ?? false,
      show_domestic: data.show_domestic ?? false,
      greeting_en: data.greeting_en ?? '',
      greeting_kr: data.greeting_kr ?? '',
    });
  } catch (err) {
    console.error('[chat/config] DB fetch failed:', err);
    return NextResponse.json({ error: 'fetch-failed' }, { status: 503 });
  }
}
