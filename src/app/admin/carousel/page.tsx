'use client';

import { Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

const supabase = getSupabaseBrowser();
import type { CarouselSlide } from '@/lib/api/carousel';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { resolveAnchor } from '@/lib/typography/options';
import CarouselList from './_components/CarouselList';
import CarouselSlideModal from './_components/CarouselSlideModal';
import { emptyForm, type SlideFormData } from './_lib';

/**
 * admin/carousel — split into Page + List + SlideModal + _lib.
 *
 * Mirrors the admin/products and admin/worldwide pattern. Page owns the
 * slide list + open/close + delete + toggle; SlideModal owns the form state
 * and submits its own writes, then asks the page to refetch via `onSaved`.
 *
 * The modal mounts conditionally (inside the `{isModalOpen && …}` branch)
 * so its form state is naturally torn down on every close — no manual
 * reset needed.
 */

function formFromSlide(s: CarouselSlide): SlideFormData {
  return {
    badge: { ...s.badge },
    title: { ...s.title },
    subtitle: { ...s.subtitle },
    bg_color: s.bg_color || '#eef4f7',
    text_color: s.text_color || '#111111',
    badge_bg_color: s.badge_bg_color || '#333333',
    badge_text_color: s.badge_text_color || '#FFFFFF',
    title_size_offset: s.title_size_offset ?? 0,
    subtitle_size_offset: s.subtitle_size_offset ?? 0,
    badge_size_offset: s.badge_size_offset ?? 0,
    sort_order: String(s.sort_order),
    is_active: s.is_active,
    imageUrl: s.image_url || '',
    imageFile: null,
    mobileImageUrl: s.mobile_image_url || '',
    mobileImageFile: null,
    link_url: s.link_url || '',
    display_mode: s.display_mode || 'default',
    media_type: s.media_type || 'image',
    badge_font_family: s.badge_font_family ?? null,
    title_font_family: s.title_font_family ?? null,
    subtitle_font_family: s.subtitle_font_family ?? null,
    badge_bold:        s.badge_bold        ?? false,
    badge_italic:      s.badge_italic      ?? false,
    badge_underline:   s.badge_underline   ?? false,
    title_bold:        s.title_bold        ?? true,
    title_italic:      s.title_italic      ?? false,
    title_underline:   s.title_underline   ?? false,
    subtitle_bold:     s.subtitle_bold     ?? false,
    subtitle_italic:   s.subtitle_italic   ?? false,
    subtitle_underline: s.subtitle_underline ?? false,
    text_position:         (s.text_position as SlideFormData['text_position']) ?? 'mc',
    text_position_mobile:  (s.text_position_mobile as SlideFormData['text_position_mobile']) ?? 'mc',
    image_position:        (s.image_position as SlideFormData['image_position']) ?? 'mc',
    image_position_mobile: (s.image_position_mobile as SlideFormData['image_position_mobile']) ?? 'mc',
    // Migration 30 anchors. resolveAnchor() prefers the new column when
    // populated and falls back to the legacy 9-cell key on rows from
    // before the migration ran.
    text_anchor:          resolveAnchor(s.text_anchor, s.text_position),
    text_anchor_mobile:   resolveAnchor(s.text_anchor_mobile, s.text_position_mobile),
    image_anchor:         resolveAnchor(s.image_anchor, s.image_position),
    image_anchor_mobile:  resolveAnchor(s.image_anchor_mobile, s.image_position_mobile),
  };
}

export default function CarouselAdminPage() {
  const [slides, setSlides] = useState<CarouselSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSlide, setEditingSlide] = useState<CarouselSlide | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('클라이언트 없음');
      const { data, error } = await supabase
        .from('carousel_slides')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setSlides(data || []);
    } catch {
      setSlides([]);
    } finally {
      setIsLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setEditingSlide(null);
    setIsModalOpen(true);
  }

  function openEdit(slide: CarouselSlide) {
    setEditingId(slide.id);
    setEditingSlide(slide);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setEditingSlide(null);
  }

  async function handleSaved() {
    await fetchAll();
    closeModal();
  }

  async function handleDelete(id: string) {
    if (!confirm('이 슬라이드를 삭제하시겠습니까?')) return;
    setSlides(prev => prev.filter(s => s.id !== id));
    if (supabase) {
      await supabase.from('carousel_slides').delete().eq('id', id);
      revalidateHomepageData('carousel');
    }
  }

  async function handleToggle(id: string, current: boolean) {
    setSlides(prev => prev.map(s => (s.id === id ? { ...s, is_active: !current } : s)));
    if (supabase) {
      await supabase.from('carousel_slides').update({ is_active: !current }).eq('id', id);
      revalidateHomepageData('carousel');
    }
  }

  async function handleReorder(next: CarouselSlide[]) {
    // Renumber sort_order at fixed increments of 10 so future single-slot
    // inserts (manual sort_order=15 etc.) don't require renumbering the
    // whole list immediately. Local state updates optimistically; failed
    // writes get logged but don't block the user — the next fetchAll()
    // will resync from the server.
    const renumbered = next.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 }));
    setSlides(renumbered);
    if (!supabase) return;
    try {
      await Promise.all(
        renumbered.map(s =>
          supabase.from('carousel_slides').update({ sort_order: s.sort_order }).eq('id', s.id),
        ),
      );
      revalidateHomepageData('carousel');
    } catch (err) {
      console.error('[admin/carousel] reorder persist failed:', err);
    }
  }

  const initialForm: SlideFormData = editingSlide
    ? formFromSlide(editingSlide)
    : { ...emptyForm, badge: {}, title: {}, subtitle: {} };
  const initialPreview = editingSlide?.image_url || '';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold text-gray-800">캐러셀 관리</h2>
          <p className="text-sm text-gray-500 mt-1">홈페이지 메인 배너 슬라이드를 관리하세요</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-brand-ink text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-black transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> 슬라이드 추가
        </button>
      </div>

      <div className="overflow-x-auto min-h-[300px]">
        <CarouselList
          slides={slides}
          isLoading={isLoading}
          onEdit={openEdit}
          onDelete={handleDelete}
          onToggleActive={handleToggle}
          onReorder={handleReorder}
        />
      </div>

      {isModalOpen && (
        <CarouselSlideModal
          editingId={editingId}
          initialForm={initialForm}
          initialPreviewUrl={initialPreview}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
