'use client';

import { Package, Video, RefreshCw, Globe, Eye, Heart, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/api/products';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalShorts: number;
  totalVisits: number;
  isLive: boolean;
}

interface CountryStat {
  country: string;
  count: number;
}

interface ProductClick {
  id: string;
  name: string;
  clicks: number;
}

interface WishRank {
  id: string;
  name: string;
  wishCount: number;
}

type SortDir = 'asc' | 'desc';

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0, activeProducts: 0, totalShorts: 0, totalVisits: 0, isLive: false,
  });
  const [countries, setCountries] = useState<CountryStat[]>([]);
  const [productClicks, setProductClicks] = useState<ProductClick[]>([]);
  const [wishRanks, setWishRanks] = useState<WishRank[]>([]);
  const [clickSort, setClickSort] = useState<SortDir>('desc');
  const [isLoading, setIsLoading] = useState(true);

  async function fetchStats() {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('No client');

      const [productsRes, activeRes, shortsRes, visitsRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('shorts').select('id', { count: 'exact', head: true }),
        supabase.from('analytics').select('id', { count: 'exact', head: true }),
      ]);

      if (productsRes.error && activeRes.error) throw new Error('DB error');

      // Fetch all analytics + products + wishlist in parallel
      const [analyticsRes, allProductsRes, wishlistRes] = await Promise.all([
        supabase.from('analytics').select('country, path'),
        supabase.from('products').select('id, name'),
        supabase.from('wishlist').select('product_id'),
      ]);

      // Country breakdown
      const countryMap: Record<string, number> = {};
      const productClickMap: Record<string, number> = {};
      if (analyticsRes.data) {
        for (const row of analyticsRes.data) {
          countryMap[row.country || 'UNKNOWN'] = (countryMap[row.country || 'UNKNOWN'] || 0) + 1;
          // Count product detail page views: /kr/xx/products/ID or /gl/xx/products/ID
          const match = row.path?.match(/\/products\/([^/]+)$/);
          if (match) {
            productClickMap[match[1]] = (productClickMap[match[1]] || 0) + 1;
          }
        }
      }

      setCountries(
        Object.entries(countryMap)
          .map(([country, count]) => ({ country, count }))
          .sort((a, b) => b.count - a.count)
      );

      // Product clicks with names
      const productNameMap: Record<string, string> = {};
      if (allProductsRes.data) {
        for (const p of allProductsRes.data) productNameMap[p.id] = p.name;
      }

      const clicks: ProductClick[] = Object.entries(productClickMap)
        .filter(([id]) => productNameMap[id])
        .map(([id, clicks]) => ({ id, name: productNameMap[id], clicks }));
      // Also add products with 0 clicks
      if (allProductsRes.data) {
        for (const p of allProductsRes.data) {
          if (!productClickMap[p.id]) clicks.push({ id: p.id, name: p.name, clicks: 0 });
        }
      }
      setProductClicks(clicks);

      // Wishlist ranking
      const wishMap: Record<string, number> = {};
      if (wishlistRes.data) {
        for (const w of wishlistRes.data) {
          wishMap[w.product_id] = (wishMap[w.product_id] || 0) + 1;
        }
      }
      setWishRanks(
        Object.entries(wishMap)
          .filter(([id]) => productNameMap[id])
          .map(([id, wishCount]) => ({ id, name: productNameMap[id], wishCount }))
          .sort((a, b) => b.wishCount - a.wishCount)
      );

      setStats({
        totalProducts: productsRes.count ?? 0,
        activeProducts: activeRes.count ?? 0,
        totalShorts: shortsRes.count ?? 0,
        totalVisits: visitsRes.count ?? 0,
        isLive: true,
      });
    } catch {
      setStats({ totalProducts: 0, activeProducts: 0, totalShorts: 0, totalVisits: 0, isLive: false });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { fetchStats(); }, []);

  const COUNTRY_NAMES: Record<string, string> = {
    KR: '한국', US: '미국', JP: '일본', CN: '중국', GB: '영국', DE: '독일',
    FR: '프랑스', SG: '싱가포르', AU: '호주', CA: '캐나다', TH: '태국',
    VN: '베트남', TW: '대만', HK: '홍콩', UNKNOWN: '알 수 없음',
  };

  const sortedClicks = [...productClicks].sort((a, b) =>
    clickSort === 'desc' ? b.clicks - a.clicks : a.clicks - b.clicks
  );

  const cards = [
    { title: '전체 상품', value: stats.totalProducts, icon: Package, color: 'bg-blue-500', href: '/admin/products' },
    { title: '게시중 상품', value: stats.activeProducts, icon: Package, color: 'bg-green-500', href: '/admin/products' },
    { title: '등록 숏츠', value: stats.totalShorts, icon: Video, color: 'bg-purple-500', href: '/admin/shorts' },
    { title: '총 방문수', value: stats.totalVisits, icon: Eye, color: 'bg-orange-500', href: '#' },
  ];

  return (
    <div>
      {/* Connection status */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${stats.isLive ? 'bg-green-500' : 'bg-amber-400'}`} />
          <span className="text-xs font-semibold text-gray-500">
            {stats.isLive ? 'Supabase 연결됨' : '목업 모드 (DB 미연결)'}
          </span>
        </div>
        <button onClick={fetchStats} disabled={isLoading}
          className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group flex items-center">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white ${card.color} shadow-sm group-hover:scale-105 transition-transform`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="ml-4">
                <p className="text-xs font-medium text-gray-500">{card.title}</p>
                <p className="text-xl font-bold text-gray-900">{isLoading ? '...' : card.value}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Analytics section - row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Country breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Globe className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-gray-800">국가별 방문</h3>
          </div>
          {countries.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">아직 방문 데이터가 없습니다</p>
          ) : (
            <div className="space-y-3">
              {countries.slice(0, 10).map(({ country, count }) => {
                const maxCount = countries[0]?.count || 1;
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={country}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {COUNTRY_NAMES[country] || country}
                      </span>
                      <span className="text-xs font-bold text-gray-500">{count}회</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Wishlist ranking */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <Heart className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-gray-800">위시리스트 인기 상품</h3>
          </div>
          {wishRanks.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">아직 위시리스트 데이터가 없습니다</p>
          ) : (
            <div className="space-y-2">
              {wishRanks.slice(0, 10).map((item, i) => (
                <div key={item.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-gray-200 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
                  }`}>{i + 1}</span>
                  <span className="text-sm text-gray-800 font-medium truncate flex-1">{item.name}</span>
                  <span className="text-xs font-bold text-red-400 flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-current" /> {item.wishCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Product clicks - full width */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-gray-400" />
            <h3 className="font-bold text-gray-800">제품별 클릭수</h3>
          </div>
          <button
            onClick={() => setClickSort(prev => prev === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {clickSort === 'desc' ? '높은순' : '낮은순'}
          </button>
        </div>
        {sortedClicks.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">상품 데이터가 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  <th className="py-3 pl-2 w-10">#</th>
                  <th className="py-3">상품명</th>
                  <th className="py-3 text-right pr-2">
                    <button onClick={() => setClickSort(prev => prev === 'desc' ? 'asc' : 'desc')}
                      className="inline-flex items-center gap-1 hover:text-gray-800 transition-colors">
                      클릭수
                      {clickSort === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    </button>
                  </th>
                  <th className="py-3 pr-4 w-48">비율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedClicks.map((item, i) => {
                  const maxClicks = Math.max(...productClicks.map(p => p.clicks), 1);
                  const pct = Math.round((item.clicks / maxClicks) * 100);
                  return (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 pl-2 text-xs text-gray-400 font-bold">{i + 1}</td>
                      <td className="py-3">
                        <Link href={`/admin/products`} className="text-sm font-medium text-gray-800 hover:text-black transition-colors">
                          {item.name}
                        </Link>
                      </td>
                      <td className="py-3 text-right pr-2">
                        <span className="text-sm font-bold text-gray-900">{item.clicks}</span>
                        <span className="text-xs text-gray-400 ml-1">회</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-orange-400 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
