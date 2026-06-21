'use client';

export interface ChatbotConfig {
  is_enabled: boolean;
  show_global: boolean;
  show_domestic: boolean;
  model: string;
  greeting_en: string;
  greeting_kr: string;
}

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: '빠르고 경제적 ($0.15/1M tokens)' },
  { value: 'gpt-4o', label: 'GPT-4o', desc: '고급 추론 ($2.50/1M tokens)' },
];

interface Props {
  config: ChatbotConfig;
  saving: boolean;
  saved: boolean;
  onChange: (next: ChatbotConfig) => void;
  onSave: () => void;
}

export default function ChatbotConfigCard({ config, saving, saved, onChange, onSave }: Props) {
  const patch = (p: Partial<ChatbotConfig>) => onChange({ ...config, ...p });

  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5 space-y-6">
      <h2 className="text-[14px] font-bold text-[#1f2937]">챗봇 설정</h2>

      {/* Visibility Checkboxes */}
      <div>
        <p className="font-semibold text-[#374151] mb-1">챗봇 표시 설정</p>
        <p className="text-sm text-[#6b7280] mb-4">챗봇을 표시할 페이지를 선택하세요. 모두 해제하면 챗봇이 비활성화됩니다.</p>
        <div className="flex gap-4">
          <label
            className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              config.show_global ? 'border-[#3b82f6] bg-[#eff6ff]' : 'border-[#e5e7eb] hover:border-[#d1d5db]'
            } kokkok-keep-border`}
          >
            <input
              type="checkbox"
              checked={config.show_global}
              onChange={() => {
                const next = { ...config, show_global: !config.show_global };
                next.is_enabled = next.show_global || next.show_domestic;
                onChange(next);
              }}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="font-semibold text-[#1f2937] text-sm">🌏 글로벌 페이지</p>
              <p className="text-[11px] text-[#6b7280]">해외 IP 접속 시 표시</p>
            </div>
          </label>
          <label
            className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
              config.show_domestic ? 'border-[#3b82f6] bg-[#eff6ff]' : 'border-[#e5e7eb] hover:border-[#d1d5db]'
            } kokkok-keep-border`}
          >
            <input
              type="checkbox"
              checked={config.show_domestic}
              onChange={() => {
                const next = { ...config, show_domestic: !config.show_domestic };
                next.is_enabled = next.show_global || next.show_domestic;
                onChange(next);
              }}
              className="w-4 h-4 rounded"
            />
            <div>
              <p className="font-semibold text-[#1f2937] text-sm">🇰🇷 국내 페이지</p>
              <p className="text-[11px] text-[#6b7280]">한국 IP 접속 시 표시 (테스트용)</p>
            </div>
          </label>
        </div>
        {!config.show_global && !config.show_domestic && (
          <p className="text-xs text-[#ef4444] mt-2 font-medium">⚠ 모든 페이지에서 챗봇이 비활성화된 상태입니다.</p>
        )}
      </div>

      {/* Model Selection */}
      <div>
        <p className="font-semibold text-[#374151] mb-2">AI 모델 선택</p>
        <div className="grid grid-cols-2 gap-3">
          {MODELS.map(m => (
            <button
              key={m.value}
              onClick={() => patch({ model: m.value })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                config.model === m.value
                  ? 'border-[#3b82f6] bg-[#eff6ff]'
                  : 'border-[#e5e7eb] hover:border-[#d1d5db]'
              } kokkok-keep-border`}
            >
              <p className="font-semibold text-[#1f2937]">{m.label}</p>
              <p className="text-xs text-[#6b7280] mt-1">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Greetings */}
      <div className="space-y-3">
        <p className="font-semibold text-[#374151]">인사말 메시지</p>
        <div>
          <label className="text-xs text-[#6b7280] mb-1 block">영어 (English)</label>
          <textarea
            value={config.greeting_en}
            onChange={e => patch({ greeting_en: e.target.value })}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-[#6b7280] mb-1 block">한국어</label>
          <textarea
            value={config.greeting_kr}
            onChange={e => patch({ greeting_kr: e.target.value })}
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      {/* Save */}
      <button
        onClick={onSave}
        disabled={saving}
        className={`px-6 py-2.5 rounded-lg font-semibold text-sm transition-all ${
          saved
            ? 'bg-[#16a34a] text-white'
            : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
        } disabled:opacity-50`}
      >
        {saving ? '저장 중...' : saved ? '✓ 저장 완료' : '설정 저장'}
      </button>
    </div>
  );
}
