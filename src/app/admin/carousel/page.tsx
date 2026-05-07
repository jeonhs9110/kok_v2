'use client';

import { Plus, Trash2, Upload, X, ImageIcon, Pencil, GripVertical, Link as LinkIcon } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/api/products';
import type { CarouselSlide } from '@/lib/api/carousel';
import { SUPPORTED_LANGS, LANG_LABELS } from '@/lib/i18n/types';

const BUCKET = 'product-images';

interface FormData {
  badge: Record<string, string>;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  bg_color: string;
  text_color: string;
  badge_bg_color: string;
  badge_text_color: string;
  title_size_offset: number;
  subtitle_size_offset: number;
  badge_size_offset: number;
  sort_order: string;
  is_active: boolean;
  imageUrl: string;
  imageFile: File | null;
  link_url: string;
  display_mode: 'default' | 'fullpage';
  media_type: 'image' | 'video' | 'gif';
}

const emptyForm: FormData = {
  badge: {}, title: {}, subtitle: {},
  bg_color: '#eef4f7',
  text_color: '#111111',
  badge_bg_color: '#333333',
  badge_text_color: '#FFFFFF',
  title_size_offset: 0,
  subtitle_size_offset: 0,
  badge_size_offset: 0,
  sort_order: '0', is_active: true, imageUrl: '', imageFile: null, link_url: '',
  display_mode: 'default', media_type: 'image',
};

