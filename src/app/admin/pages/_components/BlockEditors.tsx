'use client';

import type { PageBlock } from '@/lib/pages/blocks';
import HeroBlockEditor from './BlockEditors/HeroBlockEditor';
import TextBlockEditor from './BlockEditors/TextBlockEditor';
import ImageBlockEditor from './BlockEditors/ImageBlockEditor';
import CtaBlockEditor from './BlockEditors/CtaBlockEditor';
import EmbedBlockEditor from './BlockEditors/EmbedBlockEditor';

/**
 * Dispatcher + summarize() for the section-based page builder. The 5
 * per-type editors live under ./BlockEditors/ so each block type can
 * grow its own controls without bloating any single file. Imports from
 * this barrel keep the previous public API (BlockEditor + summarize)
 * unchanged for PageBlocksEditor.
 */
export function BlockEditor({
  block,
  onChange,
}: {
  block: PageBlock;
  onChange: (next: PageBlock) => void;
}) {
  switch (block.type) {
    case 'hero':
      return <HeroBlockEditor block={block} onChange={onChange} />;
    case 'text':
      return <TextBlockEditor block={block} onChange={onChange} />;
    case 'image':
      return <ImageBlockEditor block={block} onChange={onChange} />;
    case 'cta':
      return <CtaBlockEditor block={block} onChange={onChange} />;
    case 'embed':
      return <EmbedBlockEditor block={block} onChange={onChange} />;
  }
}

/** Short summary string for the collapsed-block header row. */
export function summarize(block: PageBlock): string {
  switch (block.type) {
    case 'hero':
      return block.title || block.subtitle || '(빈 히어로)';
    case 'text':
      return block.html.replace(/<[^>]+>/g, '').slice(0, 60) || '(빈 텍스트)';
    case 'image':
      return block.image_url ? `🖼 ${block.image_url.split('/').pop()}` : '(이미지 없음)';
    case 'cta':
      return block.label ? `→ ${block.label}` : '(빈 버튼)';
    case 'embed':
      return block.url || '(빈 임베드)';
  }
}
