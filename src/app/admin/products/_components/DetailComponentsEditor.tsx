'use client';

import { useRef, useState } from 'react';
import { Upload, Eye } from 'lucide-react';
import { type DetailComponent } from '@/lib/api/products';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';
import { isValidYouTubeUrl } from '@/lib/youtube';
import ProductDetailComponents from '@/components/ProductDetailComponents';
import SortableList from '@/components/admin/SortableList';
import { YtIcon } from './productDetailHelpers';
import DetailComponentItem from './DetailComponentItem';

const supabase = getSupabaseBrowser();
const BUCKET = 'product-images';
const MAX_DETAIL_FILE_SIZE = 30 * 1024 * 1024; // 30MB soft cap

interface Props {
  components: DetailComponent[];
  onChange: (next: DetailComponent[]) => void;
}

/**
 * Structured-component editor for the product detail page. Each row is a
 * sortable card rendered by <DetailComponentItem />. Replaces the legacy
 * HTML-blob editor; the parent's load path migrates old rows by parsing
 * their <img> tags via extractLegacyImagesAsComponents().
 */
export default function DetailComponentsEditor({ components, onChange }: Props) {
  const toast = useToast();
  const confirm = useConfirm();
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeError, setYoutubeError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const add = (c: Omit<DetailComponent, 'sort_order' | 'id'>) => {
    onChange([
      ...components,
      { ...c, id: crypto.randomUUID(), sort_order: components.length },
    ]);
  };

  const remove = (id: string) => {
    onChange(components.filter(c => c.id !== id));
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      toast.show('이미지 또는 영상 파일만 업로드 가능합니다.', 'warning');
      return;
    }
    if (file.size > MAX_DETAIL_FILE_SIZE) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      const ok = await confirm({ message: `파일 크기가 ${sizeMb}MB로 큽니다. 30MB 이하를 권장합니다. 계속하시겠습니까?`, confirmText: '업로드' });
      if (!ok) return;
    }
    setUploading(true);
    try {
      let publicUrl: string;
      if (USE_S3_FROM_BROWSER) {
        const r = await uploadFileToS3(file, { keyPrefix: 'detail-components', contentType: file.type });
        publicUrl = r.publicUrl;
      } else {
        if (!supabase) throw new Error('Supabase 클라이언트 없음');
        const ext = file.name.split('.').pop() ?? 'bin';
        const path = `detail-components/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        });
        if (error) throw error;
        publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      add({ type: isVideo ? 'video' : 'image', url: publicUrl });
    } catch (err) {
      console.error('[DetailComponentsEditor] upload failed:', err);
      toast.show('업로드에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleAddYoutube = () => {
    const url = youtubeInput.trim();
    if (!isValidYouTubeUrl(url)) {
      setYoutubeError('유효한 YouTube URL이 아닙니다. (예: https://www.youtube.com/watch?v=...)');
      return;
    }
    setYoutubeError('');
    add({ type: 'youtube', url });
    setYoutubeInput('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">상세페이지 컴포넌트</label>
        <span className="text-[10px] text-[#9ca3af]">위 → 아래 순서, 컴포넌트 간 마진 없이 이어붙음</span>
      </div>

      {components.length === 0 ? (
        <div className="border-2 border-dashed border-[#e5e7eb] rounded-xl p-6 text-center text-[#9ca3af] text-xs kokkok-keep-border">
          아직 추가된 컴포넌트가 없습니다. 아래에서 이미지/영상/YouTube를 추가하세요.
        </div>
      ) : (
        <SortableList
          items={components}
          getId={(c) => c.id}
          onReorder={onChange}
          className="space-y-2"
        >
          {(c, { dragHandleProps }) => {
            const i = components.findIndex(x => x.id === c.id);
            return (
              <DetailComponentItem
                component={c}
                index={i}
                dragHandleProps={dragHandleProps}
                onRemove={remove}
              />
            );
          }}
        </SortableList>
      )}

      {components.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#9ca3af]" />
            <p className="text-[10px] font-bold tracking-widest text-[#6b7280] uppercase">사이트 미리보기</p>
            <span className="text-[10px] text-[#9ca3af] ml-auto">실제 스토어 페이지와 동일한 모습 (스토어 폭은 더 넓음)</span>
          </div>
          <div className="border border-[#e5e7eb] rounded-lg overflow-hidden bg-white">
            <ProductDetailComponents components={components} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="border border-dashed border-[#d1d5db] rounded-lg p-3 text-xs font-semibold text-[#374151] hover:border-[#1f2937] hover:bg-[#fafbfc] transition disabled:opacity-50 flex items-center justify-center gap-2 kokkok-keep-border"
        >
          <Upload className="w-4 h-4" />
          {uploading ? '업로드 중...' : '파일 업로드 (이미지/영상)'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
          className="hidden"
          onChange={handleFile}
        />
        <div className="border border-dashed border-[#d1d5db] rounded-lg p-2 flex items-center gap-1.5 kokkok-keep-border">
          <YtIcon className="w-4 h-4 text-[#dc2626] flex-shrink-0 ml-1" />
          <input
            type="url"
            value={youtubeInput}
            onChange={e => { setYoutubeInput(e.target.value); setYoutubeError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddYoutube(); } }}
            placeholder="YouTube URL"
            className="flex-1 text-xs bg-transparent outline-none min-w-0"
          />
          <button
            type="button"
            onClick={handleAddYoutube}
            className="px-2.5 py-1 bg-[#1f2937] text-white text-[11px] font-bold rounded hover:bg-[#111827]"
          >
            추가
          </button>
        </div>
      </div>
      {youtubeError && <p className="text-[10px] text-[#ef4444]">{youtubeError}</p>}
      <p className="text-[10px] text-[#9ca3af] leading-snug pt-1">
        이미지(PNG/JPG/WEBP/GIF), 영상(MP4), YouTube 링크를 추가하면 상세페이지 하단에 위→아래로 마진 없이 이어붙어 표시됩니다.
        영상 파일은 <strong className="text-[#6b7280]">30MB 이하 권장</strong>. YouTube Shorts URL 사용 시 자동으로 세로 비율(9:16)로 표시됩니다.
      </p>
    </div>
  );
}
