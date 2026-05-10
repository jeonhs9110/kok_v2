'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Package, Heart, LogOut, ChevronRight, Save, Pencil } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
const SKIN_OPTIONS_KR = ['건성', '지성', '복합성', '민감성', '중성'];
const SKIN_OPTIONS_EN = ['Dry', 'Oily', 'Combination', 'Sensitive', 'Normal'];

export default function MyPage({ lang }: { lang: string }) {
  const t = L[lang] ?? L['en'];
  const isKr = lang === 'kr';
  const [tab, setTab] = useState<'profile' | 'orders' | 'wishlist'>('profile');
  const [userEmail, setUserEmail] = useState('');
  const [userCreated, setUserCreated] = useState('');
  const [userId, setUserId] = useState('');
  const [profile, setProfile] = useState<CustomerProfile>({ name: '', phone: '', gender: '', birthday: '', country: '', skin_type: '', marketing_consent: false });
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<CustomerProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [wishlist, setWishlist] = useState<WishItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email ?? '');
        setUserCreated(new Date(user.created_at).toLocaleDateString('ko-KR'));
        setUserId(user.id);

        // Fetch customer profile (maybeSingle so a brand-new user with no
        // customer_profiles row doesn't throw — they just see empty fields)
        const { data: profileData } = await supabase
          .from('customer_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileData) {
          const p = {
            name: profileData.name || '',
            phone: profileData.phone || '',
            gender: profileData.gender || '',
            birthday: profileData.birthday || '',
            country: profileData.country || '',
            skin_type: profileData.skin_type || '',
            marketing_consent: profileData.marketing_consent || false,
          };
          setProfile(p);
          setEditForm(p);
        }

        // Fetch wishlist
        const { data: wishes } = await supabase
          .from('wishlist')
          .select('id, product_id, products(name, images, price)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (wishes) {
          setWishlist(wishes.map((w: any) => ({
            id: w.id,
            product_id: w.product_id,
            product_name: w.products?.name ?? '',
            product_image: w.products?.images?.[0] ?? '',
            product_price: Number(w.products?.price ?? 0),
          })));
        }
      }
    } catch {
      console.warn('마이페이지 데이터 로딩 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveProfile = async () => {
    if (!supabase || !userId) return;
    setSaving(true);
    try {
      await supabase.from('customer_profiles').upsert({
        id: userId,
        email: userEmail,
        name: editForm.name || null,
        phone: editForm.phone || null,
        gender: editForm.gender || null,
        birthday: editForm.birthday || null,
        country: editForm.country || null,
        skin_type: editForm.skin_type || null,
        marketing_consent: editForm.marketing_consent,
      });
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
    if (!supabase) return;
    await supabase.from('wishlist').delete().eq('id', id);
    setWishlist(prev => prev.filter(w => w.id !== id));
  };

  const handleLogout = () => {
    document.cookie = "kokkok_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    supabase?.auth.signOut();
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
      if (!supabase || !userId) return;
      // Delete customer profile
      await supabase.from('customer_profiles').delete().eq('id', userId);
      // Delete wishlist
      await supabase.from('wishlist').delete().eq('user_id', userId);
      // Sign out
      document.cookie = "kokkok_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      await supabase.auth.signOut();
      alert(isKr ? '계정이 삭제되었습니다.' : 'Your account has been deleted.');
      window.location.href = `/${lang}`;
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
      <span className="text-sm font-semibold text-[#111]">{value || '—'}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 bg-white min-h-[60vh]">
      <h1 className="text-2xl font-extrabold tracking-tight text-[#111] mb-8">{t.title}</h1>

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
          {/* ═══ Profile Tab ═══ */}
          {tab === 'profile' && (
            <div className="space-y-6">
              {!editMode ? (
                /* ── View Mode ── */
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
                    <button onClick={handleLogout} className="px-6 py-3 bg-[#111] text-white text-sm font-semibold rounded-lg hover:bg-black transition-colors flex items-center gap-2">
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
                /* ── Edit Mode ── */
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
                    <button onClick={handleSaveProfile} disabled={saving} className="px-6 py-2.5 bg-[#111] text-white text-sm font-semibold rounded-lg hover:bg-black transition flex items-center gap-2 disabled:opacity-50">
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

          {/* ═══ Orders Tab ═══ */}
          {tab === 'orders' && (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-neutral-200" />
              <p className="text-neutral-500 font-semibold">{t.ordersEmpty}</p>
              <p className="text-sm text-neutral-400 mt-2">{t.ordersPhase2}</p>
            </div>
          )}

          {/* ═══ Wishlist Tab ═══ */}
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
                      <div className="w-16 h-16 bg-neutral-100 rounded-lg overflow-hidden flex-shrink-0">
                        {item.product_image && <img src={item.product_image} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-[#111] truncate">{item.product_name}</p>
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
