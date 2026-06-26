'use client';

import { Search, Users as UsersIcon, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StatCard, StatStrip, PageHeader, EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import UsersTable from './_components/UsersTable';
import { useUsers } from './_components/useUsers';

function sourceLabel(source: string | null, suffix: string): string {
  if (source === 'rds') return `RDS 연결됨${suffix}`;
  if (source === 'supabase') return `Supabase 연결됨${suffix}`;
  return 'DB 미연결';
}

export default function UsersAdminPage() {
  const { users, isLoading, isLive, source, toggleRole, deleteUser } = useUsers();
  const [search, setSearch] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/customer/me', { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as { isSuperAdmin?: boolean };
        setIsSuperAdmin(!!j.isSuperAdmin);
      } catch { /* leave false */ }
    })();
  }, []);

  const filtered = search
    ? users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()))
    : users;

  // Compute "recent 7 days" in an effect so Date.now() doesn't run
  // during render (react-hooks/purity).
  const [recent7, setRecent7] = useState(0);
  useEffect(() => {
    const now = Date.now();
    const day7Ms = 7 * 24 * 60 * 60 * 1000;
    const n = users.filter(u => u.created_at && new Date(u.created_at).getTime() >= now - day7Ms).length;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent7(n);
  }, [users]);

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter(u => u.role === 'admin').length,
    recent: recent7,
  }), [users, recent7]);

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="총 회원" value={stats.total} icon={UsersIcon} isLoading={isLoading} subLabel={sourceLabel(source, '')} />
        <StatCard accent="#22c55e" label="최근 7일 신규" value={stats.recent} icon={UsersIcon} isLoading={isLoading} subLabel="가입 추세" />
        <StatCard accent="#8b5cf6" label="관리자" value={stats.admins} icon={ShieldCheck} isLoading={isLoading} subLabel={`전체 ${stats.total}명 중`} />
        <StatCard accent="#f59e0b" label="일반 사용자" value={stats.total - stats.admins} icon={UsersIcon} isLoading={isLoading} subLabel="role = user" />
      </StatStrip>

      <PageHeader
        title="사용자 계정"
        description={isLive ? `${sourceLabel(source, '')} · 총 ${users.length}명` : 'DB 미연결'}
        actions={
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이메일 검색..."
              className="pl-9 pr-3 py-1.5 text-[12px] border border-[#d1d5db] rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#3b82f6] kokkok-keep-border"
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
            <UsersTable users={filtered} onToggleRole={toggleRole} onDelete={deleteUser} canMutate={isSuperAdmin} />
          )}
        </div>
      </div>
    </div>
  );
}
