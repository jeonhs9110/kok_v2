'use client';

import { useRef } from 'react';
import InstagramPostTile from './InstagramPostTile';

/**
 * 6-slot post grid for /admin/instagram. Each slot is an
 * <InstagramPostTile /> handling its own live-embed / uploaded image /
 * empty render branches. This file owns the shared hidden <input
 * type="file"> the tiles all share — activeSlotRef carries the click
 * target through the stat dance.
 */

export interface IgPost {
  id: string | null;
  image_url: string;
  link_url: string;
  post_url: string;
  sort_order: number;
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
        {posts.map((post, slot) => (
          <InstagramPostTile
            key={slot}
            slot={slot}
            post={post}
            uploadingSlot={uploadingSlot}
            savingSlot={savingSlot}
            onUpdatePost={onUpdatePost}
            onSavePost={onSavePost}
            onDeletePost={onDeletePost}
            onUploadClick={(s) => {
              activeSlotRef.current = s;
              fileInputRef.current?.click();
            }}
          />
        ))}
      </div>

      {/* Shared hidden file input, fired by each tile's inline upload
          button. activeSlotRef carries the click target. */}
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
