'use client';

import { Search, Trash2, Shield, ShieldOff, Users as UsersIcon, ShieldCheck } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip, PageHeader, EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import { useConfirm } from '@/components/admin/ConfirmModal';

// Session-aware client. Phase 4 RLS lockdown on `users` is admin-only for
// reading other users, updating roles, and deleting accounts — see
// migration 20.
const supabase = getSupabaseBrowser();

interface UserRow {
  id: string;
  email: string;
  role: 'admin' | 'user';
  is_verified: boolean;
  created_at: string;
}

export default function UsersAdminPage() {
  const confirm = useConfirm();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isLive, setIsLive] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('No client');
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers(data ?? []);
      setIsLive(true);
    } catch {
      setUsers([]);
      setIsLive(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleRole = async (user: UserRow) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      if (!supabase) return;
      await supabase.from('users').update({ role: newRole }).eq('id', user.id);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    } catch {
      console.warn('권한 변경 실패');
    }
  };

  const deleteUser = async (id: string) => {
    const ok = await confirm({ message: '이 사용자를 삭제하시겠습니까?', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    try {
      if (!supabase) return;
      await supabase.from('users').delete().eq('id', id);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch {
      console.warn('삭제 실패');
    }
  };

  const filtered = search
    ? users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()))
    : users;

  const stats = useMemo(() => {
    const now = Date.now();
    const day7Ms = 7 * 24 * 60 * 60 * 1000;
    const recent7 = users.filter(u => {
      const t = (u as { created_at?: string }).created_at;
      return t && new Date(t).getTime() >= now - day7Ms;
    }).length;
    return {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      recent: recent7,
    };
  }, [users]);

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="총 회원" value={stats.total} icon={UsersIcon} isLoading={isLoading} subLabel={isLive ? 'Supabase 연결됨' : 'DB 미연결'} />
        <StatCard accent="#22c55e" label="최근 7일 신규" value={stats.recent} icon={UsersIcon} isLoading={isLoading} subLabel="가입 추세" />
        <StatCard accent="#8b5cf6" label="관리자" value={stats.admins} icon={ShieldCheck} isLoading={isLoading} subLabel={`전체 ${stats.total}명 중`} />
        <StatCard accent="#f59e0b" label="일반 사용자" value={stats.total - stats.admins} icon={UsersIcon} isLoading={isLoading} subLabel="role = user" />
      </StatStrip>

      <PageHeader
        title="사용자 계정"
        description={isLive ? `Supabase 연결됨 · 총 ${users.length}명` : 'DB 미연결'}
        actions={
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이메일 검색..."
              className="pl-9 pr-3 py-1.5 text-[12px] border border-[#d1d5db] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#3b82f6]"
            />
          </div>
        }
      />

    <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">

      <div className="overflow-x-auto min-h-[300px]">
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState label={search ? '검색 결과가 없습니다' : '등록된 사용자가 없습니다'} />
        ) : (
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
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-[#fafbfc] transition-colors">
                  <td className="p-3 pl-4">
                    <div className="font-medium text-gray-900 text-sm">{user.email}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 font-mono">...{user.id.slice(-8)}</div>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role === 'admin' ? '관리자' : '사용자'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${user.is_verified ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_verified ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {user.is_verified ? '인증됨' : '미인증'}
                    </span>
                  </td>
                  <td className="p-3 text-[12px] text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="p-3 pr-4 text-right flex gap-1.5 justify-end">
                    <button
                      onClick={() => toggleRole(user)}
                      title={user.role === 'admin' ? '사용자로 변경' : '관리자로 변경'}
                      className="text-gray-400 hover:text-purple-600 transition-colors p-1.5 rounded hover:bg-[#f3f4f6]"
                    >
                      {user.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1.5 rounded hover:bg-[#f3f4f6]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
    </div>
  );
}
