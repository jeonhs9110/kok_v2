'use client';

import { Key, ExternalLink } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { PROVIDER_LOGOS, type AuthProvider } from './types';

interface Props {
  providers: AuthProvider[];
  openSection: string;
  saving: string | null;
  saved: string | null;
  supabaseUrl: string | undefined;
  onUpdateProvider: (provider: string, updates: Partial<AuthProvider>) => void;
  onSaveProvider: (p: AuthProvider) => void;
  onSetOpenSection: (v: string) => void;
}

export default function SocialProvidersSection({
  providers,
  openSection,
  saving,
  saved,
  supabaseUrl,
  onUpdateProvider,
  onSaveProvider,
  onSetOpenSection,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
      <SectionHeader id="social" title="소셜 로그인 설정" icon={Key} openSection={openSection} setOpenSection={onSetOpenSection} />
      {openSection === 'social' && (
        <div className="p-5 pt-0 space-y-4">
          <p className="text-sm text-gray-500">각 소셜 로그인 제공자의 API 키를 입력하고 활성화하세요. 키를 발급받으려면 각 링크를 클릭하세요.</p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            <strong>Supabase Redirect URI</strong> (각 제공자에 등록 필요):<br />
            <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono text-[11px]">{supabaseUrl}/auth/v1/callback</code>
          </div>

          {providers.map(p => {
            const info = PROVIDER_LOGOS[p.provider];
            if (!info) return null;
            return (
              <div key={p.provider} className={`border rounded-xl p-4 space-y-3 ${info.color}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold">{info.name}</span>
                    <a href={p.help_url} target="_blank" rel="noopener noreferrer" className="text-[11px] flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity underline">
                      API 키 발급 <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <button
                    onClick={() => onUpdateProvider(p.provider, { is_enabled: !p.is_enabled })}
                    className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors ${p.is_enabled ? 'bg-[#16a34a]' : 'bg-[#d1d5db]'}`}
                  >
                    <span className={`inline-block h-4 w-4 bg-white rounded-full shadow transform transition-transform ${p.is_enabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
                <p className="text-[11px] opacity-70">{p.description_kr}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold opacity-60 uppercase">{info.fields[0]}</label>
                    <input type="text" value={p.client_id} onChange={e => onUpdateProvider(p.provider, { client_id: e.target.value })} placeholder={`${info.name} ${info.fields[0]}`} className="w-full mt-1 rounded-lg px-3 py-2 text-xs bg-white/80 focus:bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold opacity-60 uppercase">{info.fields[1]}</label>
                    <input type="password" value={p.client_secret} onChange={e => onUpdateProvider(p.provider, { client_secret: e.target.value })} placeholder={`${info.name} ${info.fields[1]}`} className="w-full mt-1 rounded-lg px-3 py-2 text-xs bg-white/80 focus:bg-white" />
                  </div>
                </div>
                <button onClick={() => onSaveProvider(p)} disabled={saving === `provider-${p.provider}`} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${saved === `provider-${p.provider}` ? 'bg-[#16a34a] text-white' : 'bg-[#1f2937] text-white hover:bg-[#111827]'} disabled:opacity-50`}>
                  {saving === `provider-${p.provider}` ? '저장 중...' : saved === `provider-${p.provider}` ? '✓ 저장됨' : '저장'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
