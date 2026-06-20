'use client';

import { Pencil, Trash2, Eye, EyeOff, Menu as MenuIcon } from 'lucide-react';
import { SUPPORTED_LANGS } from '@/lib/i18n/types';
import type { PageBlock } from '@/lib/pages/blocks';

type LangMap = Record<string, string>;
type BlocksMap = Record<string, PageBlock[]>;

export interface Page {
  id: string;
  slug: string;
  title: LangMap;
  content: LangMap;
  blocks: BlocksMap | null;
  is_published: boolean;
  show_in_nav: boolean;
  nav_order: number;
  created_at: string;
}

interface Props {
  pages: Page[];
  onEdit: (page: Page) => void;
  onDelete: (id: string) => void;
  onTogglePublish: (page: Page) => void;
}

const getTitle = (page: Page) =>
  page.title?.kr || page.title?.en || Object.values(page.title || {})[0] || '(제목 없음)';

export default function PagesListTable({ pages, onEdit, onDelete, onTogglePublish }: Props) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[11px] uppercase tracking-wider text-[#6b7280] font-semibold">
          <th className="p-3 pl-4">제목</th>
          <th className="p-3">경로</th>
          <th className="p-3">언어</th>
          <th className="p-3">메뉴</th>
          <th className="p-3">상태</th>
          <th className="p-3 pr-4 text-right">작업</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#f3f4f6]">
        {pages.map(page => {
          const filledLangs = SUPPORTED_LANGS.filter(l => page.title?.[l] || page.content?.[l]);
          return (
            <tr key={page.id} className="hover:bg-[#fafbfc] transition-colors">
              <td className="p-3 pl-4 font-bold text-[#1f2937] text-[12px]">{getTitle(page)}</td>
              <td className="p-3 text-[#6b7280] text-xs font-mono">/pages/{page.slug}</td>
              <td className="p-3">
                <div className="flex gap-1">
                  {filledLangs.map(l => (
                    <span key={l} className="px-1.5 py-0.5 bg-[#f3f4f6] text-[#6b7280] text-[9px] font-bold rounded uppercase">{l}</span>
                  ))}
                </div>
              </td>
              <td className="p-3">
                {page.show_in_nav ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#eff6ff] text-[#1d4ed8] text-[10px] font-bold rounded">
                    <MenuIcon className="w-3 h-3" /> {page.nav_order}
                  </span>
                ) : (
                  <span className="text-[10px] text-[#d1d5db]">-</span>
                )}
              </td>
              <td className="p-3">
                <button onClick={() => onTogglePublish(page)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors ${
                    page.is_published ? 'bg-[#dcfce7] text-[#15803d] hover:bg-[#bbf7d0]' : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
                  }`}>
                  {page.is_published ? <><Eye className="w-3 h-3" /> 게시</> : <><EyeOff className="w-3 h-3" /> 임시</>}
                </button>
              </td>
              <td className="p-3 pr-4 text-right flex gap-1.5 justify-end">
                <button onClick={() => onEdit(page)} className="text-[#9ca3af] hover:text-[#3b82f6] transition-colors p-1.5 rounded hover:bg-[#f3f4f6]">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(page.id)} className="text-[#9ca3af] hover:text-[#ef4444] transition-colors p-1.5 rounded hover:bg-[#f3f4f6]">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
