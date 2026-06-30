'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/admin/Toast';
import { PageHeader } from '@/components/admin/CafeWidgets';
import ChatbotConfigCard, { type ChatbotConfig } from './_components/ChatbotConfigCard';
import ChatbotLeadsTable, { type ChatbotLead } from './_components/ChatbotLeadsTable';

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
    try {
      const res = await fetch('/api/admin/crud/chatbot_config?orderBy=id&direction=ASC', { cache: 'no-store' });
      if (res.ok) {
        const j = (await res.json()) as { rows?: ChatbotConfig[] };
        const data = (j.rows ?? [])[0];
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
      }
    } catch { /* table may not exist yet */ }
    setLoading(false);
  }

  async function loadLeads() {
    try {
      const res = await fetch('/api/admin/crud/chatbot_leads?orderBy=created_at&direction=DESC', { cache: 'no-store' });
      if (res.ok) {
        const j = (await res.json()) as { rows?: ChatbotLead[] };
        if (j.rows) setLeads(j.rows.slice(0, 50));
      }
    } catch { /* table may not exist */ }
  }

  // One-shot fetch on mount; explicit refetch in handleSave keeps it fresh.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConfig();
    loadLeads();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        is_enabled: config.is_enabled,
        show_global: config.show_global,
        show_domestic: config.show_domestic,
        model: config.model,
        greeting_en: config.greeting_en,
        greeting_kr: config.greeting_kr,
      };
      // chatbot_config is a singleton (id=1). Patch the existing row;
      // ONLY fall back to insert on 404 (row missing). Previously any
      // non-OK PATCH (500, 403, auth) flowed through to POST which
      // inserted a duplicate — and even if BOTH failed, `setSaved(true)`
      // still ran. Surface real failures to the operator.
      const patchRes = await fetch('/api/admin/crud/chatbot_config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 1, patch: payload }),
      });
      if (!patchRes.ok && patchRes.status !== 404) {
        throw new Error(`patch_${patchRes.status}`);
      }
      if (patchRes.status === 404) {
        const postRes = await fetch('/api/admin/crud/chatbot_config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 1, ...payload }),
        });
        if (!postRes.ok) throw new Error(`post_${postRes.status}`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast.show('챗봇 설정이 저장되었습니다.', 'success');
    } catch (err) {
      console.error('Save error:', err);
      toast.show('저장에 실패했습니다.', 'error');
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
