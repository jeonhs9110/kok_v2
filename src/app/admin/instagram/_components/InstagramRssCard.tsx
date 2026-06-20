'use client';

import { RefreshCw, ExternalLink } from 'lucide-react';

/**
 * RSS-feed URL editor + manual refresh button. Includes a setup
 * instructions block (rss.app step-by-step) so the operator can wire
 * up a brand-new feed without leaving the admin. Extracted from
 * /admin/instagram/page.tsx at 2026-06-21.
 */

interface Props {
  handle: string;
  rssFeedUrl: string;
  isRefreshing: boolean;
  refreshMessage: { type: 'success' | 'error'; text: string } | null;
  onRssFeedUrlChange: (v: string) => void;
  onRefresh: () => void;
}

export default function InstagramRssCard({
  handle,
  rssFeedUrl,
  isRefreshing,
  refreshMessage,
  onRssFeedUrlChange,
  onRefresh,
}: Props) {
  return (
    <div className="bg-gradient-to-br from-[#faf5ff] to-[#fdf2f8] rounded border border-[#e9d5ff] p-5">
      <div className="flex items-center gap-2 mb-2">
        <RefreshCw className="w-5 h-5 text-[#7c3aed]" />
        <h2 className="text-[14px] font-bold text-[#1f2937]">RSS 자동 새로고침</h2>
        {rssFeedUrl && (
          <span className="text-[10px] font-bold bg-[#16a34a] text-white px-2 py-0.5 rounded-full">
            설정됨
          </span>
        )}
      </div>
      <p className="text-sm text-[#374151] mb-4">
        RSS.app에서 생성한 Instagram RSS 피드 URL을 입력하면{' '}
        <strong>새로고침 버튼 한 번으로</strong> 최신 포스트 6개를 자동으로 가져옵니다.
      </p>

      <div className="bg-white/80 border border-[#e9d5ff] rounded p-3 mb-4 text-xs text-[#374151] space-y-1">
        <p className="font-bold text-[#6b21a8]">RSS.app 설정 방법 (5분):</p>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>
            <a
              href="https://rss.app/new-rss-feed"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#7c3aed] underline font-semibold inline-flex items-center gap-0.5"
            >
              rss.app/new-rss-feed <ExternalLink className="w-2.5 h-2.5" />
            </a>
            에서 무료 가입
          </li>
          <li>
            &quot;Instagram&quot; 선택 → Instagram 프로필 URL 입력:{' '}
            <code className="bg-[#f3e8ff] px-1 rounded">https://www.instagram.com/{handle}/</code>
          </li>
          <li>
            Generate Feed → RSS URL 복사 (예:{' '}
            <code className="bg-[#f3e8ff] px-1 rounded">https://rss.app/feeds/ABC123.xml</code>)
          </li>
          <li>
            아래에 붙여넣고 <strong>설정 저장</strong> 후 <strong>새로고침</strong> 버튼 클릭
          </li>
        </ol>
        <p className="pt-1 text-[11px] text-[#6b7280]">
          💡 무료 플랜: 6시간마다 자동 업데이트, 피드 2개까지. 관리자가 수동으로 새로고침 버튼을
          누를 때마다 최신화됩니다.
        </p>
      </div>

      <div className="flex gap-2 mb-3">
        <input
          type="url"
          value={rssFeedUrl}
          onChange={e => onRssFeedUrlChange(e.target.value)}
          placeholder="https://rss.app/feeds/xxxxxxxx.xml"
          className="flex-1 rounded px-3 py-2.5 text-sm bg-white transition font-mono"
        />
        <button
          onClick={onRefresh}
          disabled={isRefreshing || !rssFeedUrl.trim()}
          className="bg-gradient-to-r from-[#7c3aed] to-[#ec4899] text-white px-5 py-2.5 rounded font-bold text-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
        >
          {isRefreshing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              가져오는 중...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              새로고침
            </>
          )}
        </button>
      </div>

      {refreshMessage && (
        <div
          className={`text-xs px-3 py-2 rounded font-medium ${
            refreshMessage.type === 'success'
              ? 'bg-[#f0fdf4] border border-[#bbf7d0] text-[#166534]'
              : 'bg-[#fef2f2] border border-[#fecaca] text-[#991b1b]'
          }`}
        >
          {refreshMessage.text}
        </div>
      )}
    </div>
  );
}
