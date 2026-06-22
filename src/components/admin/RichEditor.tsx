'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';

// Session-aware client. Phase 5 storage RLS requires the admin JWT
// for the inline image uploads triggered by paste/drop in this editor.
const supabase = getSupabaseBrowser();
import { Upload, Loader2, Video as VideoIcon, Code2 } from 'lucide-react';

const BUCKET = 'product-images';

// Custom Video node so <video> tags survive a round-trip through the editor.
const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
    };
  },
  parseHTML() {
    return [{ tag: 'video' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        style: 'max-width: 100%; display: block; margin: 1.5rem auto; border-radius: 4px;',
      }),
    ];
  },
});

// Iframe node for YouTube / Vimeo embeds.
const IframeNode = Node.create({
  name: 'iframe',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      src: { default: null },
      frameborder: { default: '0' },
      allowfullscreen: { default: true },
      width: { default: '100%' },
      height: { default: '480' },
    };
  },
  parseHTML() {
    return [{ tag: 'iframe' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'iframe',
      mergeAttributes(HTMLAttributes, {
        style: 'max-width: 100%; aspect-ratio: 16 / 9; display: block; margin: 1.5rem auto; border: 0;',
        allowfullscreen: 'true',
      }),
    ];
  },
});

interface Props {
  content: string;
  onChange: (html: string) => void;
  /** Storage path prefix inside the bucket, e.g. 'product-detail' or 'pages' */
  uploadPath?: string;
  minHeight?: number;
}

async function uploadFile(file: File, path: string): Promise<string> {
  if (USE_S3_FROM_BROWSER) {
    const { publicUrl } = await uploadFileToS3(file, {
      keyPrefix: path,
      contentType: file.type,
    });
    return publicUrl;
  }
  if (!supabase) throw new Error('Supabase 클라이언트가 없습니다.');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const fileName = `${path}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

/** Convert a YouTube/Vimeo/Shorts URL into an embeddable iframe URL. Returns null if unrecognized. */
function toEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    // YouTube watch / youtu.be / shorts
    if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
      let id = '';
      if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
      else if (url.pathname.startsWith('/shorts/')) id = url.pathname.split('/')[2];
      else id = url.searchParams.get('v') ?? '';
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    // Vimeo
    if (url.hostname.includes('vimeo.com')) {
      const id = url.pathname.split('/').filter(Boolean)[0];
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
    // Already an embed URL
    if (url.pathname.includes('/embed/') || url.hostname.includes('player.')) return raw;
  } catch {}
  return null;
}

export default function RichEditor({ content, onChange, uploadPath = 'editor', minHeight = 280 }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: 'rich-editor-img' } }),
      VideoNode,
      IframeNode,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'detail-body max-w-none focus:outline-none px-4 py-3',
        style: `min-height: ${minHeight}px`,
      },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files ?? []).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach(async file => {
          try {
            setUploading(true);
            const url = await uploadFile(file, uploadPath);
            editor?.chain().focus().setImage({ src: url }).run();
          } catch (err) {
            console.error(err);
            alert('이미지 업로드에 실패했습니다.');
          } finally {
            setUploading(false);
          }
        });
        return true;
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter(f => f.type.startsWith('image/'));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach(async file => {
          try {
            setUploading(true);
            const url = await uploadFile(file, uploadPath);
            editor?.chain().focus().setImage({ src: url }).run();
          } catch (err) {
            console.error(err);
            alert('이미지 업로드에 실패했습니다.');
          } finally {
            setUploading(false);
          }
        });
        return true;
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  async function handleFiles(files: FileList | null) {
    if (!editor || !files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        const url = await uploadFile(file, uploadPath);
        editor.chain().focus().setImage({ src: url }).run();
      }
    } catch (err) {
      console.error(err);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleVideoFiles(files: FileList | null) {
    if (!editor || !files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('video/')) continue;
        const url = await uploadFile(file, uploadPath);
        editor.chain().focus().insertContent({ type: 'video', attrs: { src: url } }).run();
      }
    } catch (err) {
      console.error(err);
      alert('동영상 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  }

  function promptEmbedUrl() {
    if (!editor) return;
    const raw = window.prompt('YouTube / Vimeo URL을 붙여넣으세요');
    if (!raw) return;
    const embed = toEmbedUrl(raw);
    if (!embed) {
      alert('YouTube 또는 Vimeo 링크만 지원합니다.');
      return;
    }
    editor.chain().focus().insertContent({ type: 'iframe', attrs: { src: embed } }).run();
  }

  function promptRawHtml() {
    if (!editor) return;
    const html = window.prompt('HTML 코드를 붙여넣으세요 (예: <iframe>, <div>, <span> 등)');
    if (!html) return;
    editor.chain().focus().insertContent(html).run();
  }

  if (!editor) return null;

  const btn = (active: boolean) =>
    `px-2.5 py-1.5 text-xs rounded transition-colors ${
      active ? 'bg-black text-white' : 'hover:bg-gray-200 text-gray-700'
    }`;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-100 bg-gray-50">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`${btn(editor.isActive('bold'))} font-bold`}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`${btn(editor.isActive('italic'))} italic`}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`${btn(editor.isActive('strike'))} line-through`}>S</button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`${btn(editor.isActive('heading', { level: 2 }))} font-bold`}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`${btn(editor.isActive('heading', { level: 3 }))} font-bold`}>H3</button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btn(editor.isActive('bulletList'))}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btn(editor.isActive('orderedList'))}>1. List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btn(editor.isActive('blockquote'))}>&ldquo;</button>
        <div className="w-px h-5 bg-gray-200 mx-1" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-2.5 py-1.5 text-xs rounded bg-brand-ink text-white hover:bg-black transition-colors flex items-center gap-1.5 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
          {uploading ? '업로드 중...' : '이미지 업로드'}
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('이미지 URL을 입력하세요:');
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
          className={btn(false)}
        >
          URL
        </button>
        <button
          type="button"
          onClick={() => {
            const url = window.prompt('링크 URL:');
            if (url) editor.chain().focus().setLink({ href: url }).run();
            else editor.chain().focus().unsetLink().run();
          }}
          className={btn(editor.isActive('link'))}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          disabled={uploading}
          className="px-2.5 py-1.5 text-xs rounded bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors flex items-center gap-1.5 disabled:opacity-60"
          title="동영상 파일 업로드 (MP4 등)"
        >
          <VideoIcon className="w-3 h-3" />
          동영상
        </button>
        <button
          type="button"
          onClick={promptEmbedUrl}
          className={btn(false)}
          title="YouTube / Vimeo 링크 삽입"
        >
          YouTube
        </button>
        <button
          type="button"
          onClick={promptRawHtml}
          className="px-2.5 py-1.5 text-xs rounded bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 transition-colors flex items-center gap-1.5"
          title="HTML 코드 직접 삽입"
        >
          <Code2 className="w-3 h-3" />
          HTML
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={e => handleVideoFiles(e.target.files)}
        />
        <span className="ml-auto text-[10px] text-gray-400 tracking-wide">붙여넣기 · 드래그로도 이미지 업로드</span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
