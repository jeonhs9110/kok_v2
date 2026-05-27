'use client';

import { useEffect, useState } from 'react';
import { List, MessageSquare } from 'lucide-react';
import { supabase } from '@/lib/api/products';
import {
  LABEL_KEYS,
  DEFAULT_RETAILERS,
  type WorldwideLabels,
} from '@/lib/worldwide/defaults';
import LabelsEditor from './_components/LabelsEditor';
import RetailersEditor from './_components/RetailersEditor';
import { buildDefaultLabelRow, type LabelRow, type RetailerRow } from './_lib';

/**
 * admin/worldwide — split into 3 files to match the admin/products pattern.
 *
 * This page handles initial data loading + tab switching. Each tab's editor
 * owns its own state and persistence handlers, scoped to its own file:
 *   - _components/LabelsEditor.tsx  — i18n label rows + per-row save
 *   - _components/RetailersEditor.tsx — country/vendor CRUD + uploads
 *   - _lib.ts — shared types + Supabase asset upload helper
 *
 * Loading both datasets up front (rather than per-tab on mount) preserves the
 * original UX: a single "로딩 중..." spinner before either tab is interactive.
 */

function defaultRetailerRows(): RetailerRow[] {
  return DEFAULT_RETAILERS.map((r, i) => ({
    id: null,
    country_code: r.countryCode,
    country_native: r.country,
    country_en: r.countryEn,
    region: r.region,
    store_name: r.storeName,
    store_url: r.storeUrl,
    store_logo_url: '',
    country_image_url: '',
    banner_color: r.bannerColor,
    is_active: true,
    sort_order: (i + 1) * 10,
  }));
}

export default function WorldwideAdminPage() {
  const [tab, setTab] = useState<'labels' | 'retailers'>('labels');
  const [labels, setLabels] = useState<LabelRow[]>([]);
  const [retailers, setRetailers] = useState<RetailerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const defaultLabels = LABEL_KEYS.map(k => buildDefaultLabelRow(k));

      if (!supabase) {
        if (cancelled) return;
        setLabels(defaultLabels);
        setRetailers(defaultRetailerRows());
        setLoading(false);
        return;
      }

      try {
        const [lRes, rRes] = await Promise.all([
          supabase.from('worldwide_labels').select('*'),
          supabase.from('worldwide_retailers').select('*').order('sort_order'),
        ]);
        if (cancelled) return;

        const byKey = new Map<string, LabelRow>(
          (lRes.data as LabelRow[] | null)?.map(r => [r.label_key, r]) ?? [],
        );
        setLabels(
          LABEL_KEYS.map(k => byKey.get(k) ?? buildDefaultLabelRow(k as keyof WorldwideLabels)),
        );
        setRetailers(
          rRes.data && rRes.data.length > 0
            ? (rRes.data as RetailerRow[])
            : defaultRetailerRows(),
        );
      } catch {
        if (cancelled) return;
        setLabels(defaultLabels);
        setRetailers(defaultRetailerRows());
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab('labels')}
          className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            tab === 'labels'
              ? 'border-black text-black'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          페이지 문구 (다국어)
        </button>
        <button
          onClick={() => setTab('retailers')}
          className={`px-5 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
            tab === 'retailers'
              ? 'border-black text-black'
              : 'border-transparent text-gray-400 hover:text-gray-600'
          }`}
        >
          <List className="w-4 h-4" />
          판매처 ({retailers.length}개 벤더)
        </button>
      </div>

      {tab === 'labels' && <LabelsEditor initialLabels={labels} />}
      {tab === 'retailers' && <RetailersEditor initialRetailers={retailers} />}
    </div>
  );
}
