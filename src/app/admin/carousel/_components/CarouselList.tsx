'use client';

import {
  Trash2,
  ImageIcon,
  Pencil,
  GripVertical,
  Link as LinkIcon,
} from 'lucide-react';
import type { CarouselSlide } from '@/lib/api/carousel';

interface Props {
  slides: CarouselSlide[];
  isLoading: boolean;
  onEdit: (slide: CarouselSlide) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, current: boolean) => void;
}

export default function CarouselList({
  slides,
  isLoading,
  onEdit,
  onDelete,
  onToggleActive,
}: Props) {
  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-gray-400 font-bold tracking-widest">
        불러오는 중...
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="p-12 text-center text-gray-400">
        <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-semibold">등록된 슬라이드가 없습니다</p>
        <p className="text-xs mt-1">슬라이드 추가 버튼을 눌러 캐러셀을 구성하세요</p>
      </div>
    );
  }

  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
          <th className="p-4 pl-6 w-12">순서</th>
          <th className="p-4 w-20">이미지</th>
          <th className="p-4">뱃지 / 제목</th>
          <th className="p-4 w-20">모드</th>
          <th className="p-4 w-24">배경색</th>
          <th className="p-4 w-20">상태</th>
          <th className="p-4 pr-6 text-right w-24">작업</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {slides.map(s => (
          <tr
            key={s.id}
            className={`hover:bg-gray-50/50 transition-colors ${
              !s.is_active ? 'opacity-50' : ''
            }`}
          >
            <td className="p-4 pl-6">
              <div className="flex items-center gap-1 text-gray-400">
                <GripVertical className="w-4 h-4" />
                <span className="text-sm font-mono">{s.sort_order}</span>
              </div>
            </td>
            <td className="p-4">
              <div className="w-16 h-12 rounded overflow-hidden bg-gray-100 border border-gray-200">
                {s.image_url ? (
                  s.media_type === 'video' ? (
                    <video src={s.image_url} muted className="w-full h-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.image_url} className="w-full h-full object-cover" alt="" />
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-4 h-4 text-gray-300" />
                  </div>
                )}
              </div>
            </td>
            <td className="p-4">
              <p className="text-[10px] text-gray-400 font-semibold">{s.badge?.kr || ''}</p>
              <p className="text-sm font-bold text-gray-900 line-clamp-1">
                {(s.title?.kr || '').replace(/\n/g, ' ')}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{s.subtitle?.kr || ''}</p>
              {s.link_url && (
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 mt-1">
                  <LinkIcon className="w-3 h-3" />
                  {s.link_url}
                </span>
              )}
            </td>
            <td className="p-4">
              <div className="flex flex-col gap-1">
                <span
                  className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                    s.display_mode === 'fullpage'
                      ? 'bg-purple-50 text-purple-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s.display_mode === 'fullpage' ? '풀페이지' : '기본'}
                </span>
                {s.media_type && s.media_type !== 'image' && (
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold w-fit ${
                      s.media_type === 'video'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    {s.media_type === 'video' ? 'MP4' : 'GIF'}
                  </span>
                )}
              </div>
            </td>
            <td className="p-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded border border-gray-200"
                  style={{ backgroundColor: s.bg_color }}
                />
                <span className="text-xs text-gray-400 font-mono">{s.bg_color}</span>
              </div>
            </td>
            <td className="p-4">
              <button
                onClick={() => onToggleActive(s.id, s.is_active)}
                className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors ${
                  s.is_active
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                }`}
              >
                {s.is_active ? '활성' : '비활성'}
              </button>
            </td>
            <td className="p-4 pr-6 text-right">
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => onEdit(s)}
                  className="text-gray-400 hover:text-blue-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
