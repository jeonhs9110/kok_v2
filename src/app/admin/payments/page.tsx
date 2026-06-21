'use client';

import { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import PaymentProviderCard, { type PaymentProvider } from './_components/PaymentProviderCard';

// Session-aware client. Phase 2 RLS lockdown on `payment_providers_config`
// is admin-only (rows hold provider API keys).
const supabase = getSupabaseBrowser();

export default function PaymentsAdminPage() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  async function loadProviders() {
    if (!supabase) { setLoading(false); return; }
    try {
      const { data } = await supabase.from('payment_providers_config').select('*').order('id');
      if (data) setProviders(data);
    } catch { /* table may not exist */ }
    setLoading(false);
  }

  // One-shot fetch on mount; explicit refetch in saveProvider keeps it fresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadProviders(); }, []);

  function updateProvider(provider: string, updates: Partial<PaymentProvider>) {
    setProviders(prev => prev.map(p => p.provider === provider ? { ...p, ...updates } : p));
  }

  async function saveProvider(p: PaymentProvider) {
    if (!supabase) return;
    setSaving(p.provider);
    await supabase.from('payment_providers_config').update({
      is_enabled: p.is_enabled,
      api_key: p.api_key,
      secret_key: p.secret_key,
      merchant_id: p.merchant_id,
    }).eq('id', p.id);
    setSaved(p.provider);
    setTimeout(() => setSaved(null), 2000);
    setSaving(null);
  }

  if (loading) return <div className="text-[#6b7280]">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-white rounded border border-[#e5e7eb] p-5">
        <h2 className="text-[14px] font-bold text-[#1f2937] mb-2">결제 시스템 설정</h2>
        <p className="text-sm text-[#6b7280] mb-4">각 결제 서비스의 API 키를 입력하고 토글로 활성화하세요. 테스트 키로 먼저 연동한 뒤 실서비스 키로 교체하세요.</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          <strong>참고:</strong> 대부분의 PG사는 사업자등록 후 가맹점 심사를 거쳐야 실결제가 가능합니다. 테스트 키로 먼저 개발/검증하세요.
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="bg-white rounded border border-[#e5e7eb] p-8 text-center text-[#9ca3af]">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-semibold">결제 제공자가 설정되지 않았습니다</p>
          <p className="text-xs mt-1">아래 SQL을 Supabase에서 실행하세요.</p>
        </div>
      ) : (
        providers.map(p => (
          <PaymentProviderCard
            key={p.provider}
            p={p}
            isExpanded={expandedProvider === p.provider}
            saving={saving}
            saved={saved}
            onToggleExpanded={() => setExpandedProvider(expandedProvider === p.provider ? null : p.provider)}
            onUpdate={updates => updateProvider(p.provider, updates)}
            onSave={() => saveProvider(p)}
          />
        ))
      )}
    </div>
  );
}
