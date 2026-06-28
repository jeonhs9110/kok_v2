'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { User, Package, Heart, LogOut, Save, Pencil } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

/**
 * Customer "my page". Reads + writes go through the dispatcher API
 * routes (/api/customer/me, /api/customer/profile, /api/customer/wishlist),
 * which use requireCustomer() (Cognito ID-token cookie) for auth and
 * USE_RDS=true to route through RDS. No direct Supabase access from the
 * browser.
 */

const L: Record<string, {
  title: string; profile: string; orders: string; wishlist: string;
  email: string; joined: string; changePw: string; logout: string;
  ordersEmpty: string; ordersPhase2: string; wishEmpty: string;
  remove: string; viewProduct: string; edit: string; save: string; saved: string;
  name: string; phone: string; gender: string; birthday: string; country: string;
  skinType: string; marketingConsent: string; cancel: string;
}> = {
  kr: { title: '마이페이지', profile: '프로필', orders: '주문내역', wishlist: '위시리스트', email: '이메일', joined: '가입일', changePw: '비밀번호 변경', logout: '로그아웃', ordersEmpty: '주문 내역이 없습니다', ordersPhase2: '결제 연동 후 주문 내역이 표시됩니다.', wishEmpty: '위시리스트가 비어 있습니다', remove: '삭제', viewProduct: '상품 보기', edit: '수정', save: '저장', saved: '저장 완료', name: '이름', phone: '전화번호', gender: '성별', birthday: '생년월일', country: '국가', skinType: '피부 타입', marketingConsent: '마케팅 수신 동의', cancel: '취소' },
  en: { title: 'My Page', profile: 'Profile', orders: 'Orders', wishlist: 'Wishlist', email: 'Email', joined: 'Joined', changePw: 'Change Password', logout: 'Logout', ordersEmpty: 'No orders yet', ordersPhase2: 'Orders will be shown after payment integration.', wishEmpty: 'Your wishlist is empty', remove: 'Remove', viewProduct: 'View Product', edit: 'Edit', save: 'Save', saved: 'Saved', name: 'Name', phone: 'Phone', gender: 'Gender', birthday: 'Birthday', country: 'Country', skinType: 'Skin Type', marketingConsent: 'Marketing Consent', cancel: 'Cancel' },
};

interface CustomerProfile {
  name: string;
  phone: string;
  gender: string;
  birthday: string;
  country: string;
  skin_type: string;
  marketing_consent: boolean;
}

interface WishItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  product_price: number;
}

const GENDER_OPTIONS_KR = ['남성', '여성', '기타', '선택안함'];
const GENDER_OPTIONS_EN = ['Male', 'Female', 'Other', 'Prefer not to say'];
// 잘 모름 / Prefer not to say is the explicit "no answer" choice so users
// aren't forced to pick a skin type they're unsure about.
const SKIN_OPTIONS_KR = ['건성', '지성', '복합성', '민감성', '중성', '잘 모름 / 답하지 않음'];
const SKIN_OPTIONS_EN = ['Dry', 'Oily', 'Combination', 'Sensitive', 'Normal', 'Prefer not to say'];

type MyPageTab = 'profile' | 'orders' | 'wishlist';
function isValidTab(v: string | null): v is MyPageTab {
  return v === 'profile' || v === 'orders' || v === 'wishlist';
}

const EMPTY_PROFILE: CustomerProfile = {
  name: '', phone: '', gender: '', birthday: '', country: '', skin_type: '', marketing_consent: false,
};

