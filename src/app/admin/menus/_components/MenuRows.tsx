'use client';

import { Pencil, Trash2, Plus, ChevronRight, MessageSquare, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { Menu } from '@/lib/api/menus';

interface Props {
  parent: Menu;
  subItems: Menu[];
  onEdit: (m: Menu) => void;
  onDelete: (id: string, h: boolean) => void;
  onAddChild: () => void;
}

const typeIcon = (m: Menu) =>
  m.page_type === 'board'
    ? <MessageSquare className="w-3.5 h-3.5 text-[#3b82f6]" />
    : <FileText className="w-3.5 h-3.5 text-[#9ca3af]" />;

const typeLabel = (m: Menu) => {
  if (m.page_type === 'board') return m.board_write_role === 'user' ? '게시판 (소비자)' : '게시판 (관리자)';
  return '페이지';
};

export default function MenuRows({ parent, subItems, onEdit, onDelete, onAddChild }: Props) {
  return (
    <>
      <tr className="hover:bg-[#fafbfc] transition-colors">
        <td className="p-3 pl-4 text-[12px] text-[#6b7280] w-16">{parent.sort_order}</td>
        <td className="p-3">
          <span className="font-bold text-[#1f2937] text-sm">{parent.title.kr || parent.slug}</span>
          {parent.title.en && <span className="ml-2 text-xs text-[#9ca3af]">{parent.title.en}</span>}
        </td>
        <td className="p-3 text-[12px] text-[#6b7280] font-mono">{parent.slug}</td>
        <td className="p-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-[#6b7280]">
            {typeIcon(parent)} {typeLabel(parent)}
          </span>
        </td>
        <td className="p-3">
          <div className="flex gap-1.5">
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${parent.is_published ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
              {parent.is_published ? '게시' : '비공개'}
            </span>
            {parent.show_in_nav && <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-[#eff6ff] text-[#1d4ed8]">네비</span>}
          </div>
        </td>
        <td className="p-3 pr-4 text-right">
          <div className="flex gap-1 justify-end">
            {parent.page_type === 'board' && (
              <Link href={`/admin/menus/${parent.id}/posts`} title="게시글 관리" className="text-[#9ca3af] hover:text-[#3b82f6] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
            <button onClick={onAddChild} title="서브메뉴 추가" className="text-[#9ca3af] hover:text-[#3b82f6] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => onEdit(parent)} title="수정" className="text-[#9ca3af] hover:text-[#d97706] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            {parent.slug !== 'support' && (
              <button onClick={() => onDelete(parent.id, subItems.length > 0)} title="삭제" className="text-[#9ca3af] hover:text-[#ef4444] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {subItems.map(child => (
        <tr key={child.id} className="hover:bg-[#fafbfc] transition-colors bg-[#fafbfc]/30">
          <td className="p-3 pl-4 text-[12px] text-[#9ca3af] w-16">{child.sort_order}</td>
          <td className="p-3 pl-10">
            <span className="flex items-center gap-1.5 text-sm text-[#374151]">
              <ChevronRight className="w-3 h-3 text-[#d1d5db]" />
              {child.title.kr || child.slug}
              {child.title.en && <span className="ml-1 text-xs text-[#9ca3af]">{child.title.en}</span>}
            </span>
          </td>
          <td className="p-3 text-[12px] text-[#9ca3af] font-mono">{child.slug}</td>
          <td className="p-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-[#6b7280]">
              {typeIcon(child)} {typeLabel(child)}
            </span>
          </td>
          <td className="p-3">
            <div className="flex gap-1.5">
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${child.is_published ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
                {child.is_published ? '게시' : '비공개'}
              </span>
            </div>
          </td>
          <td className="p-3 pr-4 text-right">
            <div className="flex gap-1 justify-end">
              {child.page_type === 'board' && (
                <Link href={`/admin/menus/${child.id}/posts`} title="게시글 관리" className="text-[#9ca3af] hover:text-[#3b82f6] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </Link>
              )}
              <button onClick={() => onEdit(child)} title="수정" className="text-[#9ca3af] hover:text-[#d97706] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(child.id, false)} title="삭제" className="text-[#9ca3af] hover:text-[#ef4444] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
