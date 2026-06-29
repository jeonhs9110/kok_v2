'use client';

import { ExternalLink, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { safeUrl } from '@/lib/url/safeUrl';

export interface PaymentProvider {
  id: number;
  provider: string;
  is_enabled: boolean;
  api_key: string;
  secret_key: string;
  merchant_id: string;
  additional_config: Record<string, string>;
  help_url: string;
  description_kr: string;
  description_en: string;
}

export const PROVIDER_INFO: Record<string, {
  name: string;
  color: string;
  logo: string;
  fields: { key: string; label: string; placeholder: string }[];
}> = {
  toss: {
    name: 'Toss Payments (토스페이먼츠)',
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    logo: '💳',
    fields: [
      { key: 'api_key', label: 'Client Key', placeholder: 'test_ck_...' },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'test_sk_...' },
      { key: 'merchant_id', label: 'MID (상점 ID)', placeholder: 'tosspayments' },
    ],
  },
  kakaopay: {
    name: 'Kakao Pay (카카오페이)',
    color: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    logo: '🟡',
    fields: [
      { key: 'api_key', label: 'Admin Key (CID)', placeholder: 'TC0ONETIME' },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'DEV...' },
      { key: 'merchant_id', label: 'CID (가맹점코드)', placeholder: 'TC0ONETIME' },
    ],
  },
  naverpay: {
    name: 'Naver Pay (네이버페이)',
    color: 'bg-green-50 text-green-800 border-green-200',
    logo: '🟢',
    fields: [
      { key: 'api_key', label: 'Client ID', placeholder: 'np_...' },
      { key: 'secret_key', label: 'Client Secret', placeholder: 'secret_...' },
      { key: 'merchant_id', label: 'Partner ID', placeholder: 'naverpay_partner' },
    ],
  },
  inicis: {
    name: 'KG이니시스 (KG Inicis)',
    color: 'bg-purple-50 text-purple-800 border-purple-200',
    logo: '🟣',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'INIpayTest' },
      { key: 'secret_key', label: 'Sign Key', placeholder: 'SU5JTElU...' },
      { key: 'merchant_id', label: 'MID (상점 ID)', placeholder: 'INIpayTest' },
    ],
  },
  kcp: {
    name: 'NHN KCP',
    color: 'bg-orange-50 text-orange-800 border-orange-200',
    logo: '🟠',
    fields: [
      { key: 'api_key', label: 'Site Code', placeholder: 'T0000' },
      { key: 'secret_key', label: 'Site Key', placeholder: '3grptw...' },
      { key: 'merchant_id', label: '가맹점 ID', placeholder: 'T0000' },
    ],
  },
};

interface Props {
  p: PaymentProvider;
  isExpanded: boolean;
  saving: string | null;
  saved: string | null;
  onToggleExpanded: () => void;
  onUpdate: (updates: Partial<PaymentProvider>) => void;
  onSave: () => void;
}

export default function PaymentProviderCard({
  p,
  isExpanded,
  saving,
  saved,
  onToggleExpanded,
  onUpdate,
  onSave,
}: Props) {
  const info = PROVIDER_INFO[p.provider];
  if (!info) return null;

  return (
    <div className={`rounded-xl border overflow-hidden ${info.color}`}>
      <button
        onClick={onToggleExpanded}
        className="w-full flex items-center justify-between px-5 py-4 hover:opacity-80 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{info.logo}</span>
          <div className="text-left">
            <p className="font-bold text-sm">{info.name}</p>
            <p className="text-[11px] opacity-60">{p.description_kr}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {p.is_enabled && <span className="text-[10px] font-bold bg-[#16a34a] text-white px-2 py-0.5 rounded-full">활성</span>}
          {isExpanded ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-5 space-y-3 border-t border-current/10">
          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-sm font-semibold">활성화</p>
              <p className="text-[11px] opacity-60">고객 결제 시 이 결제 수단을 사용합니다</p>
            </div>
            <button
              onClick={() => onUpdate({ is_enabled: !p.is_enabled })}
              className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${p.is_enabled ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`}
            >
              <span className={`inline-block h-4 w-4 bg-white rounded-full shadow transform transition-transform ${p.is_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          <a href={safeUrl(p.help_url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] underline opacity-70 hover:opacity-100 transition-opacity">
            개발자 콘솔 바로가기 <ExternalLink className="w-3 h-3" />
          </a>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {info.fields.map(f => (
              <div key={f.key}>
                <label className="text-[10px] font-bold opacity-60 uppercase">{f.label}</label>
                <input
                  type={f.key === 'secret_key' ? 'password' : 'text'}
                  value={(p as unknown as Record<string, string>)[f.key] || ''}
                  onChange={e => onUpdate({ [f.key]: e.target.value } as Partial<PaymentProvider>)}
                  placeholder={f.placeholder}
                  className="w-full mt-1 rounded-lg px-3 py-2 text-xs bg-white/80 focus:bg-white font-mono"
                />
              </div>
            ))}
          </div>

          <button
            onClick={onSave}
            disabled={saving === p.provider}
            className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              saved === p.provider ? 'bg-[#16a34a] text-white' : 'bg-[#1f2937] text-white hover:bg-[#111827]'
            } disabled:opacity-50`}
          >
            <Save className="w-3.5 h-3.5" />
            {saving === p.provider ? '저장 중...' : saved === p.provider ? '✓ 저장 완료' : '저장'}
          </button>
        </div>
      )}
    </div>
  );
}
