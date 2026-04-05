import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  basePath: string;
}

export default function Pagination({ currentPage, totalPages, basePath }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  const wing = 2;

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    const start = Math.max(2, currentPage - wing);
    const end = Math.min(totalPages - 1, currentPage + wing);
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  const href = (p: number) => p === 1 ? basePath : `${basePath}?page=${p}`;

  return (
    <nav className="flex items-center justify-center gap-1 mt-10 pt-6 border-t border-neutral-100">
      {currentPage > 1 ? (
        <Link href={href(currentPage - 1)} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-[#111] transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
      ) : (
        <span className="w-8 h-8 flex items-center justify-center text-neutral-200">
          <ChevronLeft className="w-4 h-4" />
        </span>
      )}

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-neutral-300 text-xs">···</span>
        ) : p === currentPage ? (
          <span key={p} className="w-8 h-8 flex items-center justify-center text-[13px] font-bold text-white bg-[#111] rounded">
            {p}
          </span>
        ) : (
          <Link key={p} href={href(p)} className="w-8 h-8 flex items-center justify-center text-[13px] text-neutral-500 hover:text-[#111] hover:font-semibold transition-colors">
            {p}
          </Link>
        )
      )}

      {currentPage < totalPages ? (
        <Link href={href(currentPage + 1)} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-[#111] transition-colors">
          <ChevronRight className="w-4 h-4" />
        </Link>
      ) : (
        <span className="w-8 h-8 flex items-center justify-center text-neutral-200">
          <ChevronRight className="w-4 h-4" />
        </span>
      )}
    </nav>
  );
}
