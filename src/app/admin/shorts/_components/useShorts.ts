import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { USE_RDS_FROM_BROWSER } from '@/lib/admin/rdsFlag';
import type { SectionBgValue } from '@/components/admin/SectionBackgroundPanel';

const supabase = getSupabaseBrowser();
const EMPTY_BG: SectionBgValue = { type: null, color: null, mediaUrl: null, mediaType: null };

export interface Short {
  id: string;
  youtubeId: string;
  productId: string | null;
  productName: string | null;
  addedAt: string;
}

export interface Product {
  id: string;
  name: string;
}

/**
 * Three-channel hook for /admin/shorts: the shorts list + product
 * reference data + the shorts_config singleton (section bg + header
 * style from migrations 26 and 33). Add / delete / link-to-product /
 * config save all in one place.
 *
 * shorts_config bg + header columns share a single row so saves use
 * the same id-eq update path; an insert with id capture is the fallback
 * for fresh installs where the seed row never landed.
 */
export function useShorts() {
  const toast = useToast();
  const [shorts, setShorts] = useState<Short[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  // Section background (migration 26).
  const [bgConfigId, setBgConfigId] = useState<string | null>(null);
  const [bg, setBg] = useState<SectionBgValue>(EMPTY_BG);
  const [savingBg, setSavingBg] = useState(false);
  const [bgSaved, setBgSaved] = useState(false);
  // Migration 33 — admin-editable section title + style.
  const [headerText, setHeaderText] = useState('');
  const [headerFontSize, setHeaderFontSize] = useState('15');
  const [headerTextColor, setHeaderTextColor] = useState('#ffffff');
  const [headerBgEnabled, setHeaderBgEnabled] = useState(false);
  const [headerBgColor, setHeaderBgColor] = useState('#000000');
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerSaved, setHeaderSaved] = useState(false);

  useEffect(() => {
    fetchShorts();
    fetchProducts();
    fetchBg();
    // Mount-only fetch — the three fetchers are stable closures over the
    // module-level supabase client; listing them in deps would re-fetch
    // on every render with no behavior change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After products[] arrives, patch productName onto any shorts that came
  // back from the generic admin route without it. Pre-cutover the
  // Supabase `select('...products(name)')` join did this server-side;
  // the RDS list endpoint is per-table so the resolution happens here.
  // Falls through cheaply when nothing changes.
  useEffect(() => {
    if (products.length === 0) return;
    const nameById = new Map(products.map(p => [p.id, p.name]));
    setShorts(prev => {
      let mutated = false;
      const next = prev.map(s => {
        if (!s.productId) return s;
        const resolved = nameById.get(s.productId) ?? s.productName;
        if (resolved !== s.productName) {
          mutated = true;
          return { ...s, productName: resolved };
        }
        return s;
      });
      return mutated ? next : prev;
    });
  }, [products]);

  async function fetchBg() {
    let data: Record<string, unknown> | null = null;
    if (USE_RDS_FROM_BROWSER) {
      const res = await fetch('/api/admin/shorts-config', { cache: 'no-store' });
      if (res.ok) {
        const body = await res.json() as { row: Record<string, unknown> | null };
        data = body.row;
      }
    } else if (supabase) {
      const r = await supabase
        .from('shorts_config')
        .select('id, bg_type, bg_color, bg_media_url, bg_media_type, header_text, header_font_size, header_text_color, header_bg_color')
        .limit(1).maybeSingle();
      data = (r.data as Record<string, unknown> | null) ?? null;
    }
    if (data) {
      setBgConfigId(data.id as string);
      setBg({
        type: (data.bg_type as 'color' | 'image' | 'video' | null) ?? null,
        color: (data.bg_color as string | null) ?? null,
        mediaUrl: (data.bg_media_url as string | null) ?? null,
        mediaType: (data.bg_media_type as 'image' | 'video' | null) ?? null,
      });
      setHeaderText((data.header_text as string | null) ?? '');
      setHeaderFontSize(String(parseInt((data.header_font_size as string | null) ?? '15', 10) || 15));
      setHeaderTextColor((data.header_text_color as string | null) ?? '#ffffff');
      setHeaderBgEnabled(!!data.header_bg_color);
      setHeaderBgColor((data.header_bg_color as string | null) ?? '#000000');
    }
  }

  async function saveShortsConfig(
    payload: Record<string, unknown>,
    onSuccess: () => void,
    onError: (err: unknown) => void,
  ) {
    try {
      if (USE_RDS_FROM_BROWSER) {
        // The PUT route is upsert-aware: no need to thread bgConfigId
        // from the client. The route looks up the singleton row id
        // server-side then dispatches insert vs update accordingly.
        const res = await fetch('/api/admin/shorts-config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
      } else {
        if (!supabase) throw new Error('no client');
        if (bgConfigId) {
          const { error } = await supabase.from('shorts_config').update(payload).eq('id', bgConfigId);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('shorts_config').insert([payload]).select('id').single();
          if (error) throw error;
          setBgConfigId(data.id);
        }
      }
      revalidateHomepageData('shorts');
      onSuccess();
    } catch (err) {
      onError(err);
    }
  }

  async function saveHeader() {
    setSavingHeader(true);
    const size = Math.max(10, Math.min(48, parseInt(headerFontSize, 10) || 15));
    const payload = {
      header_text: headerText.trim() || null,
      header_font_size: `${size}px`,
      header_text_color: headerTextColor || null,
      header_bg_color: headerBgEnabled ? headerBgColor : null,
    };
    await saveShortsConfig(
      payload,
      () => {
        setHeaderSaved(true);
        setTimeout(() => setHeaderSaved(false), 2000);
      },
      (err) => {
        console.error('[admin/shorts] header save failed:', err);
        toast.show('제목 스타일 저장에 실패했습니다.', 'error');
      },
    );
    setSavingHeader(false);
  }

  async function saveBg() {
    setSavingBg(true);
    const payload = {
      bg_type: bg.type,
      bg_color: bg.color,
      bg_media_url: bg.mediaUrl,
      bg_media_type: bg.mediaType,
    };
    await saveShortsConfig(
      payload,
      () => {
        setBgSaved(true);
        setTimeout(() => setBgSaved(false), 2000);
      },
      (err) => {
        console.error('[admin/shorts] bg save failed:', err);
        toast.show('배경 저장에 실패했습니다.', 'error');
      },
    );
    setSavingBg(false);
  }

  // 2026-06-29: both reads dispatched via /api/admin/* — pre-fix they
  // hit Supabase unconditionally, so /admin/shorts has been showing the
  // frozen 2026-06-27 list (no shorts added since cutover appeared, no
  // products added since populated the link dropdown). Adds via the
  // POST already write to RDS, but the next reload pulled the old
  // Supabase rows back into the UI — operator sees their saves vanish
  // even though the storefront actually renders them.
  async function fetchProducts() {
    try {
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch('/api/admin/products', { cache: 'no-store' });
        if (!res.ok) return;
        // /api/admin/products GET returns the full row set (admin view —
        // includes inactive). The pre-RDS Supabase query filtered with
        // `.eq('is_active', true)` so the "link product" dropdown only
        // surfaced shoppable products. Without that filter (introduced
        // by PR #314 — admin sweep r6), inactive/discontinued products
        // would show up in the dropdown and an operator could link a
        // short to a product the storefront won't render. Filter client-
        // side to restore the original behavior.
        const { rows } = await res.json() as { rows: Array<{ id: string; name: string; is_active: boolean }> };
        const sorted = (rows ?? [])
          .filter(r => r.is_active)
          .map(r => ({ id: r.id, name: r.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setProducts(sorted);
        return;
      }
      if (!supabase) return;
      const { data } = await supabase.from('products').select('id, name').eq('is_active', true).order('name');
      if (data) setProducts(data);
    } catch (err) {
      console.error('[admin/shorts] product list fetch failed:', err);
    }
  }

  async function fetchShorts() {
    try {
      type ShortsRow = {
        id: string;
        youtube_id: string;
        product_id: string | null;
        created_at: string;
        products?: { name: string } | null;
      };
      let rows: ShortsRow[] = [];
      if (USE_RDS_FROM_BROWSER) {
        // The generic RDS list endpoint doesn't join — product names get
        // resolved client-side from the `products` state (loaded in
        // parallel by fetchProducts). For the brief race window before
        // products lands we set productName to null and a re-render
        // patches it in once setProducts fires.
        const res = await fetch('/api/admin/shorts', { cache: 'no-store' });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const body = await res.json() as { rows: ShortsRow[] };
        rows = body.rows ?? [];
      } else {
        if (!supabase) throw new Error('Supabase 클라이언트 없음');
        const { data, error } = await supabase
          .from('shorts')
          .select('id, youtube_id, product_id, created_at, products(name)')
          .order('created_at', { ascending: false });
        if (error) throw error;
        rows = (data ?? []) as unknown as ShortsRow[];
      }
      setShorts(prev => {
        // Build a name map from both the freshly-set products list and
        // the joined .products field (when present in the Supabase path).
        // Keeping the prev productName as a final fallback handles the
        // race where products[] arrives after this call but the row's
        // productId hasn't changed.
        const nameById = new Map<string, string>();
        for (const p of products) nameById.set(p.id, p.name);
        const prevById = new Map(prev.map(s => [s.id, s.productName]));
        return rows.map(d => {
          const productName = d.products?.name
            ?? (d.product_id ? nameById.get(d.product_id) : null)
            ?? prevById.get(d.id)
            ?? null;
          return {
            id: d.id,
            youtubeId: d.youtube_id,
            productId: d.product_id || null,
            productName,
            addedAt: new Date(d.created_at).toISOString().split('T')[0],
          };
        });
      });
    } catch (err) {
      // Previously fell back to 4 hardcoded demo YouTube IDs which masked
      // real DB failures. Now surface the failure to the operator instead.
      console.error('[admin/shorts] DB fetch failed:', err);
      setShorts([]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newUrl) return;

    const match = newUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|shorts\/)([^"&?\/\s]{11})/);
    const videoId = match ? match[1] : (newUrl.length === 11 ? newUrl : null);

    if (videoId) {
      const tempId = Date.now().toString();
      setShorts(prev => [{ id: tempId, youtubeId: videoId, productId: null, productName: null, addedAt: new Date().toISOString().split('T')[0] }, ...prev]);
      setNewUrl('');
      try {
        if (USE_RDS_FROM_BROWSER) {
          const res = await fetch('/api/admin/shorts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ youtube_id: videoId }),
          });
          if (res.ok) {
            toast.show(`YouTube ID '${videoId}' 추가됨`, 'success');
            fetchShorts();
            revalidateHomepageData('shorts');
          }
        } else {
          if (!supabase) throw new Error('클라이언트 없음');
          const { error } = await supabase.from('shorts').insert([{ youtube_id: videoId }]);
          if (!error) {
            toast.show(`YouTube ID '${videoId}' 추가됨`, 'success');
            fetchShorts();
            revalidateHomepageData('shorts');
          }
        }
      } catch { /* mock mode */ }
    } else {
      toast.show('유효하지 않은 YouTube URL 또는 ID입니다.', 'warning');
    }
  };

  const handleDelete = async (id: string) => {
    setShorts(prev => prev.filter(s => s.id !== id));
    try {
      if (USE_RDS_FROM_BROWSER) {
        await fetch(`/api/admin/shorts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      } else if (supabase) {
        await supabase.from('shorts').delete().eq('id', id);
      }
      revalidateHomepageData('shorts');
    } catch { /* ignore */ }
  };

  const handleLinkProduct = async (shortId: string, productId: string | null) => {
    setLinkingId(shortId);
    try {
      if (USE_RDS_FROM_BROWSER) {
        await fetch(`/api/admin/shorts?id=${encodeURIComponent(shortId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: productId || null }),
        });
      } else if (supabase) {
        await supabase.from('shorts').update({ product_id: productId || null }).eq('id', shortId);
      }
      const prod = products.find(p => p.id === productId);
      setShorts(prev => prev.map(s => s.id === shortId ? { ...s, productId: productId, productName: prod?.name || null } : s));
      revalidateHomepageData('shorts');
    } catch { /* ignore */ }
    finally { setLinkingId(null); }
  };

  return {
    shorts, products,
    newUrl, setNewUrl,
    isLoading, linkingId,
    bg, setBg, savingBg, bgSaved, saveBg,
    headerText, setHeaderText,
    headerFontSize, setHeaderFontSize,
    headerTextColor, setHeaderTextColor,
    headerBgEnabled, setHeaderBgEnabled,
    headerBgColor, setHeaderBgColor,
    savingHeader, headerSaved, saveHeader,
    handleAdd, handleDelete, handleLinkProduct,
  };
}
