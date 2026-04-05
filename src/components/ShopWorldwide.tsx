'use client';

import { useState } from 'react';
import { ExternalLink, Globe, X } from 'lucide-react';
import Image from 'next/image';

/* ── DATA ───────────────────────────────────────────────────────────────
   Each entry: country code (ISO 3166‑1 alpha‑2), country name, region,
   storeName, storeUrl, and bannerColor accent.
   Flag images from flagcdn.com using country code.
──────────────────────────────────────────────────────────────────────── */
export interface RetailerEntry {
  id: string;           // ISO 3166-1 alpha-2 lowercase
  country: string;
  countryEn: string;
  region: 'ASIA' | 'NORTH AMERICA' | 'SOUTH AMERICA' | 'EUROPE' | 'OCEANIA' | 'MIDDLE EAST' | 'AFRICA' | 'CIS';
  storeName: string;
  storeUrl: string;
  bannerColor: string;
}

export const RETAILERS: RetailerEntry[] = [
  // ── ASIA ──
  { id: 'kr', country: '한국', countryEn: 'South Korea', region: 'ASIA', storeName: 'Kokkok Garden Official', storeUrl: 'https://kokv2.vercel.app/kr', bannerColor: '#4a7ab5' },
  { id: 'jp', country: '日本', countryEn: 'Japan', region: 'ASIA', storeName: 'Kokkok Garden Japan', storeUrl: '#', bannerColor: '#bc002d' },
  { id: 'cn', country: '中国', countryEn: 'China', region: 'ASIA', storeName: 'Kokkok Garden China', storeUrl: '#', bannerColor: '#de2910' },
  { id: 'tw', country: '台灣', countryEn: 'Taiwan', region: 'ASIA', storeName: 'Kokkok Garden Taiwan', storeUrl: '#', bannerColor: '#003070' },
  { id: 'hk', country: '香港', countryEn: 'Hong Kong', region: 'ASIA', storeName: 'Kokkok Garden HK', storeUrl: '#', bannerColor: '#de2910' },
  { id: 'sg', country: 'Singapore', countryEn: 'Singapore', region: 'ASIA', storeName: 'Kokkok Garden SG', storeUrl: '#', bannerColor: '#ef3340' },
  { id: 'my', country: 'Malaysia', countryEn: 'Malaysia', region: 'ASIA', storeName: 'Kokkok Garden Malaysia', storeUrl: '#', bannerColor: '#cc0001' },
  { id: 'th', country: 'ประเทศไทย', countryEn: 'Thailand', region: 'ASIA', storeName: 'Kokkok Garden Thailand', storeUrl: '#', bannerColor: '#2d2a4a' },
  { id: 'vn', country: 'Việt Nam', countryEn: 'Vietnam', region: 'ASIA', storeName: 'Kokkok Garden Vietnam', storeUrl: '#', bannerColor: '#da251d' },
  { id: 'id', country: 'Indonesia', countryEn: 'Indonesia', region: 'ASIA', storeName: 'Kokkok Garden Indonesia', storeUrl: '#', bannerColor: '#ce1126' },
  { id: 'ph', country: 'Philippines', countryEn: 'Philippines', region: 'ASIA', storeName: 'Kokkok Garden Philippines', storeUrl: '#', bannerColor: '#0038a8' },

  // ── NORTH AMERICA ──
  { id: 'us', country: 'United States', countryEn: 'United States', region: 'NORTH AMERICA', storeName: 'Kokkok Garden USA', storeUrl: '#', bannerColor: '#3c3b6e' },
  { id: 'ca', country: 'Canada', countryEn: 'Canada', region: 'NORTH AMERICA', storeName: 'Kokkok Garden Canada', storeUrl: '#', bannerColor: '#ff0000' },
  { id: 'mx', country: 'México', countryEn: 'Mexico', region: 'NORTH AMERICA', storeName: 'Kokkok Garden Mexico', storeUrl: '#', bannerColor: '#006847' },

  // ── EUROPE ──
  { id: 'gb', country: 'United Kingdom', countryEn: 'United Kingdom', region: 'EUROPE', storeName: 'Kokkok Garden UK', storeUrl: '#', bannerColor: '#012169' },
  { id: 'de', country: 'Deutschland', countryEn: 'Germany', region: 'EUROPE', storeName: 'Kokkok Garden Germany', storeUrl: '#', bannerColor: '#2a2a2a' },
  { id: 'fr', country: 'France', countryEn: 'France', region: 'EUROPE', storeName: 'Kokkok Garden France', storeUrl: '#', bannerColor: '#002395' },
  { id: 'it', country: 'Italia', countryEn: 'Italy', region: 'EUROPE', storeName: 'Kokkok Garden Italy', storeUrl: '#', bannerColor: '#009246' },
  { id: 'es', country: 'España', countryEn: 'Spain', region: 'EUROPE', storeName: 'Kokkok Garden Spain', storeUrl: '#', bannerColor: '#aa151b' },
  { id: 'nl', country: 'Nederland', countryEn: 'Netherlands', region: 'EUROPE', storeName: 'Kokkok Garden NL', storeUrl: '#', bannerColor: '#ae1c28' },
  { id: 'pl', country: 'Polska', countryEn: 'Poland', region: 'EUROPE', storeName: 'Kokkok Garden Poland', storeUrl: '#', bannerColor: '#dc143c' },

  // ── MIDDLE EAST ──
  { id: 'ae', country: 'UAE', countryEn: 'UAE', region: 'MIDDLE EAST', storeName: 'Kokkok Garden UAE', storeUrl: '#', bannerColor: '#00732f' },
  { id: 'sa', country: 'Saudi Arabia', countryEn: 'Saudi Arabia', region: 'MIDDLE EAST', storeName: 'Kokkok Garden KSA', storeUrl: '#', bannerColor: '#006c35' },

  // ── OCEANIA ──
  { id: 'au', country: 'Australia', countryEn: 'Australia', region: 'OCEANIA', storeName: 'Kokkok Garden Australia', storeUrl: '#', bannerColor: '#00008b' },
  { id: 'nz', country: 'New Zealand', countryEn: 'New Zealand', region: 'OCEANIA', storeName: 'Kokkok Garden NZ', storeUrl: '#', bannerColor: '#00247d' },

  // ── SOUTH AMERICA ──
  { id: 'br', country: 'Brasil', countryEn: 'Brazil', region: 'SOUTH AMERICA', storeName: 'Kokkok Garden Brazil', storeUrl: '#', bannerColor: '#009c3b' },
  { id: 'cl', country: 'Chile', countryEn: 'Chile', region: 'SOUTH AMERICA', storeName: 'Kokkok Garden Chile', storeUrl: '#', bannerColor: '#d52b1e' },

  // ── CIS ──
  { id: 'ru', country: 'Россия', countryEn: 'Russia', region: 'CIS', storeName: 'Kokkok Garden Russia', storeUrl: '#', bannerColor: '#cc0000' },
  { id: 'kz', country: 'Қазақстан', countryEn: 'Kazakhstan', region: 'CIS', storeName: 'Kokkok Garden Kazakhstan', storeUrl: '#', bannerColor: '#00AFCA' },
];

