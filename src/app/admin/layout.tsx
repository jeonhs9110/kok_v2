'use client';

import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import AdminSearchModal from './_components/AdminSearchModal';
import EmbeddedShell from './_components/EmbeddedShell';
import AdminSidebar from './_components/AdminSidebar';
import AdminTopBar from './_components/AdminTopBar';
import { PAGE_TITLE, previewUrlFor } from './_components/nav';
import { ToastProvider } from '@/components/admin/Toast';
import { ConfirmProvider } from '@/components/admin/ConfirmModal';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Close mobile drawer on route change so the admin lands on the new page
  // instead of staring at the menu they just clicked. setState in an effect
  // is intentional here — no render cycle, just reacting to navigation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Cmd/Ctrl+K opens the global search modal. Same shortcut shape as
  // VSCode/Linear/Notion so muscle memory carries over.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const previewUrl = previewUrlFor(pathname);
  const title = PAGE_TITLE[pathname] ?? pathname.split('/').pop() ?? '관리자';

  // /admin/homepage is the Cafe24-style builder that owns its own chrome
  // (top toolbar + section list + preview). Render its children straight
  // through so the global sidebar + header don't compete with it visually.
  // Operator can leave via the builder's own 종료 (exit) button which
  // deep-links to /admin (dashboard).
  if (pathname === '/admin/homepage') {
    return (
      <div
        className="kokkok-admin-shell h-screen w-screen bg-[#f5f6f8] overflow-hidden"
        style={{ fontFamily: 'Pretendard, "Noto Sans KR", system-ui, sans-serif' }}
      >
        {children}
        <AdminSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    );
  }

  // Body bg #f5f6f8 matches Cafe24's admin panel exactly — slightly cooler
  // than gray-50 so the content cards lift off the surface the way Cafe24's do.
  //
  // The sidebar is fixed-positioned + hover-expand on desktop (icon-only
  // 56px default → 224px on hover, overlaying content). So <main> gets a
  // static md:ml-14 gutter and content never shifts when the rail
  // expands. Mobile stays as a slide-in drawer.
  //
  // font-['Pretendard'] applied on the shell so the admin renders in the
  // same geometry as Cafe24's reference (Freesentation's wider letters
  // were one of the "feels off" signals the boss kept flagging).
  const normalChrome = (
    <div
      className="kokkok-admin-shell h-screen bg-[#f5f6f8]"
      style={{ fontFamily: 'Pretendard, "Noto Sans KR", system-ui, sans-serif' }}
    >
      {/* Mobile backdrop — sits between content and drawer; tap to dismiss. */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <AdminSidebar
        pathname={pathname}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      <main className="h-full overflow-auto md:ml-14 transition-[margin-left] duration-200">
        <AdminTopBar
          title={title}
          previewUrl={previewUrl}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>

      <AdminSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );

  // When loaded inside /admin/homepage's slide-in editor drawer
  // (`?embedded=true`), EmbeddedShell strips the sidebar + header so
  // the editor fills the drawer pane. Suspense fallback is the normal
  // chrome so the SSR'd HTML matches the unembedded common case —
  // avoids a sidebar flash on iframe load in the drawer.
  return (
    <ToastProvider>
      <ConfirmProvider>
        <Suspense fallback={normalChrome}>
          <EmbeddedShell fallback={normalChrome}>
            {children}
          </EmbeddedShell>
        </Suspense>
      </ConfirmProvider>
    </ToastProvider>
  );
}
