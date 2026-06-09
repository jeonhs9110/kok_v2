'use client';

import Link from 'next/link';
import { Search, ShoppingBag, User, Menu, X, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import LanguagePicker from '@/components/LanguagePicker';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/api/products';
import type { CategoryWithChildren } from '@/lib/api/categories';
import type { MenuWithChildren } from '@/lib/api/menus';
import { useCart } from '@/lib/cart/CartContext';

interface HeaderProps {
  canPurchase?: boolean;
  /**
   * SSR-fetched header data, passed in by [lang]/layout.tsx via
   * lib/cache/header.ts. Used as initial useState values so the first
   * client render matches the server HTML — no expanding-nav flicker.
   */
  initialNavMenus?: MenuWithChildren[];
  initialMegaCategories?: CategoryWithChildren[];
  initialLogoUrl?: string;
}

/* ── i18n utility strings ───────────────────────────────────────────── */
const UTILITY: Record<string, { join: string; login: string; logout: string; order: string; recent: string }> = {
  kr: { join: '회원가입', login: '로그인', logout: '로그아웃', order: '주문조회', recent: '최근본상품' },
  en: { join: 'Sign Up', login: 'Login', logout: 'Logout', order: 'Order', recent: 'Recently Viewed' },
};

const NAV_LABELS: Record<string, { product: string; event: string; brand: string; review: string; global: string; worldwide: string }> = {
  kr: { product: 'Product', event: 'EVENT & NOTICE', brand: 'BRAND STORY', review: 'REVIEW & COMMUNITY', global: 'SHOP Worldwide', worldwide: 'SHOP Worldwide' },
  en: { product: 'Product', event: 'EVENT & NOTICE', brand: 'BRAND STORY', review: 'REVIEWS', global: 'SHOP Worldwide', worldwide: 'SHOP Worldwide' },
};

export default function Header({
  canPurchase = true,
  initialNavMenus = [],
  initialMegaCategories = [],
  initialLogoUrl = '/kokkokgarden_primary.svg',
}: HeaderProps) {
  const { lang } = useI18n();
  const { totalCount } = useCart();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Server-prefetched via [lang]/layout.tsx (lib/cache/header.ts). No setters
  // because we no longer refetch client-side after the initial render — the
  // ~60s cache TTL on the server is fresh enough, and refetching here would
  // re-introduce the hydration flicker this whole code path was rewritten
  // to eliminate.
  const navMenus = initialNavMenus;
  const megaCategories = initialMegaCategories;
  const logoUrl = initialLogoUrl;
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Auth state — re-evaluates on mount AND on supabase auth events so the
  // header swaps Sign-in ↔ Logout immediately after login, without a reload.
  useEffect(() => {
    const refresh = () => {
      if (typeof document === 'undefined') return;
      setIsLoggedIn(document.cookie.includes('kokkok_auth=true'));
      setIsAdmin(document.cookie.includes('kokkok_admin_auth=true'));
    };
    refresh();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => refresh());
    return () => subscription.unsubscribe();
  }, []);

  // Nav menus / mega-categories / logo are SSR'd by [lang]/layout.tsx via
  // lib/cache/header.ts (60s revalidate). The previous client-side fetch
  // here caused a visible header expansion ~300ms after first paint, which
  // looked like the nav was loading in. Removing that fetch makes the
  // first paint identical to the post-hydration state.
  const util = UTILITY[lang] ?? UTILITY['en'];
  const nav = NAV_LABELS[lang] ?? NAV_LABELS['en'];

  const productMega = megaCategories.map(cat => ({
    label: cat.name[lang] || cat.name['en'] || cat.slug,
    slug: cat.slug,
    items: cat.children.map(sub => ({
      name: sub.name[lang] || sub.name['en'] || sub.slug,
      slug: sub.slug,
    })),
  }));

  const openMenu = (name: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setActiveMenu(name);
  };
  const closeMenu = () => {
    hoverTimer.current = setTimeout(() => setActiveMenu(null), 120);
  };
  const keepMenu = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchOpen(false);
    window.location.href = `/${lang}/products?q=${encodeURIComponent(searchQuery.trim())}`;
  };

  return (
    <>
      {/* ── UTILITY BAR ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-neutral-100 hidden lg:block">
        <div className="max-w-[1600px] mx-auto px-8 flex justify-end items-center h-9 gap-5 text-[11px] text-neutral-500 font-medium tracking-wide">
          {isAdmin && (
            <Link href="/admin" className="hover:text-black transition-colors text-brand-primary font-bold">ADMIN</Link>
          )}
          {!isLoggedIn && (
            <Link href="/register" className="hover:text-black transition-colors">{util.join}</Link>
          )}
          {isLoggedIn ? (
            <button
              onClick={() => {
                document.cookie = "kokkok_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                window.location.reload();
              }}
              className="hover:text-black transition-colors"
            >
              {util.logout}
            </button>
          ) : (
            <Link href="/login" className="hover:text-black transition-colors">{util.login}</Link>
          )}
          <Link href={`/${lang}/orders`} className="hover:text-black transition-colors">{util.order}</Link>
          <Link href={`/${lang}/recent`} className="hover:text-black transition-colors">{util.recent}</Link>
        </div>
      </div>

      {/* ── MAIN HEADER ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white border-b border-neutral-100 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-8">
          <div className="flex items-center h-[66px] gap-4">

            {/* Mobile hamburger */}
            <button
              className="lg:hidden p-2 -ml-2 text-neutral-900"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            {/* Logo
                mr-8 spaces the logo from the nav on lg+ where the nav
                actually renders next to it. On mobile/tablet the nav is
                lg:hidden, so the 32px gap is just dead pixels that push
                the right icons (including LanguagePicker) toward — and on
                Galaxy Z Fold outer, past — the viewport edge, which is
                what was causing the page-wide right whitespace. */}
            <Link
              href={`/${lang}`}
              className="flex-shrink-0 mr-2 lg:mr-8 flex items-center"
              aria-label="Kokkok Garden"
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="KOKKOK GARDEN"
                  className="kokkok-header-logo"
                />
              ) : (
                <span className="kokkok-header-logo-text text-[22px] font-black tracking-[0.12em] text-brand-ink uppercase">
                  KOKKOK<br className="hidden" /> GARDEN
                </span>
              )}
            </Link>

            {/* ── Desktop Nav ─────────────────────────────────────────── */}
            <nav className="hidden lg:flex items-center flex-1 h-full">

              {/* Product — slim submenu bar (reference style) */}
              <div
                className="relative h-full flex items-center"
                onMouseEnter={() => openMenu('product')}
                onMouseLeave={closeMenu}
              >
                <button className={`flex items-center gap-1 px-4 h-full kokkok-nav-menu-text font-semibold tracking-wide transition-colors ${activeMenu === 'product' ? 'text-black' : 'text-neutral-800 hover:text-black'}`}>
                  {nav.product}
                </button>
                {/* Green underline indicator */}
                {activeMenu === 'product' && (
                  <span className="absolute bottom-0 left-4 right-4 h-[2.5px] bg-brand-primary rounded-full" />
                )}
              </div>

              {/* Dynamic menus from DB */}
              {navMenus.map(menu => {
                const hasChildren = menu.children.length > 0;
                const menuLabel = menu.title?.[lang] || menu.title?.kr || menu.title?.en || menu.slug;
                if (!hasChildren) {
                  return (
                    <Link key={menu.slug} href={`/${lang}/menus/${menu.slug}`} className="px-4 h-full flex items-center kokkok-nav-menu-text font-semibold text-neutral-800 hover:text-black tracking-wide transition-colors">
                      {menuLabel}
                    </Link>
                  );
                }
                return (
                  <div key={menu.slug} className="relative h-full flex items-center" onMouseEnter={() => openMenu(`menu-${menu.slug}`)} onMouseLeave={closeMenu}>
                    <Link href={`/${lang}/menus/${menu.slug}`} className={`flex items-center gap-1 px-4 h-full kokkok-nav-menu-text font-semibold tracking-wide transition-colors ${activeMenu === `menu-${menu.slug}` ? 'text-black' : 'text-neutral-800 hover:text-black'}`}>
                      {menuLabel}
                    </Link>
                    {activeMenu === `menu-${menu.slug}` && (
                      <span className="absolute bottom-0 left-4 right-4 h-[2.5px] bg-brand-primary rounded-full" />
                    )}
                  </div>
                );
              })}

              {/* Shop Worldwide — direct link */}
              <Link
                href={`/${lang}/worldwide`}
                className="px-4 h-full flex items-center kokkok-nav-menu-text font-semibold text-neutral-800 hover:text-black tracking-wide transition-colors"
              >
                {nav.global}
              </Link>
            </nav>

            {/* ── Right Icons ──────────────────────────────────────────── */}
            {/* Tightened gap + padding on xs so this row fits inside a
                360px viewport (Galaxy Z Fold outer cover display). The
                previous gap-2 + p-2 pattern overflowed by ~16px which is
                what was clipping the LanguagePicker chevron off the
                right edge and driving the page-wide right whitespace. */}
            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <button onClick={() => setSearchOpen(v => !v)} className="p-1.5 sm:p-2 text-neutral-900 hover:opacity-60 transition-opacity" aria-label="Search">
                <Search className="w-[21px] h-[21px]" />
              </button>
              <Link href={isLoggedIn ? `/${lang}/mypage` : '/login'} className="hidden sm:flex p-1.5 sm:p-2 text-neutral-900 hover:opacity-60 transition-opacity" aria-label="Account">
                <User className="w-[21px] h-[21px]" />
              </Link>
              {canPurchase && (
                <Link href="/cart" className="relative p-1.5 sm:p-2 text-neutral-900 hover:opacity-60 transition-opacity flex" aria-label="Cart">
                  <ShoppingBag className="w-[21px] h-[21px]" />
                  {totalCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] bg-brand-ink text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {totalCount > 99 ? '99' : totalCount}
                    </span>
                  )}
                </Link>
              )}
              <LanguagePicker />
            </div>

          </div>
        </div>

          {/* ── Product Mega Menu ─────────────────────────────────────── */}
        {activeMenu === 'product' && productMega.length > 0 && (
          <div
            className="absolute top-full left-0 w-full bg-white border-t border-neutral-100 shadow-lg z-30"
            onMouseEnter={keepMenu}
            onMouseLeave={closeMenu}
          >
            <div className="max-w-[1600px] mx-auto px-8 py-6 flex gap-12">
              {productMega.map(col => (
                <div key={col.slug}>
                  <Link
                    href={`/${lang}/products?category=${col.slug}`}
                    className="text-[13px] font-bold text-neutral-900 hover:text-brand-primary tracking-wide transition-colors"
                    onClick={() => setActiveMenu(null)}
                  >
                    {col.label}
                  </Link>
                  {col.items.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5">
                      {col.items.map(item => (
                        <li key={item.slug}>
                          <Link
                            href={`/${lang}/products?sub=${item.slug}`}
                            className="text-[12.5px] text-neutral-500 hover:text-black transition-colors"
                            onClick={() => setActiveMenu(null)}
                          >
                            {item.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      {/* ── Menu Mega Menus ─────────────────────────────────────────── */}
        {navMenus.filter(m => m.children.length > 0).map(menu => (
          activeMenu === `menu-${menu.slug}` && (
            <div
              key={menu.slug}
              className="absolute top-full left-0 w-full bg-white border-t border-neutral-100 shadow-lg z-30"
              onMouseEnter={keepMenu}
              onMouseLeave={closeMenu}
            >
              <div className="max-w-[1600px] mx-auto px-8 py-6 flex gap-12">
                {menu.children.map(child => (
                  <Link
                    key={child.slug}
                    href={`/${lang}/menus/${child.slug}`}
                    className="text-[13px] font-bold text-neutral-900 hover:text-brand-primary tracking-wide transition-colors"
                    onClick={() => setActiveMenu(null)}
                  >
                    {child.title?.[lang] || child.title?.kr || child.title?.en || child.slug}
                  </Link>
                ))}
              </div>
            </div>
          )
        ))}

      {/* ── Mobile Menu Drawer ───────────────────────────────────────── */}
        {mobileOpen && (
          <div className="lg:hidden bg-white border-t border-neutral-100 px-6 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <Link href={`/${lang}/products`} className="block kokkok-nav-menu-text font-bold text-neutral-800 py-2 border-b border-neutral-100" onClick={() => setMobileOpen(false)}>{nav.product}</Link>
            {navMenus.map(menu => (
              <Link key={menu.slug} href={`/${lang}/menus/${menu.slug}`} className="block kokkok-nav-menu-text font-bold text-neutral-800 py-2 border-b border-neutral-100" onClick={() => setMobileOpen(false)}>{menu.title?.[lang] || menu.title?.kr || menu.title?.en || ''}</Link>
            ))}
            <Link href={`/${lang}/worldwide`} className="flex items-center gap-2 kokkok-nav-menu-text font-bold text-neutral-800 py-2 border-b border-neutral-100" onClick={() => setMobileOpen(false)}>
              <Globe className="w-4 h-4" /> {nav.worldwide}
            </Link>
            <div className="pt-2 flex gap-4 text-[12px] text-neutral-400">
              <Link href="/login" onClick={() => setMobileOpen(false)}>{util.login}</Link>
              <Link href="/register" onClick={() => setMobileOpen(false)}>{util.join}</Link>
            </div>
          </div>
        )}
        {/* ── Search Overlay ─────────────────────────────────────────── */}
        {searchOpen && (
          <div className="absolute top-full left-0 w-full bg-white border-t border-neutral-100 shadow-lg z-40 animate-in fade-in slide-in-from-top-1 duration-150">
            <form onSubmit={handleSearch} className="max-w-[1600px] mx-auto px-4 sm:px-8 py-4 flex items-center gap-3">
              <Search className="w-5 h-5 text-neutral-400 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={lang === 'kr' ? '상품명, 성분, 키워드 검색...' : 'Search products...'}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-neutral-400"
              />
              <button type="submit" className="px-4 py-2 bg-brand-ink text-white text-xs font-bold tracking-widest rounded hover:bg-black transition-colors">
                {lang === 'kr' ? '검색' : 'Search'}
              </button>
              <button type="button" onClick={() => { setSearchOpen(false); setSearchQuery(''); }} className="p-1.5 text-neutral-400 hover:text-black transition-colors">
                <X className="w-5 h-5" />
              </button>
            </form>
          </div>
        )}
      </header>
    </>
  );
}
