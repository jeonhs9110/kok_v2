'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';

interface Props {
  href: string;
  label: string;
  /** If true, button is always visible (board allows any user to write) */
  alwaysShow?: boolean;
}

/**
 * Displays the 글쓰기 button for boards.
 * Always renders when alwaysShow is true, otherwise only if admin cookie is set.
 * Also shows when a regular login cookie exists — the write page will gate further.
 */
export default function BoardWriteButton({ href, label, alwaysShow = false }: Props) {
  // Defer auth-cookie check to after mount to avoid hydration mismatch and
  // satisfy "no setState synchronously in effect" rule.
  const [visible, setVisible] = useState(alwaysShow);

  useEffect(() => {
    if (alwaysShow) return;
    const handle = window.setTimeout(() => {
      if (typeof document === 'undefined') return;
      const isAdmin = document.cookie.includes('kokkok_admin_auth=true');
      const isLoggedIn = document.cookie.includes('kokkok_auth=true');
      if (isAdmin || isLoggedIn) setVisible(true);
    }, 0);
    return () => window.clearTimeout(handle);
  }, [alwaysShow]);

  if (!visible) return null;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-ink text-white text-[13px] font-bold tracking-wider hover:bg-black transition-colors"
    >
      <Pencil className="w-3.5 h-3.5" />
      {label}
    </Link>
  );
}
