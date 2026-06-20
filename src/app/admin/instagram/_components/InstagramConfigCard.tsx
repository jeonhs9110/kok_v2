'use client';

import { Save } from 'lucide-react';
import IgIcon from './IgIcon';

/**
 * Account handle + section description card, with a save button +
 * inline link to the live IG profile. Top card on /admin/instagram.
 * Extracted from page.tsx at 2026-06-21.
 */

interface Props {
  handle: string;
  description: string;
  isSaving: boolean;
  onHandleChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onSave: () => void;
}

export default function InstagramConfigCard({
  handle,
  description,
  isSaving,
  onHandleChange,
  onDescriptionChange,
  onSave,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5">
      <div className="flex items-center gap-2 mb-4">
        <IgIcon className="w-5 h-5 text-[#E1306C]" />
        <h2 className="text-[14px] font-bold text-[#1f2937]">인스타그램 설정</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
            계정 핸들 (@없이 입력)
          </label>
          <div className="flex items-center border border-[#d1d5db] rounded bg-white focus-within:border-[#3b82f6] focus-within:ring-1 focus-within:ring-[#3b82f6] transition overflow-hidden kokkok-keep-border">
            <span className="px-3 text-[#9ca3af] font-semibold text-sm select-none">@</span>
            <input
              type="text"
              value={handle}
              onChange={e => onHandleChange(e.target.value.replace('@', ''))}
              placeholder="rdrd_official"
              className="flex-1 py-2 pr-3 text-sm bg-transparent outline-none kokkok-keep-border kokkok-keep-focus"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
            설명 문구
          </label>
          <input
            type="text"
            value={description}
            onChange={e => onDescriptionChange(e.target.value)}
            placeholder="인스타그램에서 최신 소식을 확인하세요"
            className="w-full rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <a
          href={`https://www.instagram.com/${handle}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#3b82f6] hover:underline"
        >
          instagram.com/{handle} →
        </a>
        <button
          onClick={onSave}
          disabled={isSaving}
          className="bg-[#3b82f6] text-white px-6 py-2 rounded text-sm font-bold tracking-widest hover:bg-[#2563eb] transition disabled:opacity-40 flex items-center gap-2"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              설정 저장
            </>
          )}
        </button>
      </div>
    </div>
  );
}
