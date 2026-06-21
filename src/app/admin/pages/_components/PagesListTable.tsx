'use client';

import { Pencil, Trash2, Menu as MenuIcon } from 'lucide-react';
import { SUPPORTED_LANGS } from '@/lib/i18n/types';
import { StatusDot, TableShell, TableHeaderRow } from '@/components/admin/CafeWidgets';
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
    <TableShell>
      <thead>
        <TableHeaderRow>
          <th className="px-4 py-2.5">제목</th>
          <th className="px-4 py-2.5">경로</th>
          <th className="px-4 py-2.5">언어</th>
          <th className="px-4 py-2.5">메뉴</th>
          <th className="px-4 py-2.5">상태</th>
          <th className="px-4 py-2.5 text-right">작업</th>
        </TableHeaderRow>
      </thead>
      <tbody className="divide-y divide-[#f3f4f6]">
        {pages.map(page => {
          const filledLangs = SUPPORTED_LANGS.filter(l => page.title?.[l] || page.content?.[l]);
          return (
            <tr key={page.id} className="hover:bg-[#fafbfc] transition-colors">
              <td className="px-4 py-2 font-semibold text-[#1f2937] text-[12.5px]">{getTitle(page)}</td>
              <td className="px-4 py-2 text-[#6b7280] text-[11px] font-mono">/pages/{page.slug}</td>
              <td className="px-4 py-2">
                <div className="flex gap-1">
                  {filledLangs.map(l => (
                    <span key={l} className="px-1 py-0 bg-[#f3f4f6] text-[#6b7280] text-[9.5px] font-bold rounded uppercase border border-[#e5e7eb]">{l}</span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-2">
                {page.show_in_nav ? (
                  <span className="inline-flex items-center gap-1 text-[11.5px] text-[#2563eb]">
                    <MenuIcon className="w-3 h-3" /> {page.nav_order}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#d1d5db]">-</span>
                )}
              </td>
              <td className="px-4 py-2">
                <StatusDot
                  tone={page.is_published ? 'active' : 'inactive'}
                  label={page.is_published ? '게시' : '임시'}
                  onClick={() => onTogglePublish(page)}
                  title={page.is_published ? '클릭하여 임시로 전환' : '클릭하여 게시로 전환'}
                />
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex gap-0.5 justify-end">
                  <button onClick={() => onEdit(page)} className="text-[#9ca3af] hover:text-[#3b82f6] transition-colors p-1 rounded hover:bg-[#f3f4f6]">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(page.id)} className="text-[#9ca3af] hover:text-[#ef4444] transition-colors p-1 rounded hover:bg-[#f3f4f6]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </TableShell>
  );
}
