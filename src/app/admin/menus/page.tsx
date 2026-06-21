'use client';

import { Plus, MessageSquare, MenuSquare, Layers } from 'lucide-react';
import { StatCard, StatStrip, PageHeader, EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import MenuRows from './_components/MenuRows';
import MenuModal from './_components/MenuModal';
import { useMenus } from './_components/useMenus';

export default function MenusAdminPage() {
  const m = useMenus();

  const subCount = m.menus.filter(x => x.parent_id).length;
  const stats = {
    total: m.menus.length,
    parents: m.parents.length,
    subs: subCount,
    boards: m.menus.filter(x => x.page_type === 'board').length,
  };

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 메뉴" value={stats.total} icon={MenuSquare} subLabel="대분류 + 하위 합계" />
        <StatCard accent="#22c55e" label="대분류" value={stats.parents} icon={MenuSquare} subLabel="헤더 직속" />
        <StatCard accent="#8b5cf6" label="하위 메뉴" value={stats.subs} icon={Layers} subLabel="드롭다운 항목" />
        <StatCard accent="#f59e0b" label="게시판형" value={stats.boards} icon={MessageSquare} subLabel="board 페이지 타입" />
      </StatStrip>

      <PageHeader
        title="메뉴 관리"
        description="헤더 내비게이션 메뉴를 관리합니다 · 페이지 또는 게시판 형태"
        actions={
          <button onClick={() => m.openAdd()} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] transition-colors">
            <Plus className="w-3.5 h-3.5" /> 메뉴 추가
          </button>
        }
      />

      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        {m.isLoading ? (
          <LoadingState />
        ) : m.parents.length === 0 ? (
          <EmptyState label="등록된 메뉴가 없습니다 · 위 버튼을 눌러 추가하세요" />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[11px] uppercase tracking-wider text-[#6b7280] font-semibold">
                <th className="p-3 pl-4">순서</th>
                <th className="p-3">메뉴명</th>
                <th className="p-3">슬러그</th>
                <th className="p-3">타입</th>
                <th className="p-3">상태</th>
                <th className="p-3 pr-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {m.parents.map(parent => (
                <MenuRows
                  key={parent.id}
                  parent={parent}
                  subItems={m.getChildren(parent.id)}
                  onEdit={m.openEdit}
                  onDelete={m.handleDelete}
                  onAddChild={() => m.openAdd(parent.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <MenuModal
        open={m.modalOpen}
        editingId={m.editingId}
        form={m.form}
        parents={m.parents}
        activeLang={m.activeLang}
        onActiveLangChange={m.setActiveLang}
        onFormChange={m.setForm}
        onClose={m.closeModal}
        onSave={m.handleSave}
      />
    </div>
  );
}
