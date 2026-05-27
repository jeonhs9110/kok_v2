'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { supabase } from '@/lib/api/products';
import { SUPPORTED_LANGS, LANG_LABELS } from '@/lib/i18n/types';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import {
  MAX_FILE_SIZE,
  emptyForm,
  uploadSlideAsset,
  type SlideFormData,
} from '../_lib';

interface Props {
  editingId: string | null;
  initialForm?: SlideFormData;
  initialPreviewUrl?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function CarouselSlideModal({
  editingId,
  initialForm,
  initialPreviewUrl = '',
  onClose,
  onSaved,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<SlideFormData>(
    initialForm ?? { ...emptyForm, badge: {}, title: {}, subtitle: {} },
  );
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>(
    'idle',
  );
  const [activeLang, setActiveLang] = useState<string>('kr');

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      alert('파일 크기가 20MB를 초과합니다.');
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const isGif = file.type === 'image/gif';
    const mediaType = isVideo ? 'video' : isGif ? 'gif' : 'image';
    setPreviewUrl(URL.createObjectURL(file));
    setFormData(prev => ({ ...prev, imageFile: file, imageUrl: '', media_type: mediaType }));
    setUploadProgress('idle');
  }

  function updateField(field: 'badge' | 'title' | 'subtitle', lang: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalImageUrl = formData.imageUrl;
      if (formData.imageFile) {
        try {
          setUploadProgress('uploading');
          finalImageUrl = await uploadSlideAsset(formData.imageFile);
          setUploadProgress('done');
        } catch {
          setUploadProgress('error');
          finalImageUrl = '';
        }
      }
      const payload = {
        badge: formData.badge,
        title: formData.title,
        subtitle: formData.subtitle,
        image_url: finalImageUrl || null,
        bg_color: formData.bg_color,
        text_color: formData.text_color,
        badge_bg_color: formData.badge_bg_color,
        badge_text_color: formData.badge_text_color,
        title_size_offset: formData.title_size_offset,
        subtitle_size_offset: formData.subtitle_size_offset,
        badge_size_offset: formData.badge_size_offset,
        sort_order: parseInt(formData.sort_order) || 0,
        is_active: formData.is_active,
        link_url: formData.link_url || null,
        display_mode: formData.display_mode,
        media_type: formData.media_type,
      };
      if (!supabase) throw new Error('클라이언트 없음');
      if (editingId) {
        const { error } = await supabase
          .from('carousel_slides')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('carousel_slides').insert([payload]);
        if (error) throw error;
      }
      revalidateHomepageData('carousel');
      onSaved();
    } catch (err) {
      console.error('슬라이드 저장 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg">
            {editingId ? '슬라이드 수정' : '새 슬라이드 추가'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              배너 표시 모드
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, display_mode: 'default' }))}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  formData.display_mode === 'default'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-5 rounded border border-gray-300 bg-gray-100 flex">
                    <div className="w-1/2 flex items-center justify-center text-[6px] text-gray-400">
                      T
                    </div>
                    <div className="w-1/2 bg-gray-300 rounded-r" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">기본형</span>
                </div>
                <p className="text-[10px] text-gray-500">텍스트 + 이미지 분리 레이아웃</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, display_mode: 'fullpage' }))}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  formData.display_mode === 'fullpage'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-5 rounded border border-gray-300 bg-gray-400 flex items-center justify-center text-[6px] text-white font-bold">
                    FULL
                  </div>
                  <span className="text-sm font-semibold text-gray-800">풀페이지</span>
                </div>
                <p className="text-[10px] text-gray-500">이미지 전체 배너 (텍스트 오버레이)</p>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              슬라이드 이미지
            </label>
            <div
              className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer group ${
                previewUrl ? 'border-gray-200' : 'border-gray-200 hover:border-gray-400'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div className="relative">
                  {formData.media_type === 'video' ? (
                    <video
                      src={previewUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-44 object-contain rounded-xl bg-gray-50"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="미리보기"
                      className="w-full h-44 object-contain rounded-xl bg-gray-50"
                    />
                  )}
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setPreviewUrl('');
                      setFormData(prev => ({ ...prev, imageFile: null, imageUrl: '' }));
                      setUploadProgress('idle');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {uploadProgress === 'uploading' && (
                    <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                      <div className="text-sm text-gray-700 font-semibold animate-pulse">
                        업로드 중...
                      </div>
                    </div>
                  )}
                  {uploadProgress === 'done' && (
                    <div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">
                      업로드 완료
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-36 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-600 transition-colors">
                  <Upload className="w-8 h-8 mb-2" />
                  <p className="text-sm font-semibold">클릭하여 이미지 업로드</p>
                  <p className="text-xs mt-1">JPG, PNG, WEBP, GIF, MP4 — 최대 20MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              className="hidden"
              onChange={handleFileSelect}
            />
            {!formData.imageFile && (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-[10px] text-gray-400 font-semibold">
                    또는 URL 직접 입력
                  </span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, imageUrl: e.target.value }));
                    setPreviewUrl(e.target.value);
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                />
              </>
            )}
          </div>

          <div>
            <div className="flex gap-1 mb-4">
              {SUPPORTED_LANGS.map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setActiveLang(l)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                    activeLang === l
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {LANG_LABELS[l]}
                  {(formData.badge[l] || formData.title[l]) && (
                    <span className="ml-1 w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-1 mb-4">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                뱃지 ({LANG_LABELS[activeLang as keyof typeof LANG_LABELS]})
              </label>
              <input
                type="text"
                value={formData.badge[activeLang] || ''}
                onChange={e => updateField('badge', activeLang, e.target.value)}
                placeholder={activeLang === 'kr' ? '수분천재 크림' : 'Moisture Cream'}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              />
            </div>

            <div className="space-y-1 mb-4">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                제목 ({LANG_LABELS[activeLang as keyof typeof LANG_LABELS]}){' '}
                {activeLang === 'kr' && '*'}
              </label>
              <textarea
                required={activeLang === 'kr'}
                rows={3}
                value={formData.title[activeLang] || ''}
                onChange={e => updateField('title', activeLang, e.target.value)}
                placeholder={activeLang === 'kr' ? '강력한\n고보습 케어' : 'Intense\nMoisture Care'}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                부제목 ({LANG_LABELS[activeLang as keyof typeof LANG_LABELS]})
              </label>
              <input
                type="text"
                value={formData.subtitle[activeLang] || ''}
                onChange={e => updateField('subtitle', activeLang, e.target.value)}
                placeholder={
                  activeLang === 'kr'
                    ? '사계절 + 속수분 + 윤광 + 모공쫀쫀'
                    : 'All-season + Deep hydration + Glow'
                }
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              클릭 링크 URL (선택)
            </label>
            <input
              type="text"
              value={formData.link_url}
              onChange={e => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
              placeholder="예: /kr/products 또는 https://example.com"
              className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
            />
            <p className="text-[10px] text-gray-400">
              입력하면 슬라이드 클릭 시 해당 링크로 이동합니다. 비워두면 클릭 비활성.
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              색상 설정
            </p>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  { key: 'bg_color', label: '배경색' },
                  { key: 'text_color', label: '제목·부제목 색상' },
                  { key: 'badge_bg_color', label: '뱃지 배경색' },
                  { key: 'badge_text_color', label: '뱃지 폰트 색상' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData[key]}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-14 h-10 rounded border border-gray-200 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={formData[key]}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                      className="flex-1 border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                폰트 크기 조절
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                기본 크기 대비 ± px 단위로 조정 (예: -4 = 작게, +4 = 크게). 미리보기는 데스크탑 기준
                실제 크기입니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  { key: 'badge', label: '뱃지', basePx: 12, sample: '뱃지' },
                  { key: 'title', label: '제목', basePx: 48, sample: '제목' },
                  { key: 'subtitle', label: '부제목', basePx: 16, sample: '부제목' },
                ] as const
              ).map(({ key, label, basePx, sample }) => {
                const offsetField = `${key}_size_offset` as
                  | 'badge_size_offset'
                  | 'title_size_offset'
                  | 'subtitle_size_offset';
                const offset = formData[offsetField] || 0;
                const effectivePx = basePx + offset;
                const sampleText = (formData[key][activeLang] || sample).split('\n')[0];
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <label className="text-[10px] font-semibold text-gray-500">{label}</label>
                      <span className="text-[10px] text-gray-400 font-mono">= {effectivePx}px</span>
                    </div>
                    <input
                      type="number"
                      value={offset}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          [offsetField]: parseInt(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                      className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                    />
                    <div
                      className="px-2 py-1.5 border border-gray-200 rounded bg-white overflow-hidden truncate"
                      style={{ fontSize: `${effectivePx}px`, lineHeight: 1.15 }}
                      title={sampleText}
                    >
                      {sampleText}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div className="space-y-1">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                표시 순서
              </label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={e => setFormData(prev => ({ ...prev, sort_order: e.target.value }))}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                상태
              </label>
              <select
                value={formData.is_active ? 'active' : 'inactive'}
                onChange={e =>
                  setFormData(prev => ({ ...prev, is_active: e.target.value === 'active' }))
                }
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#111111] text-white px-8 py-2.5 rounded text-sm font-bold tracking-widest hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  저장 중...
                </>
              ) : editingId ? (
                '수정 저장'
              ) : (
                '슬라이드 저장'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
