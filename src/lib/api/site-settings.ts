import { supabase } from './products';

export type SiteSettingKey =
  | 'logo_url'
  | 'contact_hours'
  | 'contact_address'
  | 'contact_phone'
  | 'contact_email'
  | 'contact_overseas_email';

export async function getSiteSetting(key: SiteSettingKey): Promise<string> {
  if (!supabase) return '';
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) return '';
    return (data?.value as string) ?? '';
  } catch {
    return '';
  }
}

export async function getSiteSettings(keys: SiteSettingKey[]): Promise<Record<string, string>> {
  if (!supabase) return Object.fromEntries(keys.map(k => [k, '']));
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('key,value')
      .in('key', keys);
    if (error) return Object.fromEntries(keys.map(k => [k, '']));
    const map = Object.fromEntries(keys.map(k => [k, '']));
    for (const row of (data ?? []) as { key: string; value: string }[]) {
      map[row.key] = row.value ?? '';
    }
    return map;
  } catch {
    return Object.fromEntries(keys.map(k => [k, '']));
  }
}

export async function setSiteSetting(key: SiteSettingKey, value: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return !error;
}

export async function setSiteSettings(entries: Record<string, string>): Promise<boolean> {
  if (!supabase) return false;
  const rows = Object.entries(entries).map(([key, value]) => ({
    key, value, updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' });
  return !error;
}
