'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Palette, RefreshCw, Save, RotateCcw, Eye } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import {
  DEFAULT_THEME_TOKENS,
  parseThemeTokens,
  tokensToCss,
  type ThemeTokens,
} from '@/lib/theme/tokens';
import { FONT_OPTIONS } from '@/lib/typography/options';

// Session-aware client. site_settings writes require admin JWT (Phase 2 RLS).
const supabase = getSupabaseBrowser();

/**
 * /admin/theme — live theme tokens editor.
 *
 * Two-pane layout:
 *   left  → color pickers + radius + font inputs
 *   right → iframe pointing at /kr that receives postMessage updates
 *           on every change, no reload required.
 *
 * Save flow writes the JSON-encoded tokens to the `theme_tokens` row in
 * site_settings. The next public page load picks up the change via
 * getThemeTokens() in [lang]/layout. Other admin tabs already pointed
 * at /kr (the live preview iframe here) update via postMessage on save.
 */
export default function ThemePage() {
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [savedTokens, setSavedTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [previewLang, setPreviewLang] = useState<'kr' | 'en'>('kr');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('no client');
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'theme_tokens')
        .maybeSingle();
      const parsed = parseThemeTokens(data?.value);
      setTokens(parsed);
      setSavedTokens(parsed);
    } catch (err) {
      console.error('[admin/theme] load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // Push live updates to the iframe on every token change. Debounced
  // via rAF to coalesce rapid color-picker drags into one paint.
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        { type: 'kokkok-theme-tokens', css: tokensToCss(tokens) },
        window.location.origin,
      );
    });
    return () => cancelAnimationFrame(handle);
  }, [tokens]);

  const handleSave = async () => {
    if (!supabase) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key: 'theme_tokens', value: JSON.stringify(tokens), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
      setSavedTokens(tokens);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      console.error('[admin/theme] save failed:', err);
      alert(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('기본값으로 되돌리시겠습니까? 저장 전까지는 변경 사항이 반영되지 않습니다.')) return;
    setTokens(DEFAULT_THEME_TOKENS);
  };

  const handleRevert = () => {
    setTokens(savedTokens);
  };

  const isDirty = JSON.stringify(tokens) !== JSON.stringify(savedTokens);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      {/* Editor pane */}
      <aside className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[calc(100vh-180px)]">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-5 h-5 text-gray-500" />
            <h2 className="font-bold text-gray-800">테마 편집</h2>
          </div>
          <p className="text-xs text-gray-500">
            오른쪽 미리보기에 실시간으로 반영됩니다. 저장 전에는 사이트에 적용되지 않습니다.
          </p>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {isLoading ? (
            <div className="text-center text-sm text-gray-400 py-10">불러오는 중...</div>
          ) : (
            <>
              <Section title="브랜드 색상">
                <ColorRow label="잉크 (본문/타이틀)" value={tokens.color_brand_ink}
                  onChange={v => setTokens(t => ({ ...t, color_brand_ink: v }))} />
                <ColorRow label="액센트 (할인 표시)" value={tokens.color_brand_accent}
                  onChange={v => setTokens(t => ({ ...t, color_brand_accent: v }))} />
                <ColorRow label="뮤트 (보조 텍스트)" value={tokens.color_brand_muted}
                  onChange={v => setTokens(t => ({ ...t, color_brand_muted: v }))} />
                <ColorRow label="프라이머리 (긍정/저장)" value={tokens.color_brand_primary}
                  onChange={v => setTokens(t => ({ ...t, color_brand_primary: v }))} />
                <ColorRow label="공지 시작 (그라데이션)" value={tokens.color_brand_notice_from}
                  onChange={v => setTokens(t => ({ ...t, color_brand_notice_from: v }))} />
                <ColorRow label="공지 끝 (그라데이션)" value={tokens.color_brand_notice_to}
                  onChange={v => setTokens(t => ({ ...t, color_brand_notice_to: v }))} />
              </Section>

              <Section title="모양">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">버튼 모서리</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {[
                      { v: '0px', l: '직각' },
                      { v: '6px', l: '약간' },
                      { v: '12px', l: '둥글게' },
                      { v: '9999px', l: '알약' },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setTokens(t => ({ ...t, radius_button: opt.v }))}
                        className={`p-2 text-xs font-semibold border ${
                          tokens.radius_button === opt.v
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                        style={{ borderRadius: opt.v === '9999px' ? '9999px' : opt.v }}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              </Section>

              <Section title="타이포그래피 (선택)">
                <FontRow label="본문 폰트" value={tokens.font_body}
                  onChange={v => setTokens(t => ({ ...t, font_body: v }))} />
                <FontRow label="제목 폰트" value={tokens.font_display}
                  onChange={v => setTokens(t => ({ ...t, font_display: v }))} />
                <p className="text-[10px] text-gray-400">
                  드롭다운에서 사이트가 미리 로드한 8개 폰트 중 하나를 고르거나, &quot;기타 (직접 입력)&quot;를
                  선택해 시스템에 설치된 폰트명 또는 Google Fonts 폰트 패밀리 문자열을 직접 입력할 수 있습니다.
                </p>
              </Section>
            </>
          )}
        </div>

        <div className="border-t border-gray-100 p-4 flex flex-wrap items-center gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider rounded-lg transition ${
              savedFlash
                ? 'bg-green-600 text-white'
                : isDirty
                ? 'bg-[#111] text-white hover:bg-black'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : savedFlash ? '✓ 저장 완료' : isDirty ? '변경 사항 저장' : '저장된 상태'}
          </button>
          <button
            type="button"
            onClick={handleRevert}
            disabled={!isDirty}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold tracking-wider border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
            title="저장된 상태로 되돌리기"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 되돌리기
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold tracking-wider border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
            title="기본값으로 리셋 (저장 안 함)"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 기본값
          </button>
        </div>
      </aside>

      {/* Preview pane */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">실시간 미리보기</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-gray-100 rounded p-0.5 text-[11px] font-bold">
              {(['kr', 'en'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setPreviewLang(l)}
                  className={`px-2.5 py-1 rounded transition ${
                    previewLang === l ? 'bg-white shadow-sm text-black' : 'text-gray-500'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a
              href={`/${previewLang}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-500 hover:text-black underline"
            >
              새 탭
            </a>
          </div>
        </div>
        <div className="flex-1 min-h-[600px] bg-gray-100 relative">
          <iframe
            ref={iframeRef}
            src={`/${previewLang}`}
            className="absolute inset-0 w-full h-full bg-white"
            title="storefront preview"
          />
        </div>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ColorRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-9 h-9 rounded border border-gray-200 cursor-pointer p-0"
          />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-black"
          />
        </div>
      </div>
    </div>
  );
}

function TextRow({
  label, value, placeholder, onChange,
}: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full mt-1 border border-gray-200 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-black"
      />
    </div>
  );
}

/**
 * Font picker for the theme tokens. Stores the CSS font-family string
 * (same shape `font_body` / `font_display` always had) so existing
 * theme_tokens rows keep rendering unchanged, but presents a dropdown
 * of the 8 brand + Google-loaded fonts the rest of the admin uses.
 *
 * "기타 (직접 입력)" reveals the legacy text input so an admin can paste
 * any CSS family stack — handy when previewing a font we haven't added
 * to FONT_OPTIONS yet.
 *
 * Mode is derived from `value`: if the stored string matches any of
 * FONT_OPTIONS[].cssFamily exactly, the dropdown shows that entry;
 * otherwise it falls into "custom" mode and reveals the text field.
 * Switching from custom back to a preset clears the text field.
 */
function FontRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const presetMatch = FONT_OPTIONS.find(f => f.cssFamily === value);
  const isCustom = value.trim() !== '' && !presetMatch;
  const selectValue = value.trim() === '' ? '' : presetMatch ? presetMatch.key : '__custom__';

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <select
        value={selectValue}
        onChange={e => {
          const v = e.target.value;
          if (v === '') onChange('');                // back to brand default
          else if (v === '__custom__') onChange(value || ' ');  // stay in custom (force non-empty so chip shows)
          else {
            const opt = FONT_OPTIONS.find(f => f.key === v);
            if (opt) onChange(opt.cssFamily);
          }
        }}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white outline-none focus:border-black"
      >
        <option value="">기본 (비워둠 — 브랜드 폰트)</option>
        {FONT_OPTIONS.map(f => (
          <option key={f.key} value={f.key}>
            {f.label} — {f.hint}
          </option>
        ))}
        <option value="__custom__">기타 (직접 입력)</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={value}
          placeholder='예: "Helvetica Neue", system-ui, sans-serif'
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-black"
        />
      )}
    </div>
  );
}
