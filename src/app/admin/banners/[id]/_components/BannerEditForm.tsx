'use client';

import { Save } from 'lucide-react';
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from '@/lib/i18n/types';

export interface BannerRow {
  text: Record<string, string>;
  link_url: string;
  bg_color: string;
  text_color: string;
  is_active: boolean;
}

interface Props {
  data: BannerRow;
  activeLang: Lang;
  dirty: boolean;
  saving: boolean;
  savedFlash: boolean;
  onActiveLangChange: (l: Lang) => void;
  onChange: (next: BannerRow) => void;
  onSave: () => void;
}

export default function BannerEditForm({
  data,
  activeLang,
  dirty,
  saving,
  savedFlash,
  onActiveLangChange,
  onChange,
  onSave,
}: Props) {
  const patch = (p: Partial<BannerRow>) => onChange({ ...data, ...p });
  const updateText = (lang: Lang, value: string) =>
    onChange({ ...data, text: { ...data.text, [lang]: value } });

  return (
    <>
      {/* Live preview chip */}
      <div className="rounded border border-[#e5e7eb] overflow-hidden">
        <div className="px-3 py-2 text-[11px] text-[#6b7280] bg-[#fafbfc] border-b border-[#e5e7eb]">
          미리보기
        </div>
        <div
          className="py-3 px-4 text-center text-[13px] sm:text-[14px] font-medium tracking-wide"
          style={{ backgroundColor: data.bg_color, color: data.text_color }}
        >
          {data.text?.[activeLang] || data.text?.kr || data.text?.en || '(텍스트를 입력하세요)'}
        </div>
      </div>

      <label className="flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          checked={data.is_active}
          onChange={e => patch({ is_active: e.target.checked })}
          className="w-4 h-4"
        />
        활성화 (체크 해제 시 사이트에 표시 안 됨)
      </label>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-[#374151]">텍스트</label>
          <div className="flex gap-1">
            {SUPPORTED_LANGS.map(lang => (
              <button
                key={lang}
                type="button"
                onClick={() => onActiveLangChange(lang)}
                className={`px-2 py-0.5 text-[11px] rounded ${
                  activeLang === lang
                    ? 'bg-[#3b82f6] text-white'
                    : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
                }`}
              >
                {LANG_LABELS[lang]}
              </button>
            ))}
          </div>
        </div>
        <input
          type="text"
          maxLength={120}
          value={data.text?.[activeLang] || ''}
          onChange={e => updateText(activeLang, e.target.value)}
          placeholder={`${LANG_LABELS[activeLang]} 텍스트 (최대 120자)`}
          className="w-full px-3 py-2 text-[13px] border border-[#d1d5db] rounded focus:border-[#3b82f6] focus:outline-none kokkok-keep-border"
        />
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-semibold text-[#374151]">링크 (선택)</label>
        <input
          type="text"
          value={data.link_url}
          onChange={e => patch({ link_url: e.target.value })}
          placeholder="/products 또는 https://..."
          className="w-full px-3 py-2 text-[13px] border border-[#d1d5db] rounded focus:border-[#3b82f6] focus:outline-none kokkok-keep-border"
        />
        <p className="text-[11px] text-[#9ca3af]">비워두면 클릭 불가</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-[#374151]">배경색</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={data.bg_color}
              onChange={e => patch({ bg_color: e.target.value })}
              className="w-10 h-9 rounded border border-[#d1d5db] cursor-pointer kokkok-keep-border"
            />
            <input
              type="text"
              value={data.bg_color}
              onChange={e => patch({ bg_color: e.target.value })}
              className="flex-1 px-2 py-1.5 text-[12px] font-mono border border-[#d1d5db] rounded kokkok-keep-border"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-[#374151]">글자색</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={data.text_color}
              onChange={e => patch({ text_color: e.target.value })}
              className="w-10 h-9 rounded border border-[#d1d5db] cursor-pointer kokkok-keep-border"
            />
            <input
              type="text"
              value={data.text_color}
              onChange={e => patch({ text_color: e.target.value })}
              className="flex-1 px-2 py-1.5 text-[12px] font-mono border border-[#d1d5db] rounded kokkok-keep-border"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] disabled:bg-[#9ca3af] disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? '저장 중...' : '저장'}
        </button>
        {savedFlash && (
          <span className="text-[12px] text-[#16a34a]">저장됨 ✓</span>
        )}
      </div>
    </>
  );
}
