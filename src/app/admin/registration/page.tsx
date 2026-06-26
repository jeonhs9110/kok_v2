'use client';

import { useState, useEffect, useRef } from 'react';
import RegistrationFieldsSection from './_components/RegistrationFieldsSection';
import SocialProvidersSection from './_components/SocialProvidersSection';
import IdentityVerificationSection from './_components/IdentityVerificationSection';
import CustomerDataSection from './_components/CustomerDataSection';
import type { RegField, AuthProvider, VerificationConfig, CustomerProfile } from './_components/types';

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
    try {
      const [regRes, authRes, verRes, custRes] = await Promise.all([
        fetch('/api/admin/crud/registration_config?orderBy=id&direction=ASC', { cache: 'no-store' }),
        fetch('/api/admin/crud/auth_providers_config?orderBy=id&direction=ASC', { cache: 'no-store' }),
        fetch('/api/admin/crud/identity_verification_config?orderBy=id&direction=ASC', { cache: 'no-store' }),
        // customer_profiles isn't in the generic CRUD allow-list (PII). Use the existing admin-users
        // route plus the customer-profile read endpoint when this page actually needs it. For now,
        // leave the list empty until /api/admin/customer-profiles is wired (separate handoff item).
        Promise.resolve(null),
      ]);
      if (regRes.ok) {
        const j = (await regRes.json()) as { rows?: { fields?: RegField[]; require_marketing_consent?: boolean; require_privacy_consent?: boolean }[] };
        const reg = (j.rows ?? [])[0];
        if (reg) {
          setFields(reg.fields ?? []);
          setMarketingConsent(reg.require_marketing_consent ?? true);
          setPrivacyConsent(reg.require_privacy_consent ?? true);
        }
      }
      if (authRes.ok) {
        const j = (await authRes.json()) as { rows?: AuthProvider[] };
        if (j.rows) setAuthProviders(j.rows);
      }
      if (verRes.ok) {
        const j = (await verRes.json()) as { rows?: Partial<VerificationConfig>[] };
        const ver = (j.rows ?? [])[0];
        if (ver) setVerification({
          is_enabled: ver.is_enabled ?? false,
          provider: ver.provider ?? 'nice',
          api_key: ver.api_key ?? '',
          secret_key: ver.secret_key ?? '',
          merchant_id: ver.merchant_id ?? '',
          help_url: ver.help_url ?? '',
          description_kr: ver.description_kr ?? '',
        });
      }
      // custRes intentionally null — see comment in Promise.all above.
      void custRes;
      setCustomers([]);
    } catch { /* tables may not exist */ }
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadAll(); }, []);

  async function upsertConfig(table: string, body: Record<string, unknown>): Promise<void> {
    const patchRes = await fetch(`/api/admin/crud/${table}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, patch: body }),
    });
    if (!patchRes.ok) {
      await fetch(`/api/admin/crud/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, ...body }),
      });
    }
  }

  async function saveFields() {
    setSaving('fields');
    await upsertConfig('registration_config', {
      fields, require_marketing_consent: marketingConsent, require_privacy_consent: privacyConsent,
    });
    setSaved('fields');
    scheduleSavedClear();
    setSaving(null);
  }

  async function saveProvider(p: AuthProvider) {
    setSaving(`provider-${p.provider}`);
    await fetch('/api/admin/crud/auth_providers_config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id,
        patch: { is_enabled: p.is_enabled, client_id: p.client_id, client_secret: p.client_secret },
      }),
    });
    setSaved(`provider-${p.provider}`);
    scheduleSavedClear();
    setSaving(null);
  }

  async function saveVerification() {
    setSaving('verification');
    await upsertConfig('identity_verification_config', { ...verification });
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
