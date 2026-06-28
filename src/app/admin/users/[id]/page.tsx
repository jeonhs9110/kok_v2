'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Mail, Calendar, Shield, Phone, MapPin, Cake, Globe, Sparkles, MessageCircle, Heart, Package, FileText } from 'lucide-react';
import { PageHeader, LoadingState, EmptyState } from '@/components/admin/CafeWidgets';
import { formatKstDate } from '@/lib/formatKstDate';

interface UserRow {
  id: string;
  email: string;
  role: 'admin' | 'user';
  is_verified: boolean;
  created_at: string;
}

interface ProfileRow {
  name?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthday?: string | null;
  country?: string | null;
  skin_type?: string | null;
  marketing_consent?: boolean | null;
}

interface WishRow {
  id: string;
  product_id: string;
  product_name?: string;
  images?: string[] | null;
  price?: string | number | null;
  created_at: string;
}

interface PostRow {
  id: string;
  menu_id: string;
  title: string;
  created_at: string;
}

interface OrderRow {
  id: string;
  total_amount: number;
  status: string;
  created_at: string;
}

interface DetailsResponse {
  user: UserRow | null;
  profile: ProfileRow | null;
  wishlist: WishRow[];
  posts: PostRow[];
  orders: OrderRow[];
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${id}/details`, { cache: 'no-store' });
        if (!res.ok) {
          setErr('http_' + res.status);
          return;
        }
        const json = (await res.json()) as DetailsResponse;
        setData(json);
      } catch {
        setErr('network');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <LoadingState />;
  if (err || !data?.user) {
    return (
      <div className="space-y-4">
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6b7280] hover:text-black">
          <ArrowLeft className="w-4 h-4" /> 사용자 목록으로
        </Link>
        <EmptyState label={err ? '사용자 정보를 불러올 수 없습니다' : '사용자를 찾을 수 없습니다'} />
      </div>
    );
  }

  const { user, profile, wishlist, posts, orders } = data;
  const isAdmin = user.role === 'admin';

  return (
    <div className="space-y-5 max-w-5xl">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#6b7280] hover:text-black">
        <ArrowLeft className="w-4 h-4" /> 사용자 목록으로
      </Link>

      <PageHeader
        title={profile?.name ? `${profile.name}` : user.email.split('@')[0]}
        description={user.email}
      />

      {/* Account card */}
      <div className="bg-white rounded border border-[#e5e7eb] p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="권한" icon={Shield}>
            <span className={isAdmin ? 'text-[#8b5cf6] font-semibold' : 'text-[#1f2937]'}>
              {isAdmin ? '관리자' : '사용자'}
            </span>
          </Field>
          <Field label="이메일" icon={Mail}>{user.email}</Field>
          <Field label="가입일" icon={Calendar}>
            {formatKstDate(user.created_at)}
          </Field>
          <Field label="이메일 인증" icon={Mail}>
            <span className={user.is_verified ? 'text-[#22c55e]' : 'text-[#f59e0b]'}>
              {user.is_verified ? '인증됨' : '미인증'}
            </span>
          </Field>
        </div>
      </div>

      {/* Profile card */}
      <Section title="고객 프로필" icon={Sparkles}>
        {profile ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="이름" icon={Sparkles}>{profile.name || '—'}</Field>
            <Field label="전화" icon={Phone}>{profile.phone || '—'}</Field>
            <Field label="성별" icon={Sparkles}>{profile.gender || '—'}</Field>
            <Field label="생년월일" icon={Cake}>{profile.birthday || '—'}</Field>
            <Field label="국가" icon={Globe}>{profile.country || '—'}</Field>
            <Field label="피부 타입" icon={Sparkles}>{profile.skin_type || '—'}</Field>
            <Field label="마케팅 동의" icon={Mail}>
              {profile.marketing_consent ? '✓' : '—'}
            </Field>
          </div>
        ) : (
          <p className="text-[12px] text-[#9ca3af]">아직 프로필을 입력하지 않은 사용자입니다.</p>
        )}
      </Section>

      {/* Wishlist */}
      <Section title={`위시리스트 (${wishlist.length})`} icon={Heart}>
        {wishlist.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af]">관심 상품이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {wishlist.map(w => (
              <li key={w.id} className="flex items-center gap-3">
                <div className="relative w-10 h-10 bg-neutral-100 rounded overflow-hidden flex-shrink-0">
                  {(w.images?.[0]) && (
                    <Image src={w.images[0]} alt={w.product_name ?? ''} fill sizes="40px" className="object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-[#1f2937] truncate">{w.product_name ?? w.product_id}</p>
                  <p className="text-[11px] text-[#9ca3af]">
                    {w.price ? `${Number(w.price).toLocaleString()}원` : '—'} · 추가일 {formatKstDate(w.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Posts */}
      <Section title={`작성한 글 (${posts.length})`} icon={MessageCircle}>
        {posts.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af]">작성한 게시글이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {posts.map(p => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0" />
                  <span className="text-[13px] text-[#1f2937] truncate">{p.title}</span>
                </div>
                <span className="text-[11px] text-[#9ca3af] flex-shrink-0">
                  {formatKstDate(p.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Orders */}
      <Section title={`주문 내역 (${orders.length})`} icon={Package}>
        {orders.length === 0 ? (
          <p className="text-[12px] text-[#9ca3af]">결제 연동 후 주문 내역이 표시됩니다.</p>
        ) : (
          <ul className="space-y-2">
            {orders.map(o => (
              <li key={o.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0" />
                  <span className="text-[13px] text-[#1f2937] truncate">
                    {Number(o.total_amount).toLocaleString()}원
                  </span>
                  <span className="text-[11px] px-2 py-0.5 bg-neutral-100 rounded text-[#6b7280]">{o.status}</span>
                </div>
                <span className="text-[11px] text-[#9ca3af] flex-shrink-0">
                  {formatKstDate(o.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-[#6b7280]" />
        <h2 className="text-[13px] font-bold text-[#1f2937]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-3.5 h-3.5 text-[#9ca3af] mt-0.5" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-[#9ca3af] font-semibold">{label}</p>
        <div className="text-[13px] text-[#1f2937] truncate">{children}</div>
      </div>
    </div>
  );
}
