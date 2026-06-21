'use client';

import { Shield, ShieldOff, Trash2 } from 'lucide-react';
import { StatusDot, TableShell, TableHeaderRow } from '@/components/admin/CafeWidgets';
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
 *
 * Cafe24 chrome (2026-06-21): role + verification render as StatusDot
 * (color dot + text), not as colored pill backgrounds. Cell padding and
 * action icons match the products table for consistency.
 */
export default function UsersTable({ users, onToggleRole, onDelete }: Props) {
  return (
    <TableShell>
      <thead>
        <TableHeaderRow>
          <th className="px-4 py-2.5">이메일</th>
          <th className="px-4 py-2.5">권한</th>
          <th className="px-4 py-2.5">인증</th>
          <th className="px-4 py-2.5">가입일</th>
          <th className="px-4 py-2.5 text-right">작업</th>
        </TableHeaderRow>
      </thead>
      <tbody className="divide-y divide-[#f3f4f6]">
        {users.map(user => (
          <tr key={user.id} className="hover:bg-[#fafbfc] transition-colors">
            <td className="px-4 py-2">
              <div className="font-semibold text-[#1f2937] text-[12.5px]">{user.email}</div>
              <div className="text-[10px] text-[#9ca3af] mt-0.5 font-mono">...{user.id.slice(-8)}</div>
            </td>
            <td className="px-4 py-2">
              <StatusDot
                tone={user.role === 'admin' ? 'info' : 'muted'}
                label={user.role === 'admin' ? '관리자' : '사용자'}
              />
            </td>
            <td className="px-4 py-2">
              <StatusDot
                tone={user.is_verified ? 'active' : 'inactive'}
                label={user.is_verified ? '인증됨' : '미인증'}
              />
            </td>
            <td className="px-4 py-2 text-[11.5px] text-[#6b7280] tabular-nums">
              {new Date(user.created_at).toLocaleDateString('ko-KR')}
            </td>
            <td className="px-4 py-2 text-right">
              <div className="flex gap-0.5 justify-end">
                <button
                  onClick={() => onToggleRole(user)}
                  title={user.role === 'admin' ? '사용자로 변경' : '관리자로 변경'}
                  className="text-[#9ca3af] hover:text-[#3b82f6] transition-colors p-1 rounded hover:bg-[#f3f4f6]"
                >
                  {user.role === 'admin' ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => onDelete(user.id)}
                  className="text-[#9ca3af] hover:text-[#ef4444] transition-colors p-1 rounded hover:bg-[#f3f4f6]"
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
