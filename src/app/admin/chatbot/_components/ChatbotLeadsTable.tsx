'use client';

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
    <div className="bg-white rounded border border-[#e5e7eb] p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-bold text-[#1f2937]">고객 리드 데이터</h2>
        <span className="text-sm text-[#6b7280]">{leads.length}건</span>
      </div>
      {leads.length === 0 ? (
        <p className="text-sm text-[#9ca3af] py-6 text-center">아직 수집된 리드가 없습니다.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#e5e7eb]">
                <th className="text-left py-2 px-3 text-[#6b7280] font-medium">이름</th>
                <th className="text-left py-2 px-3 text-[#6b7280] font-medium">이메일</th>
                <th className="text-left py-2 px-3 text-[#6b7280] font-medium">피부 타입</th>
                <th className="text-left py-2 px-3 text-[#6b7280] font-medium">국가</th>
                <th className="text-left py-2 px-3 text-[#6b7280] font-medium">날짜</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-b border-[#f3f4f6] hover:bg-[#fafbfc]">
                  <td className="py-2.5 px-3 text-[#1f2937]">{lead.name || '—'}</td>
                  <td className="py-2.5 px-3 text-[#3b82f6]">{lead.email}</td>
                  <td className="py-2.5 px-3 text-[#6b7280]">{lead.skin_type || '—'}</td>
                  <td className="py-2.5 px-3 text-[#6b7280]">{lead.country || '—'}</td>
                  <td className="py-2.5 px-3 text-[#9ca3af]">{new Date(lead.created_at).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
