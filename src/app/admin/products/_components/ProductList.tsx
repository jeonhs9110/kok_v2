'use client';

import { Pencil, Trash2, ImageIcon } from 'lucide-react';
import type { Product } from '@/lib/api/products';
import { EmptyState, LoadingState } from '@/components/admin/CafeWidgets';

/**
 * Read-only table of products. Pure props in, callbacks out — owns no state.
 * Renders one of four states (loadError > loading > empty > table) and lets
 * the parent decide what `onRetry` does when the load failed.
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
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
          <th className="p-4 pl-6 w-16">ID</th>
          <th className="p-4">상품 개요</th>
          <th className="p-4">가격</th>
          <th className="p-4">성분</th>
          <th className="p-4">구매 링크</th>
          <th className="p-4">상태</th>
          <th className="p-4 pr-6 text-right">작업</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {products.map(item => (
          <tr
            key={item.id}
            className={`hover:bg-gray-50/50 transition-colors ${!item.is_active ? 'opacity-50' : ''}`}
          >
            <td className="p-4 pl-6 text-gray-400 text-xs truncate max-w-[80px]" title={item.id}>
              ...{item.id.slice(-6)}
            </td>
            <td className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} className="w-full h-full object-cover mix-blend-multiply" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-sm">{item.name}</p>
                    {item.is_best_seller && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded tracking-wide uppercase">
                        Best
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.summary}</p>
                </div>
              </div>
            </td>
            <td className="p-4 text-gray-600 text-sm font-bold">{item.price.toLocaleString()}원</td>
            <td className="p-4 text-gray-600 font-mono text-[11px]">{item.ingredient}</td>
            <td className="p-4">
              {item.naver_store_url ? (
                <a
                  href={item.naver_store_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded tracking-wide hover:bg-green-100 transition-colors"
                >
                  네이버
                </a>
              ) : (
                <span className="text-[10px] text-gray-300">미설정</span>
              )}
            </td>
            <td className="p-4">
              <button
                onClick={() => onToggle(item.id, item.is_active)}
                className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors ${
                  item.is_active
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                }`}
              >
                {item.is_active ? '게시중' : '숨김'}
              </button>
            </td>
            <td className="p-4 pr-6 text-right flex gap-1.5 justify-end">
              <button
                onClick={() => onEdit(item)}
                className="text-gray-400 hover:text-blue-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"
                aria-label={`${item.name} 수정`}
              >
                <Pencil className="w-4 h-4 inline" />
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="text-gray-400 hover:text-red-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"
                aria-label={`${item.name} 삭제`}
              >
                <Trash2 className="w-4 h-4 inline" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
