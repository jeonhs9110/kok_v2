'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import { supabase } from '@/lib/api/products';
import { Upload, Loader2 } from 'lucide-react';

const BUCKET = 'product-images';

interface Props {
  content: string;
  onChange: (html: string) => void;
  /** Storage path prefix inside the bucket, e.g. 'product-detail' or 'pages' */
  uploadPath?: string;
  minHeight?: number;
}

async function uploadImage(file: File, path: string): Promise<string> {
  if (!supabase) throw new Error('Supabase 클라이언트가 없습니다.');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
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

export default function RichEditor({ content, onChange, uploadPath = 'editor', minHeight = 280 }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: 'rich-editor-img' } }),
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
            const url = await uploadImage(file, uploadPath);
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
            const url = await uploadImage(file, uploadPath);
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
        const url = await uploadImage(file, uploadPath);
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
          className="px-2.5 py-1.5 text-xs rounded bg-[#111] text-white hover:bg-black transition-colors flex items-center gap-1.5 disabled:opacity-60"
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
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <span className="ml-auto text-[10px] text-gray-400 tracking-wide">붙여넣기 · 드래그로도 이미지 업로드</span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
