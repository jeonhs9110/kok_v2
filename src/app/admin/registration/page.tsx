'use client';

import { useState, useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import RegistrationFieldsSection from './_components/RegistrationFieldsSection';
import SocialProvidersSection from './_components/SocialProvidersSection';
import IdentityVerificationSection from './_components/IdentityVerificationSection';
import CustomerDataSection from './_components/CustomerDataSection';
import type { RegField, AuthProvider, VerificationConfig, CustomerProfile } from './_components/types';

// Session-aware client (was the bare anon client). The Phase 1 RLS
// lockdown requires the admin's JWT to ride along on every write so
// is_admin() can pass — see migration 00000000000017.
const supabase = getSupabaseBrowser();

export default function RegistrationAdminPage() {
  const [fields, setFields] = useState<RegField[]>([]);
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);
  const [verification, setVerification] = useState<VerificationConfig>({
    is_enabled: false, provider: 'nice', api_key: '', secret_key: '', merchant_id: '',
    help_url: 'https://www.niceapi.co.kr/', description_kr: '',
  });
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [privacyConsent, setPrivacyConsent] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('fields');
  const [newField, setNewField] = useState({ key: '', label_kr: '', label_en: '', type: 'text' });
  // saved-flash timers — three setTimeout sites (fields / provider /
  // verification saves) previously leaked timers if the operator
  // navigated away mid-flash. Tracked in this ref + cleared on unmount.
  const savedTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => {
    savedTimers.current.forEach(clearTimeout);
    savedTimers.current = [];
  }, []);
  function scheduleSavedClear() {
    const id = setTimeout(() => setSaved(null), 2000);
    savedTimers.current.push(id);
  }

  async function loadAll() {
    if (!supabase) { setLoading(false); return; }
    try {
      const [regRes, authRes, verRes, custRes] = await Promise.all([
        supabase.from('registration_config').select('*').single(),
        supabase.from('auth_providers_config').select('*').order('id'),
        supabase.from('identity_verification_config').select('*').single(),
        supabase.from('customer_profiles').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      if (regRes.data) {
        setFields(regRes.data.fields || []);
        setMarketingConsent(regRes.data.require_marketing_consent ?? true);
        setPrivacyConsent(regRes.data.require_privacy_consent ?? true);
      }
      if (authRes.data) setAuthProviders(authRes.data);
      if (verRes.data) setVerification({
        is_enabled: verRes.data.is_enabled ?? false,
        provider: verRes.data.provider ?? 'nice',
        api_key: verRes.data.api_key ?? '',
        secret_key: verRes.data.secret_key ?? '',
        merchant_id: verRes.data.merchant_id ?? '',
        help_url: verRes.data.help_url ?? '',
        description_kr: verRes.data.description_kr ?? '',
      });
      if (custRes.data) setCustomers(custRes.data);
    } catch { /* tables may not exist */ }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, []);

  async function saveFields() {
    if (!supabase) return;
    setSaving('fields');
    await supabase.from('registration_config').upsert({
      id: 1, fields, require_marketing_consent: marketingConsent, require_privacy_consent: privacyConsent,
    });
    setSaved('fields');
    scheduleSavedClear();
    setSaving(null);
  }

  async function saveProvider(p: AuthProvider) {
    if (!supabase) return;
    setSaving(`provider-${p.provider}`);
    await supabase.from('auth_providers_config').update({
      is_enabled: p.is_enabled,
      client_id: p.client_id,
      client_secret: p.client_secret,
    }).eq('id', p.id);
    setSaved(`provider-${p.provider}`);
    scheduleSavedClear();
    setSaving(null);
  }

  async function saveVerification() {
    if (!supabase) return;
    setSaving('verification');
    await supabase.from('identity_verification_config').upsert({
      id: 1, ...verification,
    });
    setSaved('verification');
    scheduleSavedClear();
    setSaving(null);
  }

  function toggleField(key: string) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  }
  function toggleRequired(key: string) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, required: !f.required } : f));
  }
  function removeField(key: string) {
    setFields(prev => prev.filter(f => f.key !== key));
  }
  function addField() {
    if (!newField.key || !newField.label_kr) return;
    setFields(prev => [...prev, {
      ...newField, required: false, enabled: true, removable: true,
    }]);
    setNewField({ key: '', label_kr: '', label_en: '', type: 'text' });
  }
  function moveField(index: number, dir: -1 | 1) {
    const next = [...fields];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
  }

  function updateProvider(provider: string, updates: Partial<AuthProvider>) {
    setAuthProviders(prev => prev.map(p => p.provider === provider ? { ...p, ...updates } : p));
  }

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <RegistrationFieldsSection
        fields={fields}
        newField={newField}
        marketingConsent={marketingConsent}
        privacyConsent={privacyConsent}
        openSection={openSection}
        isSaving={saving === 'fields'}
        isSaved={saved === 'fields'}
        onMoveField={moveField}
        onToggleField={toggleField}
        onToggleRequired={toggleRequired}
        onRemoveField={removeField}
        onChangeNewField={setNewField}
        onAddField={addField}
        onPrivacyConsentChange={setPrivacyConsent}
        onMarketingConsentChange={setMarketingConsent}
        onSetOpenSection={setOpenSection}
        onSave={saveFields}
      />

      <SocialProvidersSection
        providers={authProviders}
        openSection={openSection}
        saving={saving}
        saved={saved}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL}
        onUpdateProvider={updateProvider}
        onSaveProvider={saveProvider}
        onSetOpenSection={setOpenSection}
      />

      <IdentityVerificationSection
        verification={verification}
        openSection={openSection}
        isSaving={saving === 'verification'}
        isSaved={saved === 'verification'}
        onChange={setVerification}
        onSave={saveVerification}
        onSetOpenSection={setOpenSection}
      />

      <CustomerDataSection
        customers={customers}
        openSection={openSection}
        onSetOpenSection={setOpenSection}
      />
    </div>
  );
}
