import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export async function GET() {
  if (!supabase) {
    return NextResponse.json({ show_global: true, show_domestic: false, greeting_en: '', greeting_kr: '' });
  }
  try {
    const { data } = await supabase.from('chatbot_config').select('show_global, show_domestic, greeting_en, greeting_kr').single();
    return NextResponse.json({
      show_global: data?.show_global ?? true,
      show_domestic: data?.show_domestic ?? false,
      greeting_en: data?.greeting_en ?? '',
      greeting_kr: data?.greeting_kr ?? '',
    });
  } catch {
    return NextResponse.json({ show_global: true, show_domestic: false, greeting_en: '', greeting_kr: '' });
  }
}
