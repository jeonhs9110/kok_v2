'use client';

import Image from 'next/image';
import { Upload, Trash2, ImageIcon, Save } from 'lucide-react';
import IgIcon from './IgIcon';
import type { IgPost } from './InstagramPostsGrid';

// Same regex as the grid's extractor — kept local so the tile decides
// "should I render the live embed vs the uploaded image?".
function extractPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

interface Props {
  slot: number;
  post: IgPost;
  uploadingSlot: number | null;
  savingSlot: number | null;
  onUpdatePost: (slot: number, patch: Partial<IgPost>) => void;
  onSavePost: (slot: number) => void;
  onDeletePost: (slot: number) => void;
  onUploadClick: (slot: number) => void;
}

/**
 * One tile in the 6-slot Instagram grid. Decides between three render
 * states based on what's filled:
 *   - post_url with valid post ID → live Instagram embed iframe
 *   - image_url only → static uploaded image
 *   - empty → placeholder with the "포스트 N" caption
 *
 * Save is enabled when EITHER image_url OR post_url is non-empty. Delete
 * clears the tile to its empty state (parent decides whether to also
 * remove the DB row).
 */
export default function InstagramPostTile({
  slot,
  post,
  uploadingSlot,
  savingSlot,
  onUpdatePost,
  onSavePost,
  onDeletePost,
  onUploadClick,
}: Props) {
  const postId = extractPostId(post.post_url);
  const hasEmbed = !!postId;

  return (
    <div
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
              onClick={() => onUploadClick(slot)}
              className="w-full border border-dashed border-[#d1d5db] rounded py-1.5 text-xs text-[#6b7280] hover:border-[#9ca3af] hover:text-[#374151] transition flex items-center justify-center gap-1 kokkok-keep-border"
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
}
