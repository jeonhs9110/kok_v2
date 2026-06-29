'use client';

import { Pencil, Trash2, ImageIcon, ExternalLink } from 'lucide-react';
import type { Product } from '@/lib/api/products';
import { EmptyState, LoadingState, StatusDot, TableShell, TableHeaderRow } from '@/components/admin/CafeWidgets';
import { safeUrl } from '@/lib/url/safeUrl';

/**
 * Read-only table of products. Pure props in, callbacks out — owns no state.
 * Renders one of four states (loadError > loading > empty > table) and lets
 * the parent decide what `onRetry` does when the load failed.
 *
 * Cafe24 chrome (2026-06-21 pass): status uses a dot + label rather than a
 * pill bg (pills read as Western SaaS), 네이버 link becomes a small icon
 * link rather than a colored chip, BEST badge stays small.
 */
interface Props {
  products: Product[];
  isLoading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, currentStatus: boolean) => void;
}

export default function ProductList({
  products,
  isLoading,
  loadError,
  onRetry,
  onEdit,
  onDelete,
  onToggle,
}: Props) {
  if (loadError) {
    return (
      <div className="p-8 m-6 border-2 border-red-200 bg-red-50 rounded-lg text-center">
        <p className="text-sm font-bold text-red-700">DB 연결 실패 — 데이터를 불러올 수 없습니다</p>
        <p className="text-xs mt-2 text-red-600 font-mono">{loadError}</p>
        <p className="text-xs mt-3 text-gray-600">
          Supabase 환경변수 / RLS 정책을 확인하세요. 이전에는 가짜 mock 데이터로 자동 전환됐지만 이제 실제 오류를 표시합니다.
        </p>
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-red-700 text-white text-xs font-semibold rounded hover:bg-red-800"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (isLoading) return <LoadingState />;
  if (products.length === 0) return <EmptyState label="등록된 상품이 없습니다 · 상품 추가 버튼을 눌러 첫 상품을 등록하세요" />;

  return (
    <TableShell>
      <thead>
        <TableHeaderRow>
          <th className="px-4 py-2.5 w-16">ID</th>
          <th className="px-4 py-2.5">상품 개요</th>
          <th className="px-4 py-2.5">가격</th>
          <th className="px-4 py-2.5">성분</th>
          <th className="px-4 py-2.5">구매 링크</th>
          <th className="px-4 py-2.5">상태</th>
          <th className="px-4 py-2.5 text-right">작업</th>
        </TableHeaderRow>
      </thead>
      <tbody className="divide-y divide-[#f3f4f6]">
        {products.map(item => (
          <tr
            key={item.id}
            className={`hover:bg-[#fafbfc] transition-colors ${!item.is_active ? 'opacity-60' : ''}`}
          >
            <td className="px-4 py-2 text-[#9ca3af] text-[11px] font-mono truncate max-w-[80px]" title={item.id}>
              ...{item.id.slice(-6)}
            </td>
            <td className="px-4 py-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} className="w-full h-full object-cover mix-blend-multiply" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-3.5 h-3.5 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-[#1f2937] text-[12.5px] truncate">{item.name}</p>
                    {item.is_best_seller && (
                      <span className="px-1 py-0 bg-amber-50 text-amber-700 text-[9px] font-bold rounded tracking-wide uppercase border border-amber-200 flex-shrink-0">
                        Best
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#9ca3af] mt-0.5 line-clamp-1">{item.summary}</p>
                </div>
              </div>
            </td>
            <td className="px-4 py-2 text-[#1f2937] text-[12px] font-semibold tabular-nums">{item.price.toLocaleString()}원</td>
            <td className="px-4 py-2 text-[#6b7280] font-mono text-[11px]">{item.ingredient}</td>
            <td className="px-4 py-2">
              {item.naver_store_url ? (
                <a
                  href={safeUrl(item.naver_store_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#16a34a] text-[11.5px] hover:underline"
                  title="네이버 스토어 열기"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  네이버
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              ) : (
                <span className="text-[11px] text-[#d1d5db]">미설정</span>
              )}
            </td>
            <td className="px-4 py-2">
              <StatusDot
                tone={item.is_active ? 'active' : 'inactive'}
                label={item.is_active ? '게시중' : '숨김'}
                onClick={() => onToggle(item.id, item.is_active)}
                title={item.is_active ? '클릭하여 숨김으로 전환' : '클릭하여 게시중으로 전환'}
              />
            </td>
            <td className="px-4 py-2 text-right">
              <div className="flex gap-0.5 justify-end">
                <button
                  onClick={() => onEdit(item)}
                  className="text-[#9ca3af] hover:text-[#3b82f6] transition-colors p-1 rounded hover:bg-[#f3f4f6]"
                  aria-label={`${item.name} 수정`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-[#9ca3af] hover:text-[#ef4444] transition-colors p-1 rounded hover:bg-[#f3f4f6]"
                  aria-label={`${item.name} 삭제`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
