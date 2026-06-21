'use client';

import { Loader2 } from 'lucide-react';

interface Props {
  linkUrl: string;
  isNaverFetching: boolean;
  onChange: (next: string) => void;
  onAutoFillNaver: () => void;
}

/**
 * External link URL + 네이버 자동 채우기 button. The auto-fill scrapes
 * the URL's og:* tags + Naver post body and patches them back to the
 * parent's row state — but never overwrites filled fields, so admins
 * can pre-fill anything they want kept.
 */
export default function ReviewNaverLinkRow({ linkUrl, isNaverFetching, onChange, onAutoFillNaver }: Props) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
        외부 링크 (선택)
      </label>
      <div className="flex gap-2 mt-1">
        <input
          type="text"
          value={linkUrl}
          onChange={e => onChange(e.target.value)}
          placeholder="https://... (지정하면 클릭 시 새 창에서 링크로 이동. 비워두면 아래 내용이 팝업으로 표시됩니다)"
          className="flex-1 rounded px-3 py-2 text-sm font-mono"
        />
        <button
          type="button"
          onClick={onAutoFillNaver}
          disabled={isNaverFetching || !linkUrl}
          title="네이버 블로그/포스트 URL이면 제목·이미지·설명을 자동으로 채워요"
          className="px-3 py-2 text-xs font-bold text-white bg-[#03c75a] hover:bg-[#02b14d] disabled:opacity-40 rounded whitespace-nowrap flex items-center gap-1.5"
        >
          {isNaverFetching ? (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              가져오는 중...
            </>
          ) : (
            '네이버 자동 채우기'
          )}
        </button>
      </div>
      <p className="text-[10px] text-[#9ca3af] mt-1">
        네이버 블로그 / 포스트 / 네이버 단축 URL(naver.me)을 인식합니다. 이미 채워진 칸은
        덮어쓰지 않아요.
      </p>
    </div>
  );
}
