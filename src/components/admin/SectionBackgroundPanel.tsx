'use client';

import { useRef } from 'react';
import { Upload, X, Square, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';

// Session-aware client. Background media uploads target the storage
// bucket whose RLS only admits authenticated admins (Phase 5 lockdown).
const supabase = getSupabaseBrowser();

/**
 * Shared "section background" picker used by /admin/shorts and
 * /admin/instagram (migration 26 added the storage columns). One panel,
 * four mutually-exclusive modes:
 *
 *   transparent  → renderer leaves the section's bg empty (inherits page)
 *   color        → solid color via inline style background-color
 *   image        → <img> stretched behind the section content
 *   video        → autoplay muted loop <video> stretched behind content
 *
 * Value shape:
 *   { type: BgType | null, color: string | null,
 *     mediaUrl: string | null, mediaType: 'image' | 'video' | null }
 *
 * Null `type` means "haven't been touched yet" — the parent component
 * supplies the legacy fallback. Storing null instead of 'transparent'
 * preserves the distinction between "deliberately transparent" and
 * "never configured", which matters for rollout.
 */

export type BgType = 'transparent' | 'color' | 'image' | 'video';

export interface SectionBgValue {
  type: BgType | null;
  color: string | null;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
}

interface Props {
  label?: string;
  value: SectionBgValue;
  onChange: (next: SectionBgValue) => void;
  /** Default color shown in the swatch when value.color is null and type=color. */
  defaultColor?: string;
  /** Storage bucket + path prefix where media uploads land. */
  uploadBucket?: string;
  uploadPathPrefix?: string;
}

const MODES: { key: BgType; label: string; hint: string; Icon: typeof Square }[] = [
  { key: 'transparent', label: '투명',  hint: '페이지 배경 그대로 노출',     Icon: Square },
  { key: 'color',       label: '단색',  hint: '색상 한 가지로 채우기',       Icon: Square },
  { key: 'image',       label: '이미지', hint: '배경 이미지 업로드',         Icon: ImageIcon },
  { key: 'video',       label: '영상',  hint: '루프 재생 영상 업로드 (음소거)', Icon: VideoIcon },
];

export default function SectionBackgroundPanel({
  label = '섹션 배경',
  value,
  onChange,
  defaultColor = '#111111',
  uploadBucket = 'site-assets',
  uploadPathPrefix = 'section-bg',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof SectionBgValue>(key: K, v: SectionBgValue[K]) =>
    onChange({ ...value, [key]: v });

  async function handleUpload(file: File) {
    const isVideo = file.type.startsWith('video/');
    let publicUrl: string;
    if (USE_S3_FROM_BROWSER) {
      try {
        const r = await uploadFileToS3(file, { keyPrefix: uploadPathPrefix, contentType: file.type });
        publicUrl = r.publicUrl;
      } catch (err) {
        alert('업로드에 실패했습니다: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
        return;
      }
    } else {
      const ext = file.name.split('.').pop() ?? (isVideo ? 'mp4' : 'jpg');
      const path = `${uploadPathPrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(uploadBucket).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });
      if (error) {
        alert('업로드에 실패했습니다: ' + error.message);
        return;
      }
      publicUrl = supabase.storage.from(uploadBucket).getPublicUrl(path).data.publicUrl;
    }
    onChange({
      ...value,
      mediaUrl: publicUrl,
      mediaType: isVideo ? 'video' : 'image',
    });
  }

  const activeType = value.type ?? 'transparent';

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[11px] font-bold tracking-widest text-gray-600 uppercase">{label}</p>
        <button
          type="button"
          onClick={() => onChange({ type: null, color: null, mediaUrl: null, mediaType: null })}
          className="text-[10px] text-gray-400 hover:text-black transition-colors"
          title="기본값(섹션의 기본 배경)으로 되돌리기"
        >
          기본값으로 재설정
        </button>
      </div>

      {/* Mode selector — 4-way tab */}
      <div className="grid grid-cols-4 gap-1.5">
        {MODES.map(m => {
          const isActive = activeType === m.key;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => set('type', m.key)}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded border text-xs transition-colors ${
                isActive
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
              }`}
              title={m.hint}
            >
              <m.Icon className="w-3.5 h-3.5" />
              <span className="font-semibold">{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mode-specific control */}
      {activeType === 'color' && (
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">색상</label>
          <input
            type="color"
            value={value.color ?? defaultColor}
            onChange={e => set('color', e.target.value)}
            className="w-9 h-8 rounded border border-gray-200 cursor-pointer bg-white"
          />
          <input
            type="text"
            value={value.color ?? ''}
            placeholder={defaultColor}
            onChange={e => set('color', e.target.value || null)}
            className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-black"
          />
        </div>
      )}

      {(activeType === 'image' || activeType === 'video') && (
        <div className="space-y-2">
          <div
            className="relative w-full h-32 rounded-lg overflow-hidden border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors cursor-pointer bg-gray-50 flex items-center justify-center"
            onClick={() => fileInputRef.current?.click()}
          >
            {value.mediaUrl ? (
              value.mediaType === 'video' ? (
                <video
                  src={value.mediaUrl}
                  autoPlay muted loop playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={value.mediaUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-gray-400">
                <Upload className="w-5 h-5" />
                <span className="text-[10px] font-semibold uppercase tracking-wider">
                  클릭하여 {activeType === 'video' ? '영상' : '이미지'} 업로드
                </span>
              </div>
            )}
            {value.mediaUrl && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onChange({ ...value, mediaUrl: null, mediaType: null });
                }}
                className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-1 hover:bg-black"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={activeType === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp,image/gif'}
            className="hidden"
            onChange={async e => {
              const file = e.target.files?.[0];
              if (!file) return;
              await handleUpload(file);
              e.target.value = '';
            }}
          />
          <input
            type="url"
            value={value.mediaUrl ?? ''}
            placeholder="또는 미디어 URL 직접 입력"
            onChange={e => set('mediaUrl', e.target.value || null)}
            className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-black"
          />
        </div>
      )}

      {activeType === 'transparent' && (
        <p className="text-[10px] text-gray-400">페이지 배경이 그대로 비칩니다. (관리자가 별도 설정한 SiteBackground도 포함)</p>
      )}
    </div>
  );
}
