import { useCallback, useEffect, useState } from 'react';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/Toast';

export interface UserRow {
  id: string;
  email: string;
  role: 'admin' | 'user';
  is_verified: boolean;
  created_at: string;
}

type Source = 'rds' | 'supabase' | 'rds_error' | 'supabase_error' | 'supabase_missing' | null;

/**
 * State + handlers for /admin/users. Fetches from /api/admin/users which
 * dispatches to RDS when USE_RDS=true and falls back to Supabase. The
 * sub-label on the page reads from the `source` field so the UI shows
 * which backing store is live.
 */
export function useUsers() {
  const confirm = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<Source>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      const json = (await res.json()) as { users?: UserRow[]; source?: Source };
      setUsers(json.users ?? []);
      setSource(json.source ?? null);
    } catch {
      setUsers([]);
      setSource(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const toggleRole = async (user: UserRow) => {
    const newRole: 'admin' | 'user' = user.role === 'admin' ? 'user' : 'admin';
    const snapshot = users;
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u));
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error('http_' + res.status);
      const json = (await res.json()) as { ok: boolean; cognitoWarning?: { message: string; cli: string } | null };
      if (json.cognitoWarning) {
        // Privilege boundary didn't fully apply — surface the exact CLI
        // the operator can run from their own credentials to finish the
        // mirror. Copy to clipboard for one-click paste into a terminal.
        const w = json.cognitoWarning;
        try { await navigator.clipboard.writeText(w.cli); } catch { /* clipboard may not be available */ }
        toast.show(
          `${w.message}\n\n다음 명령어가 클립보드에 복사되었습니다:\n${w.cli}`,
          'warning',
        );
      }
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
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('http_' + res.status);
      const json = (await res.json()) as { ok: boolean; cognitoWarning?: { message: string; cli: string } | null };
      if (json.cognitoWarning) {
        const w = json.cognitoWarning;
        try { await navigator.clipboard.writeText(w.cli); } catch { /* clipboard may not be available */ }
        toast.show(
          `${w.message}\n\n다음 명령어가 클립보드에 복사되었습니다:\n${w.cli}`,
          'warning',
        );
      }
    } catch (err) {
      console.warn('삭제 실패:', err);
      setUsers(snapshot);
      toast.show('삭제에 실패했습니다.', 'error');
    }
  };

  return {
    users,
    isLoading,
    isLive: source === 'rds' || source === 'supabase',
    source,
    toggleRole,
    deleteUser,
  };
}
