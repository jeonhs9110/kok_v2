'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Package, Video, LayoutDashboard, LogOut, ExternalLink, Tag, MenuSquare, Image } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navItems = [
    { name: '대시보드', href: '/admin', icon: LayoutDashboard },
    { name: '사용자', href: '/admin/users', icon: Users },
    { name: '카테고리', href: '/admin/categories', icon: Tag },
    { name: '상품 관리', href: '/admin/products', icon: Package },
    { name: '캐러셀', href: '/admin/carousel', icon: Image },
    { name: '메뉴 관리', href: '/admin/menus', icon: MenuSquare },
    { name: '숏츠', href: '/admin/shorts', icon: Video },
  ];

  const pageTitle: Record<string, string> = {
    '/admin': '대시보드 개요',
    '/admin/users': '사용자 관리',
    '/admin/categories': '카테고리 관리',
    '/admin/products': '상품 관리',
    '/admin/carousel': '캐러셀 관리',
    '/admin/menus': '메뉴 관리',
    '/admin/shorts': '숏츠 관리',
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* 사이드바 */}
      <aside className="w-64 bg-[#111111] text-white flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-800">
          <span className="text-lg font-bold tracking-widest">관리자 포털</span>
        </div>
        
        <nav className="flex-1 py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-1">
          <Link
            href="/kr"
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            스토어 보기
          </Link>
          <button
            onClick={() => {
              document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
              window.location.href = '/';
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border-none bg-transparent"
          >
            <LogOut className="w-5 h-5" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 shadow-sm">
          <h1 className="text-xl font-semibold text-gray-800">
            {pageTitle[pathname] ?? pathname.split('/').pop()}
          </h1>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
