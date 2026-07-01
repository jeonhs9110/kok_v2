'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, ShoppingBag, User, Menu, X, Globe, Heart } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import LanguagePicker from '@/components/LanguagePicker';
import { useState, useRef, useEffect, useCallback } from 'react';
import { USE_COGNITO_FROM_BROWSER } from '@/lib/auth/clientFlags';
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
  // Ref on the hamburger button so we can return focus to it after the
  // drawer closes — WCAG 2.4.3 Focus Order. Prior code dropped focus to
  // <body> when the drawer dismissed and keyboard users had to Tab
  // back through the whole page to get to the trigger.
  const hamburgerRef = useRef<HTMLButtonElement>(null);
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

  // Homepage gets the ANUA-style overlay treatment — header floats over
  // the hero slide (transparent bg) and fades to white as you scroll
  // past the hero. Every other route keeps the classic white bar so the
  // change is contained to the storefront landing experience.
  const pathname = usePathname() || '';
  const isHomepage = /^\/(kr|en)\/?$/.test(pathname);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  // Escape closes the mobile drawer + returns focus to the hamburger.
  // Also blur any focused link inside the drawer so returning focus
  // doesn't fight with a link that just triggered navigation.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
        requestAnimationFrame(() => hamburgerRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  useEffect(() => {
    if (!isHomepage) return;
    function onScroll() {
      // Fade threshold ≈ 80% of the viewport height — by the time the
      // hero scrolls out, the header is fully opaque against the next
      // section's background.
      setScrolledPastHero(window.scrollY > window.innerHeight * 0.8);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isHomepage]);

  // Auth state — read from the non-httpOnly mirror cookies set by the
  // sign-in / sign-out routes. The Supabase auth-state subscription used
  // to live here too, but post-Cognito-cutover the callback never fires
  // (no active Supabase auth client) and the subscribe call dragged
  // the dead Supabase singleton into every storefront bundle for no
  // payoff. Cookie refresh on every navigation is enough — full-page
  // reloads happen on sign-in (`window.location.href = ...`) and
  // sign-out (`window.location.href = ...`), so the cookies the
  // header reads are always fresh on the next mount.
  //
  // The eslint-disable matches every other post-hydration cookie read
  // in the codebase — setState-in-effect is required here to keep
  // SSR/client HTML aligned (server renders with isLoggedIn=false
  // initial state, client effect updates after mount).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoggedIn(document.cookie.includes('kokkok_auth=true'));
    setIsAdmin(document.cookie.includes('kokkok_admin_auth=true'));
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

  // Publish the live header height as a CSS variable so the ANUA-style
  // hero overlay on the homepage knows exactly how far to pull itself
  // up. Re-measured on theme-token changes (logo height / menu font)
  // because the header bar grows with WHICHEVER is tallest among the
  // floors, so a static value would drift after admin edits.
  const headerBarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bar = headerBarRef.current;
    if (!bar) return;
    function publish() {
      const h = bar!.getBoundingClientRect().height;
      if (h > 0) document.documentElement.style.setProperty('--kokkok-header-h', `${Math.round(h)}px`);
    }
    publish();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(publish) : null;
    if (ro) ro.observe(bar);
    window.addEventListener('resize', publish);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', publish);
    };
  }, []);

  // Mega-menu left offset. The dropdown panels (Product + dynamic menus)
  // span the full viewport width visually, but the inner column container
  // is shifted right so the FIRST submenu item aligns with the LEFT EDGE
  // of the triggering menu button's TEXT. Operator's 2026-06-17 ask:
  // submenus should sit directly under "Product" (etc.), not at the
  // far-left of the header. Re-measured on window resize so the offset
  // stays correct after a logo/menu-font theme change.
  const headerInnerRef = useRef<HTMLDivElement>(null);
  const productWrapRef = useRef<HTMLDivElement>(null);
  const menuWrapRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [megaLeft, setMegaLeft] = useState(0);

  // Each menu trigger's button uses px-4 (16px) horizontal padding. The
  // submenu items have no leading padding, so adding that 16 lines the
  // first submenu glyph up with the parent button's TEXT, not its box.
  const BUTTON_PADDING_LEFT = 16;

  const measureLeft = useCallback((triggerEl: HTMLElement | null) => {
    const inner = headerInnerRef.current;
    if (!triggerEl || !inner) return;
    const t = triggerEl.getBoundingClientRect();
    const i = inner.getBoundingClientRect();
    setMegaLeft(Math.max(0, t.left - i.left + BUTTON_PADDING_LEFT));
  }, []);

  const openMenu = (name: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setActiveMenu(name);
    // Measure the triggering wrap so the mega panel can offset its
    // columns to sit directly under the active button's text.
    if (name === 'product') {
      measureLeft(productWrapRef.current);
    } else if (name.startsWith('menu-')) {
      const slug = name.slice(5);
      measureLeft(menuWrapRefs.current.get(slug) || null);
    }
  };
  const closeMenu = () => {
    hoverTimer.current = setTimeout(() => setActiveMenu(null), 120);
  };

  // Keep megaLeft accurate after a viewport resize OR a theme-token
  // change (logo height / menu font size). Both reshuffle where the
  // Product button lands within the header bar.
  useEffect(() => {
    if (!activeMenu) return;
    function recompute() {
      if (activeMenu === 'product') measureLeft(productWrapRef.current);
      else if (activeMenu?.startsWith('menu-')) {
        const slug = activeMenu.slice(5);
        measureLeft(menuWrapRefs.current.get(slug) || null);
      }
    }
    window.addEventListener('resize', recompute);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(recompute) : null;
    if (ro && headerInnerRef.current) ro.observe(headerInnerRef.current);
    return () => {
      window.removeEventListener('resize', recompute);
      ro?.disconnect();
    };
  }, [activeMenu, measureLeft]);
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
              onClick={async () => {
                if (USE_COGNITO_FROM_BROWSER) {
                  // Cognito cookies are httpOnly — only the server can
                  // clear them. Same call also runs Cognito GlobalSignOut
                  // so any stolen JWT becomes inert backend-side.
                  // Wrapped in try/catch so a network blip during logout
                  // doesn't strand the visitor on the page with cookies
                  // intact — the reload below still fires and the
                  // server-side delete already cleared the cookies in
                  // the rare case the request actually reached the
                  // endpoint and only the response was lost.
                  try {
                    await fetch('/api/auth/cognito/sign-out', { method: 'POST' });
                  } catch { /* fall through to reload */ }
                } else {
                  document.cookie = "kokkok_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                  document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                }
                window.location.reload();
              }}
              className="hover:text-black transition-colors"
            >
              {util.logout}
            </button>
          ) : (
            <Link href="/login" className="hover:text-black transition-colors">{util.login}</Link>
          )}
          {/* Deep-link to MyPage's Orders tab — there's no standalone
              /[lang]/orders route, so before the 2026-06-10 audit this
              link 404'd on every page load via Next.js prefetch. */}
          <Link href={`/${lang}/mypage?tab=orders`} className="hover:text-black transition-colors">{util.order}</Link>
          <Link href={`/${lang}/recent`} className="hover:text-black transition-colors">{util.recent}</Link>
        </div>
      </div>

      {/* ── MAIN HEADER ─────────────────────────────────────────────── */}
      {/* Homepage: starts transparent + no border so the hero shows
          through; fades to white + border once the hero scrolls off
          screen. Other pages: classic white bar unchanged. The fade is
          opacity-driven so the menu fonts never reflow. */}
      <header
        className={
          isHomepage
            ? `sticky top-0 z-40 transition-colors duration-300 ${
                scrolledPastHero
                  ? 'bg-white border-b border-neutral-100 shadow-[0_1px_0_rgba(0,0,0,0.04)]'
                  : 'bg-transparent border-b border-transparent shadow-none backdrop-blur-[2px]'
              }`
            : 'sticky top-0 z-40 bg-white border-b border-neutral-100 shadow-[0_1px_0_rgba(0,0,0,0.04)]'
        }
        data-builder-section="menus"
      >
        <div ref={headerInnerRef} className="max-w-[1600px] mx-auto px-4 sm:px-8">
          {/* Header bar grows with WHICHEVER is tallest among:
                - the 66px floor (pre-token default)
                - the logo height + 24px breathing room
                - the menu font size + 36px (font + line-height + padding)
              so neither a 150px logo nor a 40px menu font crops. Each
              admin slider works independently — the operator can push the
              menu to 32px without touching the logo and the bar
              expands cleanly. */}
          <div
            ref={headerBarRef}
            className="kokkok-header-bar flex items-center gap-4 py-3"
            style={{
              minHeight: 'max(66px, calc(var(--header-logo-height, 40px) + 24px), calc(var(--header-menu-font-size, 15px) + 36px))',
            }}
          >

            {/* Mobile hamburger. aria-label flips with state so screen
                reader users get "Close menu" when the drawer is open
                instead of the stale "Menu" they used to hear. */}
            <button
              ref={hamburgerRef}
              className="lg:hidden p-2 -ml-2 text-neutral-900"
              onClick={() => setMobileOpen(v => !v)}
              aria-label={mobileOpen ? (lang === 'en' ? 'Close menu' : '메뉴 닫기') : (lang === 'en' ? 'Open menu' : '메뉴 열기')}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-drawer"
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
              data-builder-section="logo"
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="KOKKOK GARDEN"
                  // Explicit intrinsic dims reserve layout space so the
                  // header height doesn't jump when the logo bytes
                  // arrive (CLS +0.02-0.05 without them). CSS still
                  // controls the actually-rendered size via
                  // .kokkok-header-logo — width/height here are just
                  // the ratio the browser uses to pre-allocate the
                  // slot. fetchPriority=high mirrors LCP treatment
                  // since the logo is above-the-fold.
                  width={200}
                  height={48}
                  fetchPriority="high"
                  decoding="async"
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
                ref={productWrapRef}
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
                const menuLabel = menu.title?.[lang] || menu.title?.en || menu.title?.kr || menu.slug;
                if (!hasChildren) {
                  return (
                    <Link key={menu.slug} href={`/${lang}/menus/${menu.slug}`} className="px-4 h-full flex items-center kokkok-nav-menu-text font-semibold text-neutral-800 hover:text-black tracking-wide transition-colors">
                      {menuLabel}
                    </Link>
                  );
                }
                return (
                  <div
                    key={menu.slug}
                    ref={el => {
                      if (el) menuWrapRefs.current.set(menu.slug, el);
                      else menuWrapRefs.current.delete(menu.slug);
                    }}
                    className="relative h-full flex items-center"
                    onMouseEnter={() => openMenu(`menu-${menu.slug}`)}
                    onMouseLeave={closeMenu}
                  >
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
              <Link href={isLoggedIn ? `/${lang}/mypage` : '/login'} className="hidden sm:flex p-1.5 sm:p-2 text-neutral-900 hover:opacity-60 transition-opacity" aria-label={lang === 'en' ? 'Account' : '내 계정'}>
                <User className="w-[21px] h-[21px]" />
              </Link>
              {/* Wishlist deep-link — routes to MyPage's wishlist tab
                  when signed in, otherwise to /login. Was previously
                  reachable only from the profile page, so customers
                  who bookmarked products couldn't find their wishlist
                  in one click. Only rendered on sm+ (mobile keeps the
                  icon row tight; wishlist is accessible from MyPage on
                  the mobile drawer). */}
              <Link href={isLoggedIn ? `/${lang}/mypage?tab=wishlist` : '/login'} className="hidden sm:flex p-1.5 sm:p-2 text-neutral-900 hover:opacity-60 transition-opacity" aria-label={lang === 'en' ? 'Wishlist' : '위시리스트'}>
                <Heart className="w-[21px] h-[21px]" />
              </Link>
              {canPurchase && (
                <Link href="/cart" className="relative p-1.5 sm:p-2 text-neutral-900 hover:opacity-60 transition-opacity flex" aria-label={lang === 'en' ? 'Cart' : '장바구니'}>
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
            <div
              className="max-w-[1600px] mx-auto py-6 flex gap-12"
              style={{ paddingLeft: megaLeft || 32, paddingRight: 32 }}
            >
              {productMega.map(col => (
                <div key={col.slug}>
                  <Link
                    href={`/${lang}/products?category=${col.slug}`}
                    className="kokkok-header-submenu font-bold text-neutral-900 hover:text-brand-primary tracking-wide transition-colors"
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
                            className="kokkok-header-submenu text-neutral-500 hover:text-black transition-colors"
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
              <div
                className="max-w-[1600px] mx-auto py-6 flex gap-12"
                style={{ paddingLeft: megaLeft || 32, paddingRight: 32 }}
              >
                {menu.children.map(child => (
                  <Link
                    key={child.slug}
                    href={`/${lang}/menus/${child.slug}`}
                    className="kokkok-header-submenu font-bold text-neutral-900 hover:text-brand-primary tracking-wide transition-colors"
                    onClick={() => setActiveMenu(null)}
                  >
                    {child.title?.[lang] || child.title?.en || child.title?.kr || child.slug}
                  </Link>
                ))}
              </div>
            </div>
          )
        ))}

      {/* ── Mobile Menu Drawer ───────────────────────────────────────── */}
        {mobileOpen && (
          <div
            id="mobile-nav-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={lang === 'en' ? 'Site menu' : '사이트 메뉴'}
            className="lg:hidden bg-white border-t border-neutral-100 px-6 py-4 space-y-4 animate-in slide-in-from-top-2 duration-200"
          >
            <Link href={`/${lang}/products`} className="block kokkok-nav-menu-text font-bold text-neutral-800 py-2 border-b border-neutral-100" onClick={() => setMobileOpen(false)}>{nav.product}</Link>
            {navMenus.map(menu => (
              <Link key={menu.slug} href={`/${lang}/menus/${menu.slug}`} className="block kokkok-nav-menu-text font-bold text-neutral-800 py-2 border-b border-neutral-100" onClick={() => setMobileOpen(false)}>{menu.title?.[lang] || menu.title?.en || menu.title?.kr || ''}</Link>
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
                className="flex-1 text-base sm:text-sm bg-transparent outline-none placeholder:text-neutral-400"
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
