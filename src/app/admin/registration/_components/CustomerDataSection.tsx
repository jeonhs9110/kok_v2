'use client';

import { UserPlus } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { formatKstDate } from '@/lib/formatKstDate';
import type { CustomerProfile } from './types';

interface Props {
  customers: CustomerProfile[];
  openSection: string;
  onSetOpenSection: (v: string) => void;
}

export default function CustomerDataSection({ customers, openSection, onSetOpenSection }: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
      <SectionHeader id="customers" title="수집된 고객 데이터" icon={UserPlus} openSection={openSection} setOpenSection={onSetOpenSection} />
      {openSection === 'customers' && (
        <div className="p-5 pt-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">가입된 고객 정보</p>
            <span className="text-xs text-[#9ca3af]">{customers.length}명</span>
          </div>
          {customers.length === 0 ? (
            <p className="text-sm text-[#9ca3af] py-8 text-center">아직 가입된 고객이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#e5e7eb]">
                    <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">이름</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">이메일</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">전화번호</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">국가</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">피부</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">마케팅</th>
                    <th className="text-left py-2 px-2 text-gray-500 font-medium text-xs">가입일</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map(c => (
                    <tr key={c.id} className="border-b border-[#f3f4f6] hover:bg-[#fafbfc]">
                      <td className="py-2 px-2 text-gray-800">{c.name || '—'}</td>
                      <td className="py-2 px-2 text-[#3b82f6] text-xs">{c.email || '—'}</td>
                      <td className="py-2 px-2 text-gray-600 text-xs">{c.phone || '—'}</td>
                      <td className="py-2 px-2 text-gray-600 text-xs">{c.country || '—'}</td>
                      <td className="py-2 px-2 text-gray-600 text-xs">{c.skin_type || '—'}</td>
                      <td className="py-2 px-2">{c.marketing_consent ? <span className="text-[#16a34a] text-xs">✓</span> : <span className="text-[#d1d5db] text-xs">—</span>}</td>
                      <td className="py-2 px-2 text-[#9ca3af] text-xs">{formatKstDate(c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
