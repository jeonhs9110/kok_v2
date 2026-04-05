'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, LogIn } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import type { Post } from '@/lib/api/menus';

interface Props {
  menuId: string;
  menuSlug: string;
  menuTitle: string;
  postId?: string;
}

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
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const adminCookie = document.cookie.includes('kokkok_admin_auth=true');
      setIsAdmin(adminCookie);

      if (!user) {
        // Fallback: check mock admin cookie
        const hasAuth = document.cookie.includes('kokkok_auth=true');
        if (hasAuth) {
          setAuthState('authenticated');
          setAuthorName('관리자');
          setUserId(null);
        } else {
          setAuthState('unauthenticated');
          return;
        }
      } else {
        setAuthState('authenticated');
        setUserId(user.id);
        // Get display name from users table or use email
        const { data: profile } = await supabase.from('users').select('email').eq('id', user.id).single();
        setAuthorName(profile?.email?.split('@')[0] || user.email?.split('@')[0] || '사용자');
      }

      // Load existing post for edit mode
      if (postId) {
        const { data: post } = await supabase.from('posts').select('*').eq('id', postId).single();
        if (post) {
          setTitle(post.title);
          setContent(post.content || '');
          setAuthorName(post.author_name);
          setIsNotice(post.is_admin_post);
        }
      }
    };
    init();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const supabase = createClient();

      if (isEdit && postId) {
        const { error } = await supabase.from('posts')
          .update({
            title: title.trim(),
            content: content.trim(),
            is_admin_post: isAdmin ? isNotice : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', postId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('posts').insert({
          menu_id: menuId,
          title: title.trim(),
          content: content.trim(),
          author_name: authorName.trim(),
          author_id: userId,
          is_admin_post: isAdmin && isNotice,
          is_published: true,
        });
        if (error) throw error;
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
        <h2 className="text-xl font-bold text-[#111] mb-2">{lang === 'kr' ? '로그인이 필요합니다' : 'Sign in required'}</h2>
        <p className="text-sm text-neutral-400 mb-6">{lang === 'kr' ? '게시글을 작성하려면 로그인해 주세요.' : 'Please sign in to write a post.'}</p>
        <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-[#111] text-white text-sm font-bold tracking-wider hover:bg-black transition-colors">
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
        <span className="text-[#111]">{pageTitle}</span>
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
            <span className="text-sm font-semibold text-[#111]">{lang === 'kr' ? '공지로 등록' : 'Pin as Notice'}</span>
          </label>
        )}
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">{lang === 'kr' ? '제목 *' : 'Title *'}</label>
          <input type="text" required value={title} onChange={e => setTitle(e.target.value)} placeholder={lang === 'kr' ? '제목을 입력하세요' : 'Post title'} className="w-full border border-neutral-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1.5">{lang === 'kr' ? '내용' : 'Content'}</label>
          <textarea rows={12} value={content} onChange={e => setContent(e.target.value)} placeholder={lang === 'kr' ? '내용을 입력하세요...' : 'Write your post...'} className="w-full border border-neutral-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 resize-none" />
        </div>
        <div className="flex gap-3 pt-4">
          <Link href={`/${lang}/menus/${menuSlug}`} className="px-6 py-3 border border-neutral-200 text-neutral-600 text-sm font-semibold hover:bg-neutral-50 transition-colors">
            {lang === 'kr' ? '취소' : 'Cancel'}
          </Link>
          <button type="submit" disabled={submitting} className="px-8 py-3 bg-[#111] text-white text-sm font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-50">
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
