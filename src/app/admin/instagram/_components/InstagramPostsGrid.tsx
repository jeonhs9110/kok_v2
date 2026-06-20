'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Upload, Trash2, ImageIcon, Save } from 'lucide-react';
import IgIcon from './IgIcon';

/**
 * 6-slot post grid for /admin/instagram — each slot accepts an
 * instagram URL (live embed iframe), an uploaded image fallback, or
 * stays blank. Save / delete per slot. Extracted from
 * /admin/instagram/page.tsx at 2026-06-21.
 */

export interface IgPost {
  id: string | null;
  image_url: string;
  link_url: string;
  post_url: string;
  sort_order: number;
}

// Extract post ID from Instagram URL (handles p/, reel/, tv/)
function extractPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

interface Props {
  handle: string;
  posts: IgPost[];
  uploadingSlot: number | null;
  savingSlot: number | null;
  /** Update a single field on a slot. */
  onUpdatePost: (slot: number, patch: Partial<IgPost>) => void;
  onSavePost: (slot: number) => void;
  onDeletePost: (slot: number) => void;
  /** Triggered by the inline "이미지 직접 업로드" button. Parent
   *  handles the actual file picker + supabase upload. */
  onImageFilePicked: (slot: number, file: File) => Promise<void>;
}

export default function InstagramPostsGrid({
  handle,
  posts,
  uploadingSlot,
  savingSlot,
  onUpdatePost,
  onSavePost,
  onDeletePost,
  onImageFilePicked,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<number | null>(null);

  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5">
      <h2 className="text-[14px] font-bold text-[#1f2937] mb-1">인스타그램 포스트 (최대 6개)</h2>
      <p className="text-sm text-[#6b7280] mb-3">
        홈페이지에 표시될 포스트를 설정하세요.{' '}
        <strong>Instagram 포스트 URL을 붙여넣으면</strong> 실시간 공식 임베드가 표시됩니다
        (이미지, 캡션, 좋아요 포함).
      </p>

      <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded p-3 mb-5 text-xs text-[#1e40af] space-y-1">
        <p className="font-bold">사용 방법:</p>
        <ol className="list-decimal ml-4 space-y-0.5">
          <li>
            Instagram에서 표시하고 싶은 포스트로 이동 (예:{' '}
            <code className="bg-[#dbeafe] px-1 rounded">instagram.com/{handle}</code>)
          </li>
          <li>
            포스트 URL 복사 (예:{' '}
            <code className="bg-[#dbeafe] px-1 rounded">https://www.instagram.com/p/ABC123/</code>)
          </li>
          <li>아래 슬롯에 붙여넣고 저장 → 홈페이지에 공식 임베드 표시</li>
        </ol>
        <p className="pt-1 text-[11px]">
          💡 지원: 일반 포스트 (p/), 릴스 (reel/), IGTV (tv/). URL만 바꾸면 홈페이지도 자동
          업데이트됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {posts.map((post, slot) => {
          const postId = extractPostId(post.post_url);
          const hasEmbed = !!postId;
          return (
            <div
              key={slot}
              className={`border rounded overflow-hidden ${
                hasEmbed
                  ? 'border-[#fda4af] bg-[#fff1f2]/30'
                  : 'border-[#e5e7eb]'
              }`}
            >
              {/* Preview */}
              <div className="relative aspect-square bg-[#fafbfc] flex items-center justify-center border-b border-[#f3f4f6] overflow-hidden">
                {hasEmbed ? (
                  <iframe
                    src={`https://www.instagram.com/p/${postId}/embed/`}
                    scrolling="no"
                    className="w-full h-full"
                    style={{ border: 'none', overflow: 'hidden' }}
                    loading="lazy"
                  />
                ) : post.image_url ? (
                  <Image
                    src={post.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-[#d1d5db]">
                    {uploadingSlot === slot ? (
                      <div className="w-7 h-7 border-2 border-[#9ca3af] border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-xs font-semibold">포스트 {slot + 1}</span>
                      </>
                    )}
                  </div>
                )}
                <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                  {slot + 1}
                </span>
                {hasEmbed && (
                  <span className="absolute top-2 right-2 bg-gradient-to-r from-[#E1306C] to-[#F56040] text-white text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
                    LIVE
                  </span>
                )}
                {(post.post_url || post.image_url) && (
                  <button
                    type="button"
                    onClick={() => onDeletePost(slot)}
                    className="absolute bottom-2 right-2 w-7 h-7 bg-[#ef4444] text-white rounded-full flex items-center justify-center hover:bg-[#dc2626] shadow-md"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Inputs */}
              <div className="p-3 space-y-2">
                <div>
                  <label className="text-[10px] font-bold text-[#be185d] uppercase tracking-wider flex items-center gap-1 mb-1">
                    <IgIcon className="w-3 h-3" />
                    Instagram 포스트 URL
                  </label>
                  <input
                    type="url"
                    value={post.post_url}
                    onChange={e => onUpdatePost(slot, { post_url: e.target.value })}
                    placeholder="https://www.instagram.com/p/..."
                    className="w-full rounded px-2 py-1.5 text-xs font-mono"
                  />
                </div>

                {!hasEmbed && (
                  <>
                    <div className="text-center text-[10px] text-[#9ca3af] font-semibold py-1">
                      또는
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        activeSlotRef.current = slot;
                        fileInputRef.current?.click();
                      }}
                      className="w-full border border-dashed border-[#d1d5db] rounded py-1.5 text-xs text-[#6b7280] hover:border-[#9ca3af] hover:text-[#374151] transition flex items-center justify-center gap-1"
                    >
                      <Upload className="w-3 h-3" />
                      {post.image_url ? '이미지 변경' : '이미지 직접 업로드'}
                    </button>
                  </>
                )}

                <button
                  onClick={() => onSavePost(slot)}
                  disabled={savingSlot === slot || (!post.image_url && !post.post_url)}
                  className="w-full bg-[#3b82f6] text-white py-1.5 rounded text-xs font-bold tracking-widest hover:bg-[#2563eb] transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 mt-2"
                >
                  {savingSlot === slot ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      저장 중
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      저장
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared hidden file input, fired by each slot's inline upload
          button. activeSlotRef carries the click target through the
          stat dance. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0];
          const slot = activeSlotRef.current;
          if (!file || slot === null) return;
          await onImageFilePicked(slot, file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
