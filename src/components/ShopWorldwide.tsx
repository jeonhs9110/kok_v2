'use client';

import { useState } from 'react';
import { ExternalLink, Globe, X } from 'lucide-react';
import Image from 'next/image';
import {
  REGION_ORDER,
  REGION_LABEL_KEY,
  type RetailerEntry,
  type WorldwideLabels,
} from '@/lib/worldwide/defaults';

function flagUrl(id: string, width = 80): string {
  return `https://flagcdn.com/w${width}/${id}.png`;
}

interface ShopWorldwideProps {
  lang: string;
  labels: WorldwideLabels;
  retailers: RetailerEntry[];
}

type FilterValue = 'ALL' | (typeof REGION_ORDER)[number];

export default function ShopWorldwide({ lang: _lang, labels, retailers }: ShopWorldwideProps) {
  const [activeRegion, setActiveRegion] = useState<FilterValue>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const regionsPresent = Array.from(new Set(retailers.map(r => r.region)));
  const regionsFilter: FilterValue[] = [
    'ALL',
    ...REGION_ORDER.filter(r => regionsPresent.includes(r)),
  ];

  const filtered = activeRegion === 'ALL'
    ? retailers
    : retailers.filter(r => r.region === activeRegion);

  const selectedRetailer = selectedId ? retailers.find(r => r.id === selectedId) : null;

  const regionLabel = (region: FilterValue): string => {
    if (region === 'ALL') return labels.region_all;
    const key = REGION_LABEL_KEY[region];
    return (labels as unknown as Record<string, string>)[key] ?? region;
  };

  const flagCodes = ['kr', 'us', 'jp', 'cn', 'gb', 'sg', 'au', 'fr', 'de', 'th', 'vn', 'ae']
    .filter(code => retailers.some(r => r.id === code));

  return (
    <div className="min-h-screen bg-white">
      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative bg-[#111111] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <svg viewBox="0 0 800 400" className="w-full h-full" aria-hidden="true">
            {Array.from({ length: 10 }).map((_, i) => (
              <ellipse key={i} cx="400" cy="200" rx={40 + i * 35} ry={40 + i * 16} fill="none" stroke="white" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={i} x1="400" y1="0" x2={400 + 300 * Math.cos((i * Math.PI) / 6)} y2={200 + 200 * Math.sin((i * Math.PI) / 6)} stroke="white" strokeWidth="0.5" />
            ))}
          </svg>
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 mb-6 text-xs font-semibold tracking-widest border border-white/20">
            <Globe className="w-3.5 h-3.5" />
            {labels.hero_badge}
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
            {labels.hero_title}
          </h1>
          <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto">
            {labels.hero_sub}
          </p>
          {flagCodes.length > 0 && (
            <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
              {flagCodes.map(code => (
                <Image
                  key={code}
                  src={flagUrl(code, 40)}
                  alt={code}
                  width={32}
                  height={22}
                  className="rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                  unoptimized
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Breadcrumb + Filter Tabs ───────────────────────────────────── */}
      <div className="sticky top-[66px] z-30 bg-white border-b border-neutral-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-1 py-1 text-[11px] text-neutral-400 font-semibold mb-2 pt-3">
            <span>{labels.breadcrumb_home}</span><span className="mx-1">›</span>
            <span>{labels.breadcrumb_worldwide}</span><span className="mx-1">›</span>
            <span className="text-black">{regionLabel(activeRegion)}</span>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-3 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {regionsFilter.map(r => (
              <button
                key={r}
                onClick={() => { setActiveRegion(r); setSelectedId(null); }}
                className={`flex-none px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider transition-all whitespace-nowrap ${
                  activeRegion === r
                    ? 'bg-black text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {regionLabel(r)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Store Banner (shown when a country is selected) ──────────── */}
      {selectedRetailer && (
        <div
          className="border-b border-neutral-200 animate-in slide-in-from-top-2 duration-200"
          style={{ backgroundColor: selectedRetailer.bannerColor }}
        >
          <div className="max-w-6xl mx-auto px-6 py-8 flex items-center gap-6 relative">
            <button
              onClick={() => setSelectedId(null)}
              className="absolute top-4 right-6 text-white/70 hover:text-white transition-colors"
              aria-label="Close banner"
            >
              <X className="w-5 h-5" />
            </button>
            <Image
              src={flagUrl(selectedRetailer.id, 160)}
              alt={selectedRetailer.countryEn}
              width={80}
              height={54}
              className="rounded-lg shadow-lg border-2 border-white/30"
              unoptimized
            />
            <div className="text-white flex-1">
              <p className="text-[11px] font-bold tracking-widest uppercase opacity-70 mb-1">{selectedRetailer.countryEn}</p>
              <h3 className="text-2xl font-black mb-1">{selectedRetailer.country}</h3>
              <p className="text-sm opacity-80">{selectedRetailer.storeName}</p>
            </div>
            <div>
              {selectedRetailer.storeUrl === '#' || !selectedRetailer.storeUrl ? (
                <span className="px-6 py-2.5 bg-white/20 text-white text-xs font-bold rounded-full tracking-widest border border-white/30">
                  {labels.coming_soon}
                </span>
              ) : (
                <a
                  href={selectedRetailer.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-[#111111] text-xs font-black rounded-full tracking-widest hover:bg-neutral-100 transition-colors"
                >
                  {labels.visit_store} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Countries Grid ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-[11px] text-neutral-400 font-semibold tracking-widest mb-8">
          {labels.filter_label} — <span className="text-black">{filtered.length}</span>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(retailer => {
            const isSelected = selectedId === retailer.id;
            const isPending = !retailer.storeUrl || retailer.storeUrl === '#';

            return (
              <button
                key={retailer.id}
                onClick={() => setSelectedId(isSelected ? null : retailer.id)}
                className={`relative group rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 text-left ${
                  isSelected ? 'border-black ring-2 ring-black/20 shadow-lg' : 'border-neutral-100'
                }`}
              >
                <div
                  className="h-20 flex items-center justify-center transition-all duration-300"
                  style={{ backgroundColor: retailer.bannerColor, opacity: isSelected ? 1 : 0.85 }}
                >
                  <Image
                    src={flagUrl(retailer.id, 160)}
                    alt={retailer.countryEn}
                    width={64}
                    height={43}
                    className="rounded shadow-md border border-white/20 group-hover:scale-110 transition-transform duration-300"
                    unoptimized
                  />
                </div>
                <div className="p-4 bg-white">
                  <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase mb-0.5">
                    {retailer.countryEn}
                  </p>
                  <p className="text-sm font-bold text-[#111111] leading-snug">{retailer.country}</p>
                  <p className="text-[11px] text-neutral-500 mt-1 leading-tight truncate">{retailer.storeName}</p>
                  {isPending && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-neutral-100 text-neutral-400 text-[9px] font-bold tracking-widest rounded-full">
                      {labels.coming_soon}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── B2B Footer CTA ───────────────────────────────────────────── */}
      <div className="bg-neutral-50 border-t border-neutral-100 py-16 text-center mt-8">
        <p className="text-[11px] font-bold tracking-widest text-neutral-400 uppercase mb-3">
          {labels.partner_badge}
        </p>
        <h2 className="text-2xl font-black text-[#111111] mb-4">
          {labels.partner_title}
        </h2>
        <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6">
          {labels.partner_body}
        </p>
        <a
          href="mailto:global@kokkok.garden"
          className="inline-flex items-center gap-2 bg-[#111111] text-white px-8 py-3 text-xs font-bold tracking-widest hover:bg-black transition-colors rounded-none"
        >
          global@kokkok.garden
        </a>
      </div>
    </div>
  );
}
