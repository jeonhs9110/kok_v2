'use client';

import { TableShell, TableHeaderRow } from '@/components/admin/CafeWidgets';

export interface ChatbotLead {
  id: string;
  name: string | null;
  email: string;
  skin_type: string | null;
  country: string | null;
  created_at: string;
}

interface Props {
  leads: ChatbotLead[];
}

export default function ChatbotLeadsTable({ leads }: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e5e7eb]">
        <h2 className="text-[13px] font-bold text-[#1f2937]">고객 리드 데이터</h2>
        <span className="text-[11.5px] text-[#6b7280]">{leads.length}건</span>
      </div>
      {leads.length === 0 ? (
        <p className="text-[12px] text-[#9ca3af] py-12 text-center">아직 수집된 리드가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <TableShell>
            <thead>
              <TableHeaderRow>
                <th className="px-4 py-2.5">이름</th>
                <th className="px-4 py-2.5">이메일</th>
                <th className="px-4 py-2.5">피부 타입</th>
                <th className="px-4 py-2.5">국가</th>
                <th className="px-4 py-2.5">날짜</th>
              </TableHeaderRow>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {leads.map(lead => (
                <tr key={lead.id} className="hover:bg-[#fafbfc] transition-colors">
                  <td className="px-4 py-2 text-[#1f2937] text-[12px]">{lead.name || '—'}</td>
                  <td className="px-4 py-2 text-[#3b82f6] text-[12px]">{lead.email}</td>
                  <td className="px-4 py-2 text-[#6b7280] text-[11.5px]">{lead.skin_type || '—'}</td>
                  <td className="px-4 py-2 text-[#6b7280] text-[11.5px]">{lead.country || '—'}</td>
                  <td className="px-4 py-2 text-[#9ca3af] text-[11.5px] tabular-nums">{new Date(lead.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </div>
      )}
    </div>
  );
}