const REGIONS = ['ALL', 'ASIA', 'NORTH AMERICA', 'SOUTH AMERICA', 'EUROPE', 'OCEANIA', 'MIDDLE EAST', 'AFRICA', 'CIS'] as const;

/** ISO alpha-2 → flagcdn URL */
function flagUrl(id: string, width = 80): string {
  return `https://flagcdn.com/w${width}/${id}.png`;
}

const PAGE_LABELS: Record<string, {
  heroTitle: string; heroSub: string; filterLabel: string; visitStore: string; comingSoon: string;
}> = {
  kr: { heroTitle: '전 세계에서 콕콕가든을 만나보세요', heroSub: '글로벌 파트너와 함께하는 K-뷰티', filterLabel: '지역 선택', visitStore: '스토어 방문', comingSoon: '준비중' },
  en: { heroTitle: 'Shop Kokkok Garden Worldwide', heroSub: 'Available across the globe through our trusted partners', filterLabel: 'Filter by Region', visitStore: 'Visit Store', comingSoon: 'Coming Soon' },
};

interface ShopWorldwideProps { lang: string; }

export default function ShopWorldwide({ lang }: ShopWorldwideProps) {
  const [activeRegion, setActiveRegion] = useState<string>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const labels = PAGE_LABELS[lang] ?? PAGE_LABELS['en'];

  const filtered = activeRegion === 'ALL'
    ? RETAILERS
    : RETAILERS.filter(r => r.region === activeRegion);

  const selectedRetailer = selectedId ? RETAILERS.find(r => r.id === selectedId) : null;

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
            SHOP WORLDWIDE
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4 leading-tight">
            {labels.heroTitle}
          </h1>
          <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto">
            {labels.heroSub}
          </p>
          <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
            {['kr', 'us', 'jp', 'cn', 'gb', 'sg', 'au', 'fr', 'de', 'th', 'vn', 'ae'].map(code => (
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
        </div>
      </div>

      {/* ── Breadcrumb + Filter Tabs ───────────────────────────────────── */}
      <div className="sticky top-[66px] z-30 bg-white border-b border-neutral-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-1 py-1 text-[11px] text-neutral-400 font-semibold mb-2 pt-3">
            <span>HOME</span><span className="mx-1">›</span><span>SHOP WORLDWIDE</span><span className="mx-1">›</span>
            <span className="text-black">{activeRegion}</span>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-3 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {REGIONS.map(r => (
              <button
                key={r}
                onClick={() => { setActiveRegion(r); setSelectedId(null); }}
                className={`flex-none px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider transition-all whitespace-nowrap ${
                  activeRegion === r
                    ? 'bg-black text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                }`}
              >
                {r}
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
              {selectedRetailer.storeUrl === '#' ? (
                <span className="px-6 py-2.5 bg-white/20 text-white text-xs font-bold rounded-full tracking-widest border border-white/30">
                  {labels.comingSoon}
                </span>
              ) : (
                <a
                  href={selectedRetailer.storeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-6 py-2.5 bg-white text-[#111111] text-xs font-black rounded-full tracking-widest hover:bg-neutral-100 transition-colors"
                >
                  {labels.visitStore} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Countries Grid ────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <p className="text-[11px] text-neutral-400 font-semibold tracking-widest mb-8">
          {labels.filterLabel} — <span className="text-black">{filtered.length}</span>
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map(retailer => {
            const isSelected = selectedId === retailer.id;

            return (
              <button
                key={retailer.id}
                onClick={() => setSelectedId(isSelected ? null : retailer.id)}
                className={`relative group rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-lg hover:-translate-y-1 text-left ${
                  isSelected ? 'border-black ring-2 ring-black/20 shadow-lg' : 'border-neutral-100'
                }`}
              >
                {/* Flag banner */}
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

                {/* Card body */}
                <div className="p-4 bg-white">
                  <p className="text-[10px] font-bold tracking-widest text-neutral-400 uppercase mb-0.5">
                    {retailer.countryEn}
                  </p>
                  <p className="text-sm font-bold text-[#111111] leading-snug">{retailer.country}</p>
                  <p className="text-[11px] text-neutral-500 mt-1 leading-tight truncate">{retailer.storeName}</p>
                  {retailer.storeUrl === '#' && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-neutral-100 text-neutral-400 text-[9px] font-bold tracking-widest rounded-full">
                      {labels.comingSoon}
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
          Become a Partner
        </p>
        <h2 className="text-2xl font-black text-[#111111] mb-4">
          {lang === 'kr' ? '파트너십 문의' : 'Want to carry Kokkok Garden?'}
        </h2>
        <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6">
          {lang === 'kr'
            ? '전 세계 파트너 모집 중입니다. 아래 버튼으로 문의해주세요.'
            : 'We are actively seeking new global retail partners. Reach out to us to learn more.'}
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
