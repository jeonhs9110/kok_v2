import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/Toast';

const supabase = getSupabaseBrowser();

export interface UserRow {
  id: string;
  email: string;
  role: 'admin' | 'user';
  is_verified: boolean;
  created_at: string;
}

/**
 * State + DB handlers for /admin/users. Owns the users list, isLive flag
 * (drives the "Supabase 연결됨" sub-label), role toggle + delete handlers.
 * Phase 4 RLS on `users` is admin-only — see migration 20.
 */
export function useUsers() {
  const confirm = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
    // Optimistic — flip locally first, roll back if DB write fails.
    const snapshot = users;
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    try {
      if (!supabase) throw new Error('No client');
      const { error } = await supabase.from('users').update({ role: newRole }).eq('id', user.id);
      if (error) throw error;
    } catch (err) {
      console.warn('권한 변경 실패:', err);
      setUsers(snapshot);
      toast.show('권한 변경에 실패했습니다.', 'error');
    }
  };

  const deleteUser = async (id: string) => {
    const ok = await confirm({ message: '이 사용자를 삭제하시겠습니까?', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    const snapshot = users;
    setUsers(prev => prev.filter(u => u.id !== id));
    try {
      if (!supabase) throw new Error('No client');
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.warn('삭제 실패:', err);
      setUsers(snapshot);
      toast.show('삭제에 실패했습니다.', 'error');
    }
  };

  return { users, isLoading, isLive, toggleRole, deleteUser };
}
