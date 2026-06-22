import type { SupabaseClient } from '@supabase/supabase-js';
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
  if (process.env.USE_RDS === 'true') {
    try {
      const { getSiteSettingFromPg } = await import('@/lib/db/storefront-reads');
      const v = await getSiteSettingFromPg(key);
      return typeof v === 'string' ? v : '';
    } catch (err) {
      console.error('[site-settings] RDS getSiteSetting failed:', err);
      return '';
    }
  }
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
  if (process.env.USE_RDS === 'true') {
    try {
      const { getSiteSettingsFromPg } = await import('@/lib/db/storefront-reads');
      const raw = await getSiteSettingsFromPg(keys);
      const out = Object.fromEntries(keys.map(k => [k, '']));
      for (const k of keys) {
        const v = raw[k];
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    } catch (err) {
      console.error('[site-settings] RDS getSiteSettings failed:', err);
      return Object.fromEntries(keys.map(k => [k, '']));
    }
  }
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

// Writes require a session-aware client (admin's JWT must ride along
// to satisfy the Phase 2 RLS admin_write policy on site_settings).
// Callers should pass their own getSupabaseBrowser() client.
//
// Under USE_RDS=true the `client` arg is ignored — pg bypasses RLS and
// the admin check happens at the API-route boundary (Phase D). Callers
// keep passing the client so the call sites stay unchanged across the
// cutover.
export async function setSiteSetting(client: SupabaseClient, key: SiteSettingKey, value: string): Promise<boolean> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { setSiteSettingInPg } = await import('@/lib/db/admin-writes');
      return await setSiteSettingInPg(key, value);
    } catch (err) {
      console.error('[site-settings] RDS setSiteSetting failed:', err);
      return false;
    }
  }
  const { error } = await client
    .from('site_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return !error;
}

export async function setSiteSettings(client: SupabaseClient, entries: Record<string, string>): Promise<boolean> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { setSiteSettingsInPg } = await import('@/lib/db/admin-writes');
      return await setSiteSettingsInPg(entries);
    } catch (err) {
      console.error('[site-settings] RDS setSiteSettings failed:', err);
      return false;
    }
  }
  const rows = Object.entries(entries).map(([key, value]) => ({
    key, value, updated_at: new Date().toISOString(),
  }));
  const { error } = await client.from('site_settings').upsert(rows, { onConflict: 'key' });
  return !error;
}
