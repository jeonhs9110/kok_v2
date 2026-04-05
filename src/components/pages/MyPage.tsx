'use client';

import { useState, useEffect, useCallback } from 'react';
import { User, Package, Heart, LogOut, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const L: Record<string, {
  title: string; profile: string; orders: string; wishlist: string;
  email: string; joined: string; changePw: string; logout: string;
  ordersEmpty: string; ordersPhase2: string; wishEmpty: string;
  remove: string; viewProduct: string;
}> = {
  kr: { title: '마이페이지', profile: '프로필', orders: '주문내역', wishlist: '위시리스트', email: '이메일', joined: '가입일', changePw: '비밀번호 변경', logout: '로그아웃', ordersEmpty: '주문 내역이 없습니다', ordersPhase2: '결제 연동 후 주문 내역이 표시됩니다.', wishEmpty: '위시리스트가 비어 있습니다', remove: '삭제', viewProduct: '상품 보기' },
  en: { title: 'My Page', profile: 'Profile', orders: 'Orders', wishlist: 'Wishlist', email: 'Email', joined: 'Joined', changePw: 'Change Password', logout: 'Logout', ordersEmpty: 'No orders yet', ordersPhase2: 'Orders will be shown after payment integration.', wishEmpty: 'Your wishlist is empty', remove: 'Remove', viewProduct: 'View Product' },
  cn: { title: '我的页面', profile: '个人资料', orders: '订单', wishlist: '收藏夹', email: '邮箱', joined: '注册日期', changePw: '修改密码', logout: '退出', ordersEmpty: '暂无订单', ordersPhase2: '支付对接后将显示订单记录。', wishEmpty: '收藏夹为空', remove: '移除', viewProduct: '查看商品' },
  jp: { title: 'マイページ', profile: 'プロフィール', orders: '注文履歴', wishlist: 'お気に入り', email: 'メール', joined: '登録日', changePw: 'パスワード変更', logout: 'ログアウト', ordersEmpty: '注文履歴がありません', ordersPhase2: '決済連携後に注文履歴が表示されます。', wishEmpty: 'お気に入りが空です', remove: '削除', viewProduct: '商品を見る' },
  vn: { title: 'Trang Cá Nhân', profile: 'Hồ sơ', orders: 'Đơn hàng', wishlist: 'Yêu thích', email: 'Email', joined: 'Ngày tham gia', changePw: 'Đổi mật khẩu', logout: 'Đăng xuất', ordersEmpty: 'Chưa có đơn hàng', ordersPhase2: 'Đơn hàng sẽ hiển thị sau khi tích hợp thanh toán.', wishEmpty: 'Danh sách yêu thích trống', remove: 'Xóa', viewProduct: 'Xem sản phẩm' },
  th: { title: 'หน้าของฉัน', profile: 'โปรไฟล์', orders: 'คำสั่งซื้อ', wishlist: 'รายการโปรด', email: 'อีเมล', joined: 'วันที่สมัคร', changePw: 'เปลี่ยนรหัสผ่าน', logout: 'ออกจากระบบ', ordersEmpty: 'ยังไม่มีคำสั่งซื้อ', ordersPhase2: 'คำสั่งซื้อจะแสดงหลังเชื่อมต่อการชำระเงิน', wishEmpty: 'รายการโปรดว่างเปล่า', remove: 'ลบ', viewProduct: 'ดูสินค้า' },
};

interface WishItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  product_price: number;
}

interface MyPageProps {
  lang: string;
}

export default function MyPage({ lang }: MyPageProps) {
  const t = L[lang] ?? L['en'];
  const [tab, setTab] = useState<'profile' | 'orders' | 'wishlist'>('profile');
  const [userEmail, setUserEmail] = useState('');
  const [userCreated, setUserCreated] = useState('');
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

        // Fetch wishlist with product details
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

  const removeWish = async (id: string) => {
    try {
      if (!supabase) return;
      await supabase.from('wishlist').delete().eq('id', id);
      setWishlist(prev => prev.filter(w => w.id !== id));
    } catch { /* ignore */ }
  };

  const handleLogout = () => {
    document.cookie = "kokkok_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    supabase?.auth.signOut();
    window.location.href = `/${lang}`;
  };

  const tabs = [
    { key: 'profile' as const, label: t.profile, icon: User },
    { key: 'orders' as const, label: t.orders, icon: Package },
    { key: 'wishlist' as const, label: t.wishlist, icon: Heart },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 bg-white min-h-[60vh]">
      <h1 className="text-2xl font-extrabold tracking-tight text-[#111111] mb-8">{t.title}</h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200 mb-8">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-colors ${
              tab === key
                ? 'text-black border-b-2 border-black -mb-px'
                : 'text-neutral-400 hover:text-neutral-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-neutral-400 text-sm font-bold tracking-widest">Loading...</div>
      ) : (
        <>
          {/* Profile Tab */}
          {tab === 'profile' && (
            <div className="space-y-6">
              <div className="bg-neutral-50 rounded-xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500 font-medium">{t.email}</span>
                  <span className="text-sm font-semibold text-[#111111]">{userEmail || '-'}</span>
                </div>
                <div className="border-t border-neutral-100" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-neutral-500 font-medium">{t.joined}</span>
                  <span className="text-sm font-semibold text-[#111111]">{userCreated || '-'}</span>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => alert(lang === 'kr' ? '비밀번호 변경은 추후 지원됩니다.' : 'Password change coming soon.')}
                  className="px-6 py-3 border border-neutral-200 text-sm font-semibold text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  {t.changePw}
                </button>
                <button
                  onClick={handleLogout}
                  className="px-6 py-3 bg-[#111111] text-white text-sm font-semibold rounded-lg hover:bg-black transition-colors flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  {t.logout}
                </button>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {tab === 'orders' && (
            <div className="py-16 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-neutral-200" />
              <p className="text-neutral-500 font-semibold">{t.ordersEmpty}</p>
              <p className="text-sm text-neutral-400 mt-2">{t.ordersPhase2}</p>
            </div>
          )}

          {/* Wishlist Tab */}
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
                        <p className="font-semibold text-sm text-[#111111] truncate">{item.product_name}</p>
                        <p className="text-sm text-neutral-500 mt-0.5">{item.product_price.toLocaleString()}원</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Link
                          href={`/${lang}/products/${item.product_id}`}
                          className="px-3 py-1.5 text-xs font-semibold text-neutral-600 border border-neutral-200 rounded hover:bg-neutral-100 transition-colors"
                        >
                          {t.viewProduct}
                        </Link>
                        <button
                          onClick={() => removeWish(item.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-200 rounded hover:bg-red-50 transition-colors"
                        >
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
