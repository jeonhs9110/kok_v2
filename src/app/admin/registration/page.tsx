'use client';

import { useState, useEffect, useRef } from 'react';
import RegistrationFieldsSection from './_components/RegistrationFieldsSection';
import SocialProvidersSection from './_components/SocialProvidersSection';
import IdentityVerificationSection from './_components/IdentityVerificationSection';
import CustomerDataSection from './_components/CustomerDataSection';
import type { RegField, AuthProvider, VerificationConfig, CustomerProfile } from './_components/types';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useIsDirty } from '@/hooks/useIsDirty';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';

export default function RegistrationAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [fields, setFields] = useState<RegField[]>([]);
  const [authProviders, setAuthProviders] = useState<AuthProvider[]>([]);
  const [verification, setVerification] = useState<VerificationConfig>({
    is_enabled: false, provider: 'nice', api_key: '', secret_key: '', merchant_id: '',
    help_url: 'https://www.niceapi.co.kr/', description_kr: '',
  });
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [marketingConsent, setMarketingConsent] = useState(true);
  const [privacyConsent, setPrivacyConsent] = useState(true);
  // Snapshots of the saved state per section. `isDirty` is true if any
  // current section state diverges from its snapshot — drives the
  // "leave without saving?" prompt. Snapshots get refreshed after each
  // successful save so subsequent edits track from the new baseline.
  const [savedFields, setSavedFields] = useState<{ fields: RegField[]; marketing: boolean; privacy: boolean }>({
    fields: [], marketing: true, privacy: true,
  });
  const [savedProviders, setSavedProviders] = useState<AuthProvider[]>([]);
  const [savedVerification, setSavedVerification] = useState<VerificationConfig>({
    is_enabled: false, provider: 'nice', api_key: '', secret_key: '', merchant_id: '',
    help_url: 'https://www.niceapi.co.kr/', description_kr: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string>('fields');
  const [newField, setNewField] = useState({ key: '', label_kr: '', label_en: '', type: 'text' });

  const fieldsDirty = useIsDirty(
    { fields, marketing: marketingConsent, privacy: privacyConsent },
    savedFields,
  );
  const providersDirty = useIsDirty(authProviders, savedProviders);
  const verificationDirty = useIsDirty(verification, savedVerification);
  useUnsavedChanges(fieldsDirty || providersDirty || verificationDirty);
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
          const loadedFields = reg.fields ?? [];
          const loadedMarketing = reg.require_marketing_consent ?? true;
          const loadedPrivacy = reg.require_privacy_consent ?? true;
          setFields(loadedFields);
          setMarketingConsent(loadedMarketing);
          setPrivacyConsent(loadedPrivacy);
          setSavedFields({ fields: loadedFields, marketing: loadedMarketing, privacy: loadedPrivacy });
        }
      }
      if (authRes.ok) {
        const j = (await authRes.json()) as { rows?: AuthProvider[] };
        if (j.rows) {
          setAuthProviders(j.rows);
          setSavedProviders(j.rows);
        }
      }
      if (verRes.ok) {
        const j = (await verRes.json()) as { rows?: Partial<VerificationConfig>[] };
        const ver = (j.rows ?? [])[0];
        if (ver) {
          const loadedVer = {
            is_enabled: ver.is_enabled ?? false,
            provider: ver.provider ?? 'nice',
            api_key: ver.api_key ?? '',
            secret_key: ver.secret_key ?? '',
            merchant_id: ver.merchant_id ?? '',
            help_url: ver.help_url ?? '',
            description_kr: ver.description_kr ?? '',
          };
          setVerification(loadedVer);
          setSavedVerification(loadedVer);
        }
      }
      // custRes intentionally null — see comment in Promise.all above.
      void custRes;
      setCustomers([]);
    } catch { /* tables may not exist */ }
    setLoading(false);
  }

  useEffect(() => { loadAll(); }, []);

  async function upsertConfig(table: string, body: Record<string, unknown>): Promise<void> {
    // Singleton row (id=1). Patch first; ONLY fall back to POST on 404
    // (row missing). Previously any non-OK status fell through to POST,
    // which can also fail silently — and both errors were swallowed,
    // so the operator saw a green "saved" flash while RDS held the old
    // value. Throw on real failures so the calling save* function can
    // surface a toast.
    const patchRes = await fetch(`/api/admin/crud/${table}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 1, patch: body }),
    });
    if (!patchRes.ok && patchRes.status !== 404) {
      throw new Error(`${table}_patch_${patchRes.status}`);
    }
    if (patchRes.status === 404) {
      const postRes = await fetch(`/api/admin/crud/${table}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, ...body }),
      });
      if (!postRes.ok) throw new Error(`${table}_post_${postRes.status}`);
    }
  }

  async function saveFields() {
    setSaving('fields');
    try {
      await upsertConfig('registration_config', {
        fields, require_marketing_consent: marketingConsent, require_privacy_consent: privacyConsent,
      });
      setSavedFields({ fields, marketing: marketingConsent, privacy: privacyConsent });
      setSaved('fields');
      scheduleSavedClear();
      toast.show('회원가입 설정이 저장되었습니다.', 'success');
    } catch (err) {
      console.error('[admin/registration] saveFields failed:', err);
      toast.show('저장에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setSaving(null);
    }
  }

  async function saveProvider(p: AuthProvider) {
    setSaving(`provider-${p.provider}`);
    try {
      const res = await fetch('/api/admin/crud/auth_providers_config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: p.id,
          patch: { is_enabled: p.is_enabled, client_id: p.client_id, client_secret: p.client_secret },
        }),
      });
      if (!res.ok) throw new Error(`auth_provider_patch_${res.status}`);
      setSavedProviders(authProviders);
      setSaved(`provider-${p.provider}`);
      scheduleSavedClear();
      toast.show('소셜 로그인 설정이 저장되었습니다.', 'success');
    } catch (err) {
      console.error('[admin/registration] saveProvider failed:', err);
      toast.show('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(null);
    }
  }

  async function saveVerification() {
    setSaving('verification');
    try {
      await upsertConfig('identity_verification_config', { ...verification });
      setSavedVerification(verification);
      setSaved('verification');
      scheduleSavedClear();
      toast.show('본인인증 설정이 저장되었습니다.', 'success');
    } catch (err) {
      console.error('[admin/registration] saveVerification failed:', err);
      toast.show('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(null);
    }
  }

  function toggleField(key: string) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  }
  function toggleRequired(key: string) {
    setFields(prev => prev.map(f => f.key === key ? { ...f, required: !f.required } : f));
  }
  async function removeField(key: string) {
    // Confirm before deletion. removable=true fields include phone,
    // gender, birthday, country, skin_type — none are required for
    // signup to function, but a misclick removes them from the customer-
    // facing form and silently breaks the marketing team's PII pipeline.
    const field = fields.find(f => f.key === key);
    const label = field ? (field.label_kr || field.key) : key;
    const ok = await confirm({
      message: `'${label}' 필드를 회원가입 양식에서 제거하시겠습니까?\n저장 시 즉시 적용되며 기존 데이터는 유지됩니다.`,
      tone: 'danger',
      confirmText: '제거',
    });
    if (!ok) return;
    setFields(prev => prev.filter(f => f.key !== key));
  }
  function addField() {
    if (!newField.key || !newField.label_kr) {
      toast.show(
        !newField.key ? '필드 키(key)를 입력해주세요.' : '한국어 라벨을 입력해주세요.',
        'warning',
      );
      return;
    }
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
