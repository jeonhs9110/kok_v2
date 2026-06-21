'use client';

import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import type { Category } from '@/lib/api/categories';

interface Props {
  parent: Category;
  subItems: Category[];
  onEdit: (c: Category) => void;
  onDelete: (id: string, hasChildren: boolean) => void;
  onAddChild: () => void;
}

export default function CategoryRows({ parent, subItems, onEdit, onDelete, onAddChild }: Props) {
  return (
    <>
      <tr className="hover:bg-[#fafbfc] transition-colors">
        <td className="p-3 pl-4 text-[12px] text-[#6b7280] w-16">{parent.sort_order}</td>
        <td className="p-3">
          <span className="font-bold text-[#1f2937] text-sm">{parent.name.kr || parent.slug}</span>
          {parent.name.en && <span className="ml-2 text-xs text-[#9ca3af]">{parent.name.en}</span>}
        </td>
        <td className="p-3 text-[12px] text-[#6b7280] font-mono">{parent.slug}</td>
        <td className="p-3">
          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${parent.is_active ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
            {parent.is_active ? '활성' : '비활성'}
          </span>
        </td>
        <td className="p-3 pr-4 text-right">
          <div className="flex gap-1 justify-end">
            <button onClick={onAddChild} title="서브카테고리 추가" className="text-[#9ca3af] hover:text-[#3b82f6] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => onEdit(parent)} title="수정" className="text-[#9ca3af] hover:text-[#d97706] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(parent.id, subItems.length > 0)} title="삭제" className="text-[#9ca3af] hover:text-[#ef4444] p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {subItems.map(child => (
        <tr key={child.id} className="hover:bg-[#fafbfc] transition-colors bg-[#fafbfc]/30">
          <td className="p-3 pl-4 text-[12px] text-[#9ca3af] w-16">{child.sort_order}</td>
          <td className="p-3 pl-10">
            <span className="flex items-center gap-1.5 text-sm text-[#374151]">
              <ChevronRight className="w-3 h-3 text-[#d1d5db]" />
              {child.name.kr || child.slug}
              {child.name.en && <span className="ml-1 text-xs text-[#9ca3af]">{child.name.en}</span>}
            </span>
          </td>
          <td className="p-3 text-[12px] text-[#9ca3af] font-mono">{child.slug}</td>
          <td className="p-3">
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${child.is_active ? 'bg-[#dcfce7] text-[#15803d]' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
              {child.is_active ? '활성' : '비활성'}
            </span>
          </td>
          <td className="p-3 pr-4 text-right">
            <div className="flex gap-1 justify-end">
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