export default function MyPage({ lang }: { lang: string }) {
  const t = L[lang] ?? L['en'];
  const isKr = lang === 'kr';
  const searchParams = useSearchParams();
  const initialTab: MyPageTab = isValidTab(searchParams?.get('tab') ?? null)
    ? (searchParams!.get('tab') as MyPageTab)
    : 'profile';
  const [tab, setTab] = useState<MyPageTab>(initialTab);
  const [userEmail, setUserEmail] = useState('');
  const [userCreated, setUserCreated] = useState('');
  const [profile, setProfile] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<CustomerProfile>(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [wishlist, setWishlist] = useState<WishItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [meRes, profileRes, wishRes] = await Promise.all([
        fetch('/api/customer/me', { cache: 'no-store' }),
        fetch('/api/customer/profile', { cache: 'no-store' }),
        fetch('/api/customer/wishlist?details=1', { cache: 'no-store' }),
      ]);
      if (meRes.ok) {
        const me = (await meRes.json()) as { email: string | null };
        setUserEmail(me.email ?? '');
      }
      if (profileRes.ok) {
        const json = (await profileRes.json()) as {
          profile: Partial<CustomerProfile & { email: string; created_at: string }> | null;
        };
        if (json.profile) {
          const p: CustomerProfile = {
            name: json.profile.name ?? '',
            phone: json.profile.phone ?? '',
            gender: json.profile.gender ?? '',
            birthday: json.profile.birthday ?? '',
            country: json.profile.country ?? '',
            skin_type: json.profile.skin_type ?? '',
            marketing_consent: !!json.profile.marketing_consent,
          };
          setProfile(p);
          setEditForm(p);
          if (json.profile.email && !userEmail) setUserEmail(json.profile.email);
          if (json.profile.created_at) setUserCreated(new Date(json.profile.created_at).toLocaleDateString('ko-KR'));
        }
      }
      if (wishRes.ok) {
        const json = (await wishRes.json()) as {
          items?: Array<{ wishlistId: string; productId: string; name: string; image: string; price: number }>;
        };
        setWishlist((json.items ?? []).map(it => ({
          id: it.wishlistId,
          product_id: it.productId,
          product_name: it.name,
          product_image: it.image,
          product_price: it.price,
        })));
      }
    } catch {
      console.warn('마이페이지 데이터 로딩 실패');
    } finally {
      setIsLoading(false);
    }
  }, [userEmail]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/customer/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name || null,
          phone: editForm.phone || null,
          gender: editForm.gender || null,
          birthday: editForm.birthday || null,
          country: editForm.country || null,
          skin_type: editForm.skin_type || null,
          marketing_consent: editForm.marketing_consent,
          email: userEmail,
        }),
      });
      if (!res.ok) throw new Error('http_' + res.status);
      setProfile(editForm);
      setEditMode(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch {
      alert(isKr ? '저장 실패' : 'Save failed');
    }
    setSaving(false);
  };

  const removeWish = async (id: string) => {
    try {
      const res = await fetch(`/api/customer/wishlist/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('http_' + res.status);
      setWishlist(prev => prev.filter(w => w.id !== id));
    } catch {
      // leave the row visible if the delete failed
    }
  };

  const handleLogout = async () => {
    try {
      // Cognito sign-out clears the cognito_id_token cookie server-side.
      // Falls through silently in the supabase fallback path (sign-out
      // there used to be supabase.auth.signOut() but we no longer have
      // an active supabase client; nothing to clear).
      await fetch('/api/auth/cognito/sign-out', { method: 'POST' });
    } catch { /* ignore */ }
    document.cookie = "kokkok_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    window.location.href = `/${lang}`;
  };

  const handleDeleteAccount = async () => {
    const confirmMsg = isKr
      ? '정말로 계정을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 개인정보가 영구적으로 삭제됩니다.'
      : 'Are you sure you want to delete your account?\n\nThis action cannot be undone. All your personal data will be permanently deleted.';
    if (!confirm(confirmMsg)) return;

    const doubleConfirm = isKr ? '계정 삭제를 최종 확인합니다. 계속하시겠습니까?' : 'Final confirmation: proceed with account deletion?';
    if (!confirm(doubleConfirm)) return;

    try {
      const res = await fetch('/api/customer/profile', { method: 'DELETE' });
      if (!res.ok) throw new Error('http_' + res.status);
      await handleLogout();
      alert(isKr ? '계정이 삭제되었습니다.' : 'Your account has been deleted.');
    } catch {
      alert(isKr ? '계정 삭제 실패. 고객센터에 문의해주세요.' : 'Account deletion failed. Please contact support.');
    }
  };

  const tabs = [
    { key: 'profile' as const, label: t.profile, icon: User },
    { key: 'orders' as const, label: t.orders, icon: Package },
    { key: 'wishlist' as const, label: t.wishlist, icon: Heart },
  ];

  const ProfileRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center py-3 border-b border-neutral-100 last:border-0">
      <span className="text-sm text-neutral-500 font-medium">{label}</span>
      <span className="text-sm font-semibold text-brand-ink">{value || '—'}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 bg-white min-h-[60vh]">
      <h1 className="text-2xl font-extrabold tracking-tight text-brand-ink mb-8">{t.title}</h1>

      <div className="flex gap-1 border-b border-neutral-200 mb-8">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors ${tab === key ? 'text-black border-b-2 border-black -mb-px' : 'text-neutral-400 hover:text-neutral-700'}`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-neutral-400 text-sm font-bold tracking-widest">Loading...</div>
      ) : (
        <>
          {tab === 'profile' && (
            <div className="space-y-6">
              {!editMode ? (
                <>
                  <div className="bg-neutral-50 rounded-xl p-6">
                    <ProfileRow label={t.email} value={userEmail} />
                    <ProfileRow label={t.name} value={profile.name} />
                    <ProfileRow label={t.phone} value={profile.phone} />
                    <ProfileRow label={t.gender} value={profile.gender} />
                    <ProfileRow label={t.birthday} value={profile.birthday} />
                    <ProfileRow label={t.country} value={profile.country} />
                    <ProfileRow label={t.skinType} value={profile.skin_type} />
                    <ProfileRow label={t.marketingConsent} value={profile.marketing_consent ? '✓' : '—'} />
                    <ProfileRow label={t.joined} value={userCreated} />
                  </div>
                  {savedMsg && <p className="text-green-600 text-sm font-semibold">{t.saved}</p>}
                  <div className="flex gap-3">
                    <button onClick={() => { setEditForm(profile); setEditMode(true); }} className="px-6 py-3 border border-neutral-200 text-sm font-semibold text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors flex items-center gap-2">
                      <Pencil className="w-4 h-4" />{t.edit}
                    </button>
                    <button onClick={() => alert(isKr ? '비밀번호 변경은 추후 지원됩니다.' : 'Password change coming soon.')} className="px-6 py-3 border border-neutral-200 text-sm font-semibold text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors">
                      {t.changePw}
                    </button>
                    <button onClick={handleLogout} className="px-6 py-3 bg-brand-ink text-white text-sm font-semibold rounded-lg hover:bg-black transition-colors flex items-center gap-2">
                      <LogOut className="w-4 h-4" />{t.logout}
                    </button>
                  </div>
                  <div className="border-t border-neutral-100 pt-4 mt-4">
                    <button
                      onClick={handleDeleteAccount}
                      className="text-xs text-red-400 hover:text-red-600 underline underline-offset-4 transition-colors"
                    >
                      {isKr ? '계정 삭제 (회원 탈퇴)' : 'Delete Account'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-neutral-50 rounded-xl p-6 space-y-4">
                  <div>
                    <label className="text-xs text-neutral-500 font-semibold">{t.email}</label>
                    <input type="text" value={userEmail} disabled className="w-full mt-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm bg-neutral-100 text-neutral-400" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 font-semibold">{t.name}</label>
                    <input type="text" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} className="w-full mt-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-black" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 font-semibold">{t.phone}</label>
                    <input type="tel" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} className="w-full mt-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-black" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 font-semibold">{t.gender}</label>
                    <select value={editForm.gender} onChange={e => setEditForm(p => ({ ...p, gender: e.target.value }))} className="w-full mt-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-black">
                      <option value="">—</option>
                      {(isKr ? GENDER_OPTIONS_KR : GENDER_OPTIONS_EN).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 font-semibold">{t.birthday}</label>
                    <input type="date" value={editForm.birthday} onChange={e => setEditForm(p => ({ ...p, birthday: e.target.value }))} className="w-full mt-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-black" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 font-semibold">{t.country}</label>
                    <input type="text" value={editForm.country} onChange={e => setEditForm(p => ({ ...p, country: e.target.value }))} className="w-full mt-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-black" />
                  </div>
                  <div>
                    <label className="text-xs text-neutral-500 font-semibold">{t.skinType}</label>
                    <select value={editForm.skin_type} onChange={e => setEditForm(p => ({ ...p, skin_type: e.target.value }))} className="w-full mt-1 border border-neutral-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-black">
                      <option value="">—</option>
                      {(isKr ? SKIN_OPTIONS_KR : SKIN_OPTIONS_EN).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer pt-2">
                    <input type="checkbox" checked={editForm.marketing_consent} onChange={() => setEditForm(p => ({ ...p, marketing_consent: !p.marketing_consent }))} className="w-4 h-4 rounded" />
                    <span className="text-sm text-neutral-600">{t.marketingConsent}</span>
                  </label>
                  <div className="flex gap-3 pt-2">
                    <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-2.5 bg-brand-ink text-white text-sm font-semibold rounded-lg hover:bg-black transition flex items-center gap-2 disabled:opacity-50">
                      <Save className="w-4 h-4" />{saving ? '...' : t.save}
                    </button>
                    <button onClick={() => setEditMode(false)} className="px-6 py-2.5 border border-neutral-200 text-sm font-semibold text-neutral-600 rounded-lg hover:bg-neutral-50 transition">
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'orders' && (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-neutral-200" />
              <p className="text-neutral-500 font-semibold">{t.ordersEmpty}</p>
              <p className="text-sm text-neutral-400 mt-2">{t.ordersPhase2}</p>
            </div>
          )}

          {tab === 'wishlist' && (
            <>
              {wishlist.length === 0 ? (
                <div className="py-16 text-center">
                  <Heart className="w-12 h-12 mx-auto mb-4 text-neutral-200" />
                  <p className="text-neutral-500 font-semibold">{t.wishEmpty}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wishlist.map(item => (
                    <div key={item.id} className="flex items-center gap-4 p-4 border border-neutral-100 rounded-xl hover:bg-neutral-50 transition-colors">
                      <div className="relative w-16 h-16 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product_image && <Image src={item.product_image} alt={item.product_name} fill sizes="64px" className="object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-brand-ink truncate">{item.product_name}</p>
                        <p className="text-sm text-neutral-500 mt-0.5">
                          {lang === 'kr' ? `${item.product_price.toLocaleString()}원` : `KRW ${item.product_price.toLocaleString()}`}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Link href={`/${lang}/products/${item.product_id}`} className="px-3 py-1.5 text-xs font-semibold text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-100 transition-colors">
                          {t.viewProduct}
                        </Link>
                        <button onClick={() => removeWish(item.id)} className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded hover:bg-red-50 transition-colors">
                          {t.remove}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
