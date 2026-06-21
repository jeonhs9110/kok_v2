'use client';

import { Shield, ShieldOff, Trash2 } from 'lucide-react';
import type { UserRow } from './useUsers';

interface Props {
  users: UserRow[];
  onToggleRole: (user: UserRow) => void;
  onDelete: (id: string) => void;
}

/**
 * The /admin/users table — pure UI. Renders one row per user with role
 * badge, verification chip, signup date, and the role-toggle + delete
 * actions. Parent owns the filtered list + handlers.
 */
export default function UsersTable({ users, onToggleRole, onDelete }: Props) {
  return (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[11px] uppercase tracking-wider text-[#6b7280] font-semibold">
          <th className="p-3 pl-4">이메일</th>
          <th className="p-3">권한</th>
          <th className="p-3">인증</th>
          <th className="p-3">가입일</th>
          <th className="p-3 pr-4 text-right">작업</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[#f3f4f6]">
        {users.map(user => (
          <tr key={user.id} className="hover:bg-[#fafbfc] transition-colors">
            <td className="p-3 pl-4">
              <div className="font-medium text-[#1f2937] text-sm">{user.email}</div>
              <div className="text-[10px] text-[#9ca3af] mt-0.5 font-mono">...{user.id.slice(-8)}</div>
            </td>
            <td className="p-3">
              <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                user.role === 'admin' ? 'bg-[#faf5ff] text-[#7c3aed]' : 'bg-[#f3f4f6] text-[#374151]'
              }`}>
                {user.role === 'admin' ? '관리자' : '사용자'}
              </span>
            </td>
            <td className="p-3">
              <span className={`inline-flex items-center gap-1.5 text-xs ${user.is_verified ? 'text-[#16a34a]' : 'text-[#9ca3af]'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${user.is_verified ? 'bg-[#22c55e]' : 'bg-[#d1d5db]'}`} />
                {user.is_verified ? '인증됨' : '미인증'}
              </span>
            </td>
            <td className="p-3 text-[12px] text-[#6b7280]">
              {new Date(user.created_at).toLocaleDateString('ko-KR')}
            </td>
            <td className="p-3 pr-4 text-right flex gap-1.5 justify-end">
              <button
                onClick={() => onToggleRole(user)}
                title={user.role === 'admin' ? '사용자로 변경' : '관리자로 변경'}
                className="text-[#9ca3af] hover:text-[#7c3aed] transition-colors p-1.5 rounded hover:bg-[#f3f4f6]"
              >
                {user.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
              </button>
              <button
                onClick={() => onDelete(user.id)}
                className="text-[#9ca3af] hover:text-[#ef4444] transition-colors p-1.5 rounded hover:bg-[#f3f4f6]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
