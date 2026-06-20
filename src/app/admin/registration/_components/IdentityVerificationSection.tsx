'use client';

import { Shield, ExternalLink, Save } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { VERIFICATION_PROVIDERS, type VerificationConfig } from './types';

interface Props {
  verification: VerificationConfig;
  openSection: string;
  isSaving: boolean;
  isSaved: boolean;
  onChange: (next: VerificationConfig) => void;
  onSave: () => void;
  onSetOpenSection: (v: string) => void;
}

export default function IdentityVerificationSection({
  verification,
  openSection,
  isSaving,
  isSaved,
  onChange,
  onSave,
  onSetOpenSection,
}: Props) {
  const patch = (p: Partial<VerificationConfig>) => onChange({ ...verification, ...p });

  return (
    <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
      <SectionHeader id="verification" title="본인인증 (Identity Verification)" icon={Shield} openSection={openSection} setOpenSection={onSetOpenSection} />
      {openSection === 'verification' && (
        <div className="p-5 pt-0 space-y-4">
          <p className="text-sm text-gray-500">한국 내 구매를 위한 본인인증 서비스를 설정합니다. 본인인증 제공자의 API 키를 입력하세요.</p>

          <div className="flex items-center justify-between p-3 rounded-lg border border-[#e5e7eb]">
            <div>
              <p className="font-semibold text-gray-800 text-sm">본인인증 활성화</p>
              <p className="text-[11px] text-[#9ca3af]">구매 시 본인인증을 요구합니다</p>
            </div>
            <button
              onClick={() => patch({ is_enabled: !verification.is_enabled })}
              className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${verification.is_enabled ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`}
            >
              <span className={`inline-block h-4 w-4 bg-white rounded-full shadow transform transition-transform ${verification.is_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
            </button>
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase">인증 제공자</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {VERIFICATION_PROVIDERS.map(vp => (
                <button
                  key={vp.value}
                  onClick={() => patch({ provider: vp.value, help_url: vp.url })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${verification.provider === vp.value ? 'border-[#3b82f6] bg-[#eff6ff]' : 'border-[#e5e7eb] hover:border-[#d1d5db]'}`}
                >
                  <p className="text-sm font-semibold">{vp.label}</p>
                  <a href={vp.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#3b82f6] flex items-center gap-1 mt-1">
                    콘솔 바로가기 <ExternalLink className="w-3 h-3" />
                  </a>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase">API Key</label>
              <input type="text" value={verification.api_key} onChange={e => patch({ api_key: e.target.value })} placeholder="API Key" className="w-full mt-1 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase">Secret Key</label>
              <input type="password" value={verification.secret_key} onChange={e => patch({ secret_key: e.target.value })} placeholder="Secret Key" className="w-full mt-1 rounded-lg px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase">Merchant ID</label>
              <input type="text" value={verification.merchant_id} onChange={e => patch({ merchant_id: e.target.value })} placeholder="Merchant ID" className="w-full mt-1 rounded-lg px-3 py-2 text-xs" />
            </div>
          </div>

          <button onClick={onSave} disabled={isSaving} className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all flex items-center gap-2 ${isSaved ? 'bg-[#16a34a] text-white' : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'} disabled:opacity-50`}>
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : isSaved ? '✓ 저장 완료' : '본인인증 설정 저장'}
          </button>
        </div>
      )}
    </div>
  );
}
