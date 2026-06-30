'use client';

import { Plus, Image as ImageIcon, Eye, EyeOff, Video } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip, PageHeader } from '@/components/admin/CafeWidgets';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/Toast';
import { USE_RDS_FROM_BROWSER } from '@/lib/admin/rdsFlag';

const supabase = getSupabaseBrowser();
import type { CarouselSlide } from '@/lib/api/carousel';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import CarouselList from './_components/CarouselList';
import CarouselSlideModal from './_components/CarouselSlideModal';
import { emptyForm, formFromSlide, type SlideFormData } from './_lib';

/**
 * admin/carousel — split into Page + List + SlideModal + _lib.
 *
 * Mirrors the admin/products and admin/worldwide pattern. Page owns the
 * slide list + open/close + delete + toggle; SlideModal owns the form state
 * and submits its own writes, then asks the page to refetch via `onSaved`.
 */

export default function CarouselAdminPage() {
  const confirm = useConfirm();
  const toast = useToast();
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
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch('/api/admin/carousel-slides', { cache: 'no-store' });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const { rows } = await res.json() as { rows: CarouselSlide[] };
        setSlides(rows);
      } else {
        if (!supabase) throw new Error('클라이언트 없음');
        const { data, error } = await supabase
          .from('carousel_slides')
          .select('*')
          .order('sort_order', { ascending: true });
        if (error) throw error;
        setSlides(data || []);
      }
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
    const ok = await confirm({ message: '이 슬라이드를 삭제하시겠습니까?', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    // Snapshot for rollback. A network/500 failure here was silently
    // removing the slide from the admin UI while it stayed live on
    // the homepage — operator believed the slide was gone, customers
    // still saw it.
    const previous = slides;
    setSlides(prev => prev.filter(s => s.id !== id));
    try {
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch(`/api/admin/carousel-slides?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`http ${res.status}`);
      } else if (supabase) {
        const { error } = await supabase.from('carousel_slides').delete().eq('id', id);
        if (error) throw error;
      }
      await revalidateHomepageData('carousel');
    } catch (err) {
      console.error('[admin/carousel] delete failed:', err);
      setSlides(previous);
      toast.show('삭제에 실패했습니다. 다시 시도해주세요.', 'error');
    }
  }

  async function handleToggle(id: string, current: boolean) {
    // Snapshot for rollback. Without this an operator clicks "deactivate"
    // and sees the slide go dim — but if the PATCH fails silently the
    // slide is still active on the public homepage.
    const previous = slides;
    setSlides(prev => prev.map(s => (s.id === id ? { ...s, is_active: !current } : s)));
    try {
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch(`/api/admin/carousel-slides?id=${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !current }),
        });
        if (!res.ok) throw new Error(`http ${res.status}`);
      } else if (supabase) {
        const { error } = await supabase.from('carousel_slides').update({ is_active: !current }).eq('id', id);
        if (error) throw error;
      }
      await revalidateHomepageData('carousel');
    } catch (err) {
      console.error('[admin/carousel] toggle failed:', err);
      setSlides(previous);
      toast.show('상태 변경에 실패했습니다.', 'error');
    }
  }

  async function handleReorder(next: CarouselSlide[]) {
    // Renumber sort_order at fixed increments of 10 so future single-slot
    // inserts (manual sort_order=15 etc.) don't require renumbering the
    // whole list immediately. Local state updates optimistically; on
    // persist failure we roll back AND toast — the previous behavior of
    // logging silently meant operators thought their drag-reorder had
    // saved when in fact a 401/500/network blip dropped it on the
    // floor, only resurfacing the original order on the next refresh.
    const previous = slides;
    const renumbered = next.map((s, i) => ({ ...s, sort_order: (i + 1) * 10 }));
    setSlides(renumbered);
    try {
      if (USE_RDS_FROM_BROWSER) {
        const responses = await Promise.all(renumbered.map(s =>
          fetch(`/api/admin/carousel-slides?id=${encodeURIComponent(s.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: s.sort_order }),
          }),
        ));
        const failed = responses.find(r => !r.ok);
        if (failed) throw new Error(`carousel_reorder_http_${failed.status}`);
      } else if (supabase) {
        const results = await Promise.all(
          renumbered.map(s =>
            supabase.from('carousel_slides').update({ sort_order: s.sort_order }).eq('id', s.id),
          ),
        );
        const failed = results.find(r => r.error);
        if (failed?.error) throw failed.error;
      }
      await revalidateHomepageData('carousel');
    } catch (err) {
      console.error('[admin/carousel] reorder persist failed:', err);
      setSlides(previous);
      toast.show('순서 변경에 실패했습니다. 다시 시도해 주세요.', 'error');
    }
  }

  const initialForm: SlideFormData = editingSlide
    ? formFromSlide(editingSlide)
    : { ...emptyForm, badge: {}, title: {}, subtitle: {} };
  const initialPreview = editingSlide?.image_url || '';

  const stats = useMemo(() => ({
    total: slides.length,
    active: slides.filter(s => s.is_active).length,
    videos: slides.filter(s => s.media_type === 'video').length,
    hidden: slides.filter(s => !s.is_active).length,
  }), [slides]);

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 슬라이드" value={stats.total} icon={ImageIcon} subLabel="등록된 슬라이드" isLoading={isLoading} />
        <StatCard accent="#22c55e" label="게시중" value={stats.active} icon={Eye} subLabel={`전체 ${stats.total}개 중`} isLoading={isLoading} />
        <StatCard accent="#9ca3af" label="숨김" value={stats.hidden} icon={EyeOff} subLabel="비공개 슬라이드" isLoading={isLoading} />
        <StatCard accent="#8b5cf6" label="비디오" value={stats.videos} icon={Video} subLabel="media_type = video" isLoading={isLoading} />
      </StatStrip>

      <PageHeader
        title="캐러셀 관리"
        description="홈페이지 메인 배너 슬라이드를 관리하세요"
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 슬라이드 추가
          </button>
        }
      />

    <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">

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
    </div>
  );
}