export default function CarouselAdminPage() {
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [previewUrl, setPreviewUrl] = useState('');
  const [activeLang, setActiveLang] = useState<string>('kr');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<FormData>({ ...emptyForm });

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('클라이언트 없음');
      const { data, error } = await supabase.from('carousel_slides').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      setSlides(data || []);
    } catch {
      setSlides([]);
    } finally {
      setIsLoading(false);
    }
  }

  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  const uploadImage = async (file: File): Promise<string> => {
    if (!supabase) throw new Error('Supabase 클라이언트 없음');
    setUploadProgress('uploading');
    const ext = file.name.split('.').pop() ?? 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `carousel/${fileName}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (uploadError) { setUploadProgress('error'); throw uploadError; }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    setUploadProgress('done');
    return urlData.publicUrl;
  };

  const resetModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ ...emptyForm, badge: {}, title: {}, subtitle: {} });
    setPreviewUrl('');
    setUploadProgress('idle');
    setIsSubmitting(false);
    setActiveLang('kr');
  };

  const openEdit = (s: CarouselSlide) => {
    setEditingId(s.id);
    setFormData({
      badge: { ...s.badge }, title: { ...s.title }, subtitle: { ...s.subtitle },
      bg_color: s.bg_color || '#eef4f7',
      text_color: s.text_color || '#111111',
      badge_bg_color: s.badge_bg_color || '#333333',
      badge_text_color: s.badge_text_color || '#FFFFFF',
      title_size_offset: s.title_size_offset ?? 0,
      subtitle_size_offset: s.subtitle_size_offset ?? 0,
      badge_size_offset: s.badge_size_offset ?? 0,
      sort_order: String(s.sort_order),
      is_active: s.is_active, imageUrl: s.image_url || '', imageFile: null, link_url: s.link_url || '',
      display_mode: s.display_mode || 'default', media_type: s.media_type || 'image',
    });
    setPreviewUrl(s.image_url || '');
    setActiveLang('kr');
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 슬라이드를 삭제하시겠습니까?')) return;
    setSlides(prev => prev.filter(s => s.id !== id));
    if (supabase) await supabase.from('carousel_slides').delete().eq('id', id);
  };

  const handleToggle = async (id: string, current: boolean) => {
    setSlides(prev => prev.map(s => s.id === id ? { ...s, is_active: !current } : s));
    if (supabase) await supabase.from('carousel_slides').update({ is_active: !current }).eq('id', id);
  };

  const updateField = (field: 'badge' | 'title' | 'subtitle', lang: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalImageUrl = formData.imageUrl;
      if (formData.imageFile) {
        try { finalImageUrl = await uploadImage(formData.imageFile); }
        catch { finalImageUrl = ''; }
      }
      const payload = {
        badge: formData.badge, title: formData.title, subtitle: formData.subtitle,
        image_url: finalImageUrl || null, bg_color: formData.bg_color,
        text_color: formData.text_color,
        badge_bg_color: formData.badge_bg_color,
        badge_text_color: formData.badge_text_color,
        title_size_offset: formData.title_size_offset,
        subtitle_size_offset: formData.subtitle_size_offset,
        badge_size_offset: formData.badge_size_offset,
        sort_order: parseInt(formData.sort_order) || 0, is_active: formData.is_active,
        link_url: formData.link_url || null,
        display_mode: formData.display_mode,
        media_type: formData.media_type,
      };
      if (!supabase) throw new Error('클라이언트 없음');
      if (editingId) {
        const { error } = await supabase.from('carousel_slides').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('carousel_slides').insert([payload]);
        if (error) throw error;
      }
      await fetchAll();
      resetModal();
    } catch (err) {
      console.error('슬라이드 저장 실패:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold text-gray-800">캐러셀 관리</h2>
          <p className="text-sm text-gray-500 mt-1">홈페이지 메인 배너 슬라이드를 관리하세요</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-[#111111] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-black transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> 슬라이드 추가
        </button>
      </div>

      <div className="overflow-x-auto min-h-[300px]">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400 font-bold tracking-widest">불러오는 중...</div>
        ) : slides.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">등록된 슬라이드가 없습니다</p>
            <p className="text-xs mt-1">슬라이드 추가 버튼을 눌러 캐러셀을 구성하세요</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="p-4 pl-6 w-12">순서</th>
                <th className="p-4 w-20">이미지</th>
                <th className="p-4">뱃지 / 제목</th>
                <th className="p-4 w-20">모드</th>
                <th className="p-4 w-24">배경색</th>
                <th className="p-4 w-20">상태</th>
                <th className="p-4 pr-6 text-right w-24">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {slides.map((s) => (
                <tr key={s.id} className={`hover:bg-gray-50/50 transition-colors ${!s.is_active ? 'opacity-50' : ''}`}>
                  <td className="p-4 pl-6"><div className="flex items-center gap-1 text-gray-400"><GripVertical className="w-4 h-4" /><span className="text-sm font-mono">{s.sort_order}</span></div></td>
                  <td className="p-4">
                    <div className="w-16 h-12 rounded overflow-hidden bg-gray-100 border border-gray-200">
                      {s.image_url ? (
                        s.media_type === 'video' ? (
                          <video src={s.image_url} muted className="w-full h-full object-cover" />
                        ) : (
                          <img src={s.image_url} className="w-full h-full object-cover" alt="" />
                        )
                      ) : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-gray-300" /></div>}
                    </div>
                  </td>
                  <td className="p-4">
                    <p className="text-[10px] text-gray-400 font-semibold">{s.badge?.kr || ''}</p>
                    <p className="text-sm font-bold text-gray-900 line-clamp-1">{(s.title?.kr || '').replace(/\n/g, ' ')}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{s.subtitle?.kr || ''}</p>
                    {s.link_url && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 mt-1">
                        <LinkIcon className="w-3 h-3" />{s.link_url}
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                        s.display_mode === 'fullpage' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {s.display_mode === 'fullpage' ? '풀페이지' : '기본'}
                      </span>
                      {s.media_type && s.media_type !== 'image' && (
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                          s.media_type === 'video' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'
                        }`}>
                          {s.media_type === 'video' ? 'MP4' : 'GIF'}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: s.bg_color }} /><span className="text-xs text-gray-400 font-mono">{s.bg_color}</span></div></td>
                  <td className="p-4">
                    <button onClick={() => handleToggle(s.id, s.is_active)} className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors ${s.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
                      {s.is_active ? '활성' : '비활성'}
                    </button>
                  </td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex gap-1.5 justify-end">
                      <button onClick={() => openEdit(s)} className="text-gray-400 hover:text-blue-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(s.id)} className="text-gray-400 hover:text-red-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 슬라이드 추가/수정 모달 */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">{editingId ? '슬라이드 수정' : '새 슬라이드 추가'}</h3>
              <button onClick={resetModal} className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">

              {/* Display Mode Toggle */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">배너 표시 모드</label>
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
                        <div className="w-1/2 flex items-center justify-center text-[6px] text-gray-400">T</div>
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
                      <div className="w-8 h-5 rounded border border-gray-300 bg-gray-400 flex items-center justify-center text-[6px] text-white font-bold">FULL</div>
                      <span className="text-sm font-semibold text-gray-800">풀페이지</span>
                    </div>
                    <p className="text-[10px] text-gray-500">이미지 전체 배너 (텍스트 오버레이)</p>
                  </button>
                </div>
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">슬라이드 이미지</label>
                <div className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer group ${previewUrl ? 'border-gray-200' : 'border-gray-200 hover:border-gray-400'}`} onClick={() => fileInputRef.current?.click()}>
                  {previewUrl ? (
                    <div className="relative">
                      {formData.media_type === 'video' ? (
                        <video src={previewUrl} autoPlay muted loop playsInline className="w-full h-44 object-contain rounded-xl bg-gray-50" />
                      ) : (
                        <img src={previewUrl} alt="미리보기" className="w-full h-44 object-contain rounded-xl bg-gray-50" />
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); setPreviewUrl(''); setFormData(prev => ({ ...prev, imageFile: null, imageUrl: '' })); setUploadProgress('idle'); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black transition-colors"><X className="w-4 h-4" /></button>
                      {uploadProgress === 'uploading' && <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center"><div className="text-sm text-gray-700 font-semibold animate-pulse">업로드 중...</div></div>}
                      {uploadProgress === 'done' && <div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">업로드 완료</div>}
                    </div>
                  ) : (
                    <div className="h-36 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-600 transition-colors">
                      <Upload className="w-8 h-8 mb-2" />
                      <p className="text-sm font-semibold">클릭하여 이미지 업로드</p>
                      <p className="text-xs mt-1">JPG, PNG, WEBP, GIF, MP4 — 최대 20MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" className="hidden" onChange={handleFileSelect} />
                {!formData.imageFile && (
                  <>
                    <div className="flex items-center gap-2 mt-2"><div className="h-px flex-1 bg-gray-100" /><span className="text-[10px] text-gray-400 font-semibold">또는 URL 직접 입력</span><div className="h-px flex-1 bg-gray-100" /></div>
                    <input type="url" value={formData.imageUrl} onChange={e => { setFormData(prev => ({ ...prev, imageUrl: e.target.value })); setPreviewUrl(e.target.value); }} placeholder="https://example.com/image.jpg" className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none" />
                  </>
                )}
              </div>

              {/* Language tabs */}
              <div>
                <div className="flex gap-1 mb-4">
                  {SUPPORTED_LANGS.map(l => (
                    <button key={l} type="button" onClick={() => setActiveLang(l)} className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${activeLang === l ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {LANG_LABELS[l]}
                      {(formData.badge[l] || formData.title[l]) && <span className="ml-1 w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />}
                    </button>
                  ))}
                </div>

                {/* Badge */}
                <div className="space-y-1 mb-4">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">뱃지 ({LANG_LABELS[activeLang as keyof typeof LANG_LABELS]})</label>
                  <input type="text" value={formData.badge[activeLang] || ''} onChange={e => updateField('badge', activeLang, e.target.value)} placeholder={activeLang === 'kr' ? '수분천재 크림' : 'Moisture Cream'} className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none" />
                </div>

                {/* Title */}
                <div className="space-y-1 mb-4">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">제목 ({LANG_LABELS[activeLang as keyof typeof LANG_LABELS]}) {activeLang === 'kr' && '*'}</label>
                  <textarea required={activeLang === 'kr'} rows={3} value={formData.title[activeLang] || ''} onChange={e => updateField('title', activeLang, e.target.value)} placeholder={activeLang === 'kr' ? '강력한\n고보습 케어' : 'Intense\nMoisture Care'} className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none resize-none" />
                </div>

                {/* Subtitle */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">부제목 ({LANG_LABELS[activeLang as keyof typeof LANG_LABELS]})</label>
                  <input type="text" value={formData.subtitle[activeLang] || ''} onChange={e => updateField('subtitle', activeLang, e.target.value)} placeholder={activeLang === 'kr' ? '사계절 + 속수분 + 윤광 + 모공쫀쫀' : 'All-season + Deep hydration + Glow'} className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none" />
                </div>
              </div>

              {/* Click Link URL */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">클릭 링크 URL (선택)</label>
                <input
                  type="text"
                  value={formData.link_url}
                  onChange={e => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
                  placeholder="예: /kr/products 또는 https://example.com"
                  className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                />
                <p className="text-[10px] text-gray-400">입력하면 슬라이드 클릭 시 해당 링크로 이동합니다. 비워두면 클릭 비활성.</p>
              </div>

              {/* Color settings */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">색상 설정</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500">배경색</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={formData.bg_color} onChange={e => setFormData(prev => ({ ...prev, bg_color: e.target.value }))} className="w-14 h-10 rounded border border-gray-200 cursor-pointer p-0" />
                      <input type="text" value={formData.bg_color} onChange={e => setFormData(prev => ({ ...prev, bg_color: e.target.value }))} className="flex-1 border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500">제목·부제목 색상</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={formData.text_color} onChange={e => setFormData(prev => ({ ...prev, text_color: e.target.value }))} className="w-14 h-10 rounded border border-gray-200 cursor-pointer p-0" />
                      <input type="text" value={formData.text_color} onChange={e => setFormData(prev => ({ ...prev, text_color: e.target.value }))} className="flex-1 border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500">뱃지 배경색</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={formData.badge_bg_color} onChange={e => setFormData(prev => ({ ...prev, badge_bg_color: e.target.value }))} className="w-14 h-10 rounded border border-gray-200 cursor-pointer p-0" />
                      <input type="text" value={formData.badge_bg_color} onChange={e => setFormData(prev => ({ ...prev, badge_bg_color: e.target.value }))} className="flex-1 border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none font-mono" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500">뱃지 폰트 색상</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={formData.badge_text_color} onChange={e => setFormData(prev => ({ ...prev, badge_text_color: e.target.value }))} className="w-14 h-10 rounded border border-gray-200 cursor-pointer p-0" />
                      <input type="text" value={formData.badge_text_color} onChange={e => setFormData(prev => ({ ...prev, badge_text_color: e.target.value }))} className="flex-1 border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none font-mono" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Font size offsets */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">폰트 크기 조절</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">기본 크기 대비 ± px 단위로 조정 (예: -4 = 작게, +4 = 크게)</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500">뱃지</label>
                    <input type="number" value={formData.badge_size_offset} onChange={e => setFormData(prev => ({ ...prev, badge_size_offset: parseInt(e.target.value) || 0 }))} placeholder="0" className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500">제목</label>
                    <input type="number" value={formData.title_size_offset} onChange={e => setFormData(prev => ({ ...prev, title_size_offset: parseInt(e.target.value) || 0 }))} placeholder="0" className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-500">부제목</label>
                    <input type="number" value={formData.subtitle_size_offset} onChange={e => setFormData(prev => ({ ...prev, subtitle_size_offset: parseInt(e.target.value) || 0 }))} placeholder="0" className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none" />
                  </div>
                </div>
              </div>

              {/* Sort order + Active */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">표시 순서</label>
                  <input type="number" value={formData.sort_order} onChange={e => setFormData(prev => ({ ...prev, sort_order: e.target.value }))} className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">상태</label>
                  <select value={formData.is_active ? 'active' : 'inactive'} onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.value === 'active' }))} className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none">
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={resetModal} className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded text-sm font-semibold hover:bg-gray-50 transition-colors">취소</button>
                <button type="submit" disabled={isSubmitting} className="bg-[#111111] text-white px-8 py-2.5 rounded text-sm font-bold tracking-widest hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                  {isSubmitting ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />저장 중...</>) : editingId ? '수정 저장' : '슬라이드 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
