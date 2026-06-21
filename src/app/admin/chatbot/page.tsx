'use client';

import { useState, useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { PageHeader } from '@/components/admin/CafeWidgets';
import ChatbotConfigCard, { type ChatbotConfig } from './_components/ChatbotConfigCard';
import ChatbotLeadsTable, { type ChatbotLead } from './_components/ChatbotLeadsTable';

// Session-aware client. Phase 2 RLS lockdown on `chatbot_config` requires
// admin JWT for writes, and admin reads of `chatbot_leads`.
const supabase = getSupabaseBrowser();

const DEFAULT_GREETING_EN = "Hello! I'm your KOKKOK Garden AI Beauty Consultant 🌸\n\nTell me about your skin type or concerns and I'll recommend the perfect products for you.";
const DEFAULT_GREETING_KR = '안녕하세요! 콕콕가든 AI 뷰티 컨설턴트입니다 🌸\n\n피부 타입이나 고민을 알려주시면 맞춤 제품을 추천해드릴게요.';

export default function ChatbotAdminPage() {
  const toast = useToast();
  const [config, setConfig] = useState<ChatbotConfig>({
    is_enabled: true,
    show_global: true,
    show_domestic: false,
    model: 'gpt-4o-mini',
    greeting_en: DEFAULT_GREETING_EN,
    greeting_kr: DEFAULT_GREETING_KR,
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
          greeting_en: data.greeting_en ?? DEFAULT_GREETING_EN,
          greeting_kr: data.greeting_kr ?? DEFAULT_GREETING_KR,
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

  // One-shot fetch on mount; explicit refetch in handleSave keeps it fresh.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
    loadLeads();
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

  if (loading) return <div className="text-[#6b7280]">로딩 중...</div>;

  return (
    <div className="space-y-5 max-w-4xl">
      <PageHeader
        title="챗봇"
        description="AI 채팅 위젯의 활성화 · 모델 · 노출 페이지를 관리합니다"
      />
      <ChatbotConfigCard
        config={config}
        saving={saving}
        saved={saved}
        onChange={setConfig}
        onSave={handleSave}
      />
      <ChatbotLeadsTable leads={leads} />
    </div>
  );
}
