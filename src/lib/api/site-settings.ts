import { supabase } from './products';

// Note: contact_* keys (hours/address/phone/email/overseas_email) used to live
// here, edited via /admin/contact and read by the public /contact page. That
// duplicated the data in `business_info` (which the footer + legal pages need
// anyway). To prevent the two sources from drifting (and historically
// displaying different phone numbers!), contact info is now solely managed
// from /admin/legal -> business_info. Existing rows in site_settings with
// these keys can be left behind; nothing reads them.
export type SiteSettingKey = 'logo_url';

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
