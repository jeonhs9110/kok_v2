'use client';

import Link from 'next/link';
import { Shield, ShieldOff, Trash2 } from 'lucide-react';
import { StatusDot, TableShell, TableHeaderRow } from '@/components/admin/CafeWidgets';
import { formatKstDate } from '@/lib/formatKstDate';
import type { UserRow } from './useUsers';

interface Props {
  users: UserRow[];
  onToggleRole: (user: UserRow) => void;
  onDelete: (id: string) => void;
  /** When false, hide role-toggle + delete buttons (admins only — super-admins only). */
  canMutate: boolean;
  /** Signed-in caller's userId. Used to disable self-mutation on their own row. */
  currentUserId: string | null;
}

/**
 * The /admin/users table. Each row is a Link to /admin/users/[id] for
 * the detail drill-in. The role-toggle + delete buttons render only
 * when `canMutate` is true (super-admin gate).
 *
 * Self-protection: on the caller's OWN row the buttons render but are
 * disabled — preventing accidental self-demotion (which would lock the
 * operator out of /admin) or self-deletion. To mutate that row, another
 * super-admin has to do it.
 *
 * Stop event propagation on the action buttons so clicking them doesn't
 * also fire the row's Link navigation.
 */
export default function UsersTable({ users, onToggleRole, onDelete, canMutate, currentUserId }: Props) {
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
              <Link href={`/admin/users/${user.id}`} className="block">
                <div className="font-semibold text-[#1f2937] text-[12.5px]">{user.email}</div>
                <div className="text-[10px] text-[#9ca3af] mt-0.5 font-mono">...{user.id.slice(-8)}</div>
              </Link>
            </td>
            <td className="px-4 py-2">
              <Link href={`/admin/users/${user.id}`} className="block">
                <StatusDot
                  tone={user.role === 'admin' ? 'info' : 'muted'}
                  label={user.role === 'admin' ? '관리자' : '사용자'}
                />
              </Link>
            </td>
            <td className="px-4 py-2">
              <Link href={`/admin/users/${user.id}`} className="block">
                <StatusDot
                  tone={user.is_verified ? 'active' : 'inactive'}
                  label={user.is_verified ? '인증됨' : '미인증'}
                />
              </Link>
            </td>
            <td className="px-4 py-2 text-[11.5px] text-[#6b7280] tabular-nums">
              <Link href={`/admin/users/${user.id}`} className="block">
                {formatKstDate(user.created_at)}
              </Link>
            </td>
            <td className="px-4 py-2 text-right">
              {canMutate ? (
                (() => {
                  const isSelf = currentUserId !== null && user.id === currentUserId;
                  const selfTitle = '본인 계정은 본인이 수정/삭제할 수 없습니다 (다른 super-admin이 처리)';
                  return (
                    <div className="flex gap-0.5 justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (!isSelf) onToggleRole(user); }}
                        disabled={isSelf}
                        title={isSelf ? selfTitle : (user.role === 'admin' ? '사용자로 변경' : '관리자로 변경')}
                        className="text-[#9ca3af] hover:text-[#3b82f6] transition-colors p-1 rounded hover:bg-[#f3f4f6] disabled:hover:text-[#9ca3af] disabled:hover:bg-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {user.role === 'admin' ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (!isSelf) onDelete(user.id); }}
                        disabled={isSelf}
                        title={isSelf ? selfTitle : '삭제'}
                        className="text-[#9ca3af] hover:text-[#ef4444] transition-colors p-1 rounded hover:bg-[#f3f4f6] disabled:hover:text-[#9ca3af] disabled:hover:bg-transparent disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })()
              ) : (
                <span className="text-[10px] text-[#cbd5e1] font-medium" title="super-admin 권한이 필요합니다">
                  read-only
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
