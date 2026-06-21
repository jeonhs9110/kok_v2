'use client';

import { Plus } from 'lucide-react';
import { PageHeader, EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import PagesListTable from './_components/PagesListTable';
import PageEditorModal from './_components/PageEditorModal';
import { usePages } from './_components/usePages';

const autoSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);

export default function PagesAdminPage() {
  const p = usePages();

  return (
    <div className="space-y-5">
      <PageHeader
        title="페이지 관리"
        description="메뉴에 표시할 페이지를 추가하고 관리하세요 (다국어 지원)"
        actions={
          <button
            onClick={p.openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 새 페이지
          </button>
        }
      />

      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          {p.isLoading ? (
            <LoadingState />
          ) : p.pages.length === 0 ? (
            <EmptyState label="등록된 페이지가 없습니다 · 새 페이지 버튼을 눌러 추가하세요" />
          ) : (
            <PagesListTable
              pages={p.pages}
              onEdit={p.openEdit}
              onDelete={p.handleDelete}
              onTogglePublish={p.togglePublish}
            />
          )}
        </div>

        {p.isModalOpen && (
          <PageEditorModal
            editingId={p.editingId}
            activeLang={p.activeLang}
            editorMode={p.editorMode}
            formData={p.formData}
            isSubmitting={p.isSubmitting}
            onClose={p.resetModal}
            onActiveLangChange={p.setActiveLang}
            onEditorModeChange={p.setEditorMode}
            onFormChange={p.setFormData}
            onSubmit={p.handleSubmit}
            autoSlug={autoSlug}
          />
        )}
      </div>
    </div>
  );
}
