'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, LogIn } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import RichEditor from '@/components/admin/RichEditor';

interface Props {
  menuId: string;
  menuSlug: string;
  menuTitle: string;
  postId?: string;
}

/**
 * Community-board post compose / edit page. All DB access goes through
 * /api/customer/me + /api/customer/posts/* (dispatch to RDS via
 * USE_RDS=true). The `kokkok_admin_auth` cookie still unlocks the
 * "pin as notice" + cross-author edit affordances on the client; the
 * actual server-side guard is the requireAdmin() / requireCustomer()
 * check on the matching admin/customer routes.
 */
export default function PostWritePage({ menuId, menuSlug, menuTitle, postId }: Props) {
  const { lang } = useI18n();
  const router = useRouter();
  const isEdit = !!postId;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [isNotice, setIsNotice] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authState, setAuthState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  // Round 29: mirror the server-side caps so a paste-of-a-novel
  // gets rejected inline with a counter instead of surfacing as a
  // generic alert() after the round-trip.
  const TITLE_MAX = 200;
  const CONTENT_MAX = 50_000;
  const titleOverLimit = title.length > TITLE_MAX;
  const contentOverLimit = content.length > CONTENT_MAX;

  useEffect(() => {
    (async () => {
      const adminCookie = document.cookie.includes('kokkok_admin_auth=true');
      setIsAdmin(adminCookie);

      let signedIn = false;
      try {
        const meRes = await fetch('/api/customer/me', { cache: 'no-store' });
        if (meRes.ok) {
          // Round 29: DON'T prefill authorName with the email
          // local-part. `me.email?.split('@')[0]` used to seed the
          // display-name field with the customer's email prefix
          // (e.g. `kimhs1985@naver.com` → `kimhs1985`) — which is
          // neither empty nor email-shaped, so `deriveStoredAuthorName`
          // stored it verbatim and every subsequent board post
          // published the customer's email handle publicly. Leaving
          // authorName blank falls through to the server's pseudonym
          // path (`회원_xxxxxx`) which is the PIPA-safe default. Admin
          // path below still surfaces the label so the admin badge
          // renders as-authored.
          signedIn = true;
        }
      } catch { /* ignore */ }

      if (!signedIn) {
        const hasMockAuth = document.cookie.includes('kokkok_auth=true');
        if (hasMockAuth) {
          setAuthState('authenticated');
          setAuthorName('관리자');
        } else {
          setAuthState('unauthenticated');
          return;
        }
      } else {
        setAuthState('authenticated');
      }

      if (postId) {
        try {
          const res = await fetch(`/api/customer/posts/${postId}/detail`, { cache: 'no-store' });
          if (res.ok) {
            const json = (await res.json()) as { post: { title: string; content: string | null; author_name: string; is_admin_post: boolean } | null };
            if (json.post) {
              setTitle(json.post.title);
              setContent(json.post.content ?? '');
              setAuthorName(json.post.author_name);
              setIsNotice(json.post.is_admin_post);
            }
          }
        } catch { /* ignore */ }
      }
    })();
  }, [postId]);

  // Round 29: guard against accidental navigation while there's
  // unsaved input. Applies once the customer has typed something and
  // the form isn't currently submitting. The Cancel link and browser
  // back / tab-close all go through beforeunload. YouTube / Medium /
  // Notion all guard against this — otherwise a customer typing a
  // long post loses everything to a stray Cmd+W.
  useEffect(() => {
    const dirty = (title.trim().length + content.trim().length) > 0;
    if (!dirty || submitting) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Chrome ignores the returnValue string these days, but the
      // deprecated assignment is still what triggers the confirm
      // in Safari / Firefox. Empty string is enough.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [title, content, submitting]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      if (isEdit && postId) {
        // Admin can pin/unpin via the admin route; regular owners use
        // the customer route which doesn't accept the is_admin_post flag.
        const endpoint = isAdmin ? `/api/admin/posts/${postId}` : `/api/customer/posts/${postId}`;
        const res = await fetch(endpoint, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
            ...(isAdmin ? { is_admin_post: isNotice } : {}),
          }),
        });
        if (!res.ok) throw new Error('http_' + res.status);
      } else {
        const endpoint = isAdmin ? '/api/admin/posts' : '/api/customer/posts';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_id: menuId,
            title: title.trim(),
            content: content.trim(),
            author_name: authorName.trim(),
            ...(isAdmin ? { is_admin_post: isNotice } : {}),
          }),
        });
        if (!res.ok) throw new Error('http_' + res.status);
      }
      router.push(`/${lang}/menus/${menuSlug}`);
    } catch {
      alert(lang === 'kr' ? '게시글 저장에 실패했습니다.' : 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authState === 'loading') {
    return <div className="min-h-[50vh] flex items-center justify-center text-neutral-400 text-sm">...</div>;
  }

  if (authState === 'unauthenticated') {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 rounded-full bg-neutral-50 flex items-center justify-center mx-auto mb-6">
          <LogIn className="w-7 h-7 text-neutral-400" />
        </div>
        <h2 className="text-xl font-bold text-brand-ink mb-2">{lang === 'kr' ? '로그인이 필요합니다' : 'Sign in required'}</h2>
        <p className="text-sm text-neutral-400 mb-6">{lang === 'kr' ? '게시글을 작성하려면 로그인해 주세요.' : 'Please sign in to write a post.'}</p>
        {/* Round 25: preserve the write URL as ?next= so a customer
            who signs in from this gate lands back on the write form,
            not the storefront homepage. Same-origin only via
            safeNext() on LoginForm's side. */}
        <Link
          href={`/login?next=${encodeURIComponent(`/${lang}/menus/${menuSlug}/write${postId ? `/${postId}` : ''}`)}`}
          className="inline-flex items-center gap-2 px-6 py-3 bg-brand-ink text-white text-sm font-bold tracking-wider hover:bg-black transition-colors"
        >
          <LogIn className="w-4 h-4" /> {lang === 'kr' ? '로그인하기' : 'Sign In'}
        </Link>
      </div>
    );
  }

  const pageTitle = isEdit
    ? (lang === 'kr' ? '글 수정' : 'Edit Post')
    : (lang === 'kr' ? '글쓰기' : 'Write a Post');

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest flex-wrap gap-y-1">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">HOME</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <Link href={`/${lang}/menus/${menuSlug}`} className="hover:text-black transition-colors">{menuTitle}</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-brand-ink">{pageTitle}</span>
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight mb-8">{pageTitle}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">{lang === 'kr' ? '작성자' : 'Author'}</label>
          <input type="text" value={authorName} readOnly className="w-full border border-neutral-200 rounded-lg px-4 py-3 text-sm bg-neutral-50 text-neutral-500 cursor-not-allowed" />
        </div>
        {isAdmin && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isNotice} onChange={e => setIsNotice(e.target.checked)} className="w-4 h-4 rounded accent-[#111]" />
            <span className="text-sm font-semibold text-brand-ink">{lang === 'kr' ? '공지로 등록' : 'Pin as Notice'}</span>
          </label>
        )}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">{lang === 'kr' ? '제목 *' : 'Title *'}</label>
          <input
            type="text"
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={TITLE_MAX}
            placeholder={lang === 'kr' ? '제목을 입력하세요' : 'Post title'}
            className="w-full border border-neutral-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
          />
          <p className={`text-[11px] mt-1 ${titleOverLimit ? 'text-red-500' : 'text-neutral-400'}`}>
            {title.length} / {TITLE_MAX}
          </p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">{lang === 'kr' ? '내용' : 'Content'}</label>
          <RichEditor
            content={content}
            onChange={setContent}
            uploadPath={`posts/${menuSlug}`}
            minHeight={320}
          />
          <p className="text-[11px] text-neutral-400 mt-2">{lang === 'kr' ? '이미지는 드래그 또는 붙여넣기, 동영상/유튜브/HTML은 상단 버튼을 사용하세요.' : 'Drag or paste images. Use the toolbar for videos, YouTube, and raw HTML.'}</p>
          <p className={`text-[11px] mt-1 ${contentOverLimit ? 'text-red-500' : 'text-neutral-400'}`}>
            {content.length.toLocaleString()} / {CONTENT_MAX.toLocaleString()}
          </p>
        </div>
        <div className="flex gap-3 pt-4">
          <Link href={`/${lang}/menus/${menuSlug}`} className="px-6 py-3 border border-neutral-200 text-neutral-600 text-sm font-semibold hover:bg-neutral-50 transition-colors">
            {lang === 'kr' ? '취소' : 'Cancel'}
          </Link>
          <button
            type="submit"
            disabled={submitting || titleOverLimit || contentOverLimit}
            className="px-8 py-3 bg-brand-ink text-white text-sm font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-50"
          >
            {submitting
              ? (lang === 'kr' ? '저장 중...' : 'Saving...')
              : isEdit
                ? (lang === 'kr' ? '수정 완료' : 'Save Changes')
                : (lang === 'kr' ? '등록' : 'Submit')}
          </button>
        </div>
      </form>
    </div>
  );
}
