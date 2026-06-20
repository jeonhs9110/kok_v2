'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { PageHeader } from '@/components/admin/CafeWidgets';

// Session-aware client. Phase 2 RLS lockdown on `chatbot_config` requires
// admin JWT for writes, and admin reads of `chatbot_leads`.
const supabase = getSupabaseBrowser();

interface ChatbotConfig {
  is_enabled: boolean;
  show_global: boolean;
  show_domestic: boolean;
  model: string;
  greeting_en: string;
  greeting_kr: string;
}

interface ChatbotLead {
  id: string;
  name: string | null;
  email: string;
  skin_type: string | null;
  country: string | null;
  created_at: string;
}

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: '빠르고 경제적 ($0.15/1M tokens)' },
  { value: 'gpt-4o', label: 'GPT-4o', desc: '고급 추론 ($2.50/1M tokens)' },
];

export default function ChatbotAdminPage() {
  const toast = useToast();
  const [config, setConfig] = useState<ChatbotConfig>({
    is_enabled: true,
    show_global: true,
    show_domestic: false,
    model: 'gpt-4o-mini',
    greeting_en: 'Hello! I\'m your KOKKOK Garden AI Beauty Consultant 🌸\n\nTell me about your skin type or concerns and I\'ll recommend the perfect products for you.',
    greeting_kr: '안녕하세요! 콕콕가든 AI 뷰티 컨설턴트입니다 🌸\n\n피부 타입이나 고민을 알려주시면 맞춤 제품을 추천해드릴게요.',
  });
  const [leads, setLeads] = useState<ChatbotLead[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  async function loadConfig() {
    if (!supabase) { setLoading(false); return; }
    try {
      const { data } = await supabase.from('chatbot_config').select('*').single();
      if (data) {
        setConfig({
          is_enabled: data.is_enabled ?? true,
          show_global: data.show_global ?? true,
          show_domestic: data.show_domestic ?? false,
          model: data.model ?? 'gpt-4o-mini',
          greeting_en: data.greeting_en ?? config.greeting_en,
          greeting_kr: data.greeting_kr ?? config.greeting_kr,
        });
      }
    } catch { /* table may not exist yet */ }
    setLoading(false);
  }

  async function loadLeads() {
    if (!supabase) return;
    try {
      const { data } = await supabase
        .from('chatbot_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setLeads(data);
    } catch { /* table may not exist */ }
  }

  // One-shot fetch on mount. No external-store subscription source; the
  // explicit refetch in handleSave keeps the config fresh after edits.
  useEffect(() => {
    loadConfig();
    loadLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    try {
      await supabase.from('chatbot_config').upsert({
        id: 1,
        is_enabled: config.is_enabled,
        show_global: config.show_global,
        show_domestic: config.show_domestic,
        model: config.model,
        greeting_en: config.greeting_en,
        greeting_kr: config.greeting_kr,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
      toast.show('저장 실패. DB 테이블이 생성되었는지 확인해주세요.', 'error');
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="text-gray-500">로딩 중...</div>;
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title="챗봇"
        description="AI 채팅 위젯의 활성화 · 모델 · 노출 페이지를 관리합니다"
      />
      {/* On/Off Toggle + Model Selection */}
      <div className="bg-white rounded border border-[#e5e7eb] p-5 space-y-6">
        <h2 className="text-[14px] font-bold text-[#1f2937]">챗봇 설정</h2>

        {/* Visibility Checkboxes */}
        <div>
          <p className="font-semibold text-gray-800 mb-1">챗봇 표시 설정</p>
          <p className="text-sm text-gray-500 mb-4">챗봇을 표시할 페이지를 선택하세요. 모두 해제하면 챗봇이 비활성화됩니다.</p>
          <div className="flex gap-4">
            <label
              className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                config.show_global ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={config.show_global}
                onChange={() => setConfig(prev => {
                  const next = { ...prev, show_global: !prev.show_global };
                  next.is_enabled = next.show_global || next.show_domestic;
                  return next;
                })}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <div>
                <p className="font-semibold text-gray-800 text-sm">🌏 글로벌 페이지</p>
                <p className="text-[11px] text-gray-500">해외 IP 접속 시 표시</p>
              </div>
            </label>
            <label
              className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                config.show_domestic ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={config.show_domestic}
                onChange={() => setConfig(prev => {
                  const next = { ...prev, show_domestic: !prev.show_domestic };
                  next.is_enabled = next.show_global || next.show_domestic;
                  return next;
                })}
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
              />
              <div>
                <p className="font-semibold text-gray-800 text-sm">🇰🇷 국내 페이지</p>
                <p className="text-[11px] text-gray-500">한국 IP 접속 시 표시 (테스트용)</p>
              </div>
            </label>
          </div>
          {!config.show_global && !config.show_domestic && (
            <p className="text-xs text-red-500 mt-2 font-medium">⚠ 모든 페이지에서 챗봇이 비활성화된 상태입니다.</p>
          )}
        </div>

        {/* Model Selection */}
        <div>
          <p className="font-semibold text-gray-800 mb-2">AI 모델 선택</p>
          <div className="grid grid-cols-2 gap-3">
            {MODELS.map(m => (
              <button
                key={m.value}
                onClick={() => setConfig(prev => ({ ...prev, model: m.value }))}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  config.model === m.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-semibold text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-500 mt-1">{m.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Greetings */}
        <div className="space-y-3">
          <p className="font-semibold text-gray-800">인사말 메시지</p>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">English</label>
            <textarea
              value={config.greeting_en}
              onChange={e => setConfig(prev => ({ ...prev, greeting_en: e.target.value }))}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">한국어</label>
            <textarea
              value={config.greeting_kr}
              onChange={e => setConfig(prev => ({ ...prev, greeting_kr: e.target.value }))}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
            saved
              ? 'bg-green-500 text-white'
              : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
          } disabled:opacity-50`}
        >
          {saving ? '저장 중...' : saved ? '✓ 저장 완료' : '설정 저장'}
        </button>
      </div>

      {/* Lead Data */}
      <div className="bg-white rounded border border-[#e5e7eb] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-bold text-[#1f2937]">고객 리드 데이터</h2>
          <span className="text-sm text-gray-500">{leads.length}건</span>
        </div>
        {leads.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">아직 수집된 리드가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">이름</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">이메일</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">피부 타입</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">국가</th>
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">날짜</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id} className="border-b border-[#f3f4f6] hover:bg-[#fafbfc]">
                    <td className="py-2.5 px-3 text-gray-800">{lead.name || '—'}</td>
                    <td className="py-2.5 px-3 text-blue-600">{lead.email}</td>
                    <td className="py-2.5 px-3 text-gray-600">{lead.skin_type || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-600">{lead.country || '—'}</td>
                    <td className="py-2.5 px-3 text-gray-400">{new Date(lead.created_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
