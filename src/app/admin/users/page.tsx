'use client';

import { Search, Trash2, Shield, ShieldOff } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/api/products';

interface UserRow {
  id: string;
  email: string;
  role: 'admin' | 'user';
  is_verified: boolean;
  created_at: string;
}

export default function UsersAdminPage() {
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
    if (!confirm('이 사용자를 삭제하시겠습니까?')) return;
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold text-gray-800">사용자 계정</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isLive ? (
              <><span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full mr-1" />총 {users.length}명</>
            ) : (
              <><span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full mr-1" />DB 미연결</>
            )}
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이메일 검색..."
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>
      </div>

      <div className="overflow-x-auto min-h-[300px]">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400 font-bold tracking-widest">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-sm font-semibold">{search ? '검색 결과가 없습니다' : '등록된 사용자가 없습니다'}</p>
            <p className="text-xs mt-1">{!search && '회원가입한 사용자가 여기에 표시됩니다'}</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="p-4 pl-6">이메일</th>
                <th className="p-4">권한</th>
                <th className="p-4">인증</th>
                <th className="p-4">가입일</th>
                <th className="p-4 pr-6 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 pl-6">
                    <div className="font-medium text-gray-900 text-sm">{user.email}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 font-mono">...{user.id.slice(-8)}</div>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role === 'admin' ? '관리자' : '사용자'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${user.is_verified ? 'text-green-600' : 'text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${user.is_verified ? 'bg-green-500' : 'bg-gray-300'}`} />
                      {user.is_verified ? '인증됨' : '미인증'}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="p-4 pr-6 text-right flex gap-1.5 justify-end">
                    <button
                      onClick={() => toggleRole(user)}
                      title={user.role === 'admin' ? '사용자로 변경' : '관리자로 변경'}
                      className="text-gray-400 hover:text-purple-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"
                    >
                      {user.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"
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
  );
}
