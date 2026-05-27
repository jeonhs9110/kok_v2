export type Region =
  | 'ASIA'
  | 'NORTH AMERICA'
  | 'SOUTH AMERICA'
  | 'EUROPE'
  | 'OCEANIA'
  | 'MIDDLE EAST'
  | 'AFRICA'
  | 'CIS';

export const REGION_ORDER: Region[] = [
  'ASIA',
  'NORTH AMERICA',
  'SOUTH AMERICA',
  'EUROPE',
  'OCEANIA',
  'MIDDLE EAST',
  'AFRICA',
  'CIS',
];

export const REGION_LABEL_KEY: Record<Region, string> = {
  'ASIA': 'region_asia',
  'NORTH AMERICA': 'region_north_america',
  'SOUTH AMERICA': 'region_south_america',
  'EUROPE': 'region_europe',
  'OCEANIA': 'region_oceania',
  'MIDDLE EAST': 'region_middle_east',
  'AFRICA': 'region_africa',
  'CIS': 'region_cis',
};

export interface RetailerEntry {
  id: string;           // unique row id (country_code_row or db id)
  countryCode: string;  // country ISO (lowercase), shared across vendors for same country
  country: string;      // native spelling (what shows on the card)
  countryEn: string;    // English spelling (uppercase row)
  region: Region;
  storeName: string;
  storeUrl: string;
  storeLogoUrl: string;    // vendor logo (optional)
  countryImageUrl: string; // country-card image (optional)
  bannerColor: string;
}

export interface CountryGroup {
  countryCode: string;
  country: string;
  countryEn: string;
  region: Region;
  bannerColor: string;
  countryImageUrl: string;
  vendors: RetailerEntry[];
}

/** Group retailers by country_code, preserving insertion order. */
export function groupByCountry(retailers: RetailerEntry[]): CountryGroup[] {
  const map = new Map<string, CountryGroup>();
  for (const r of retailers) {
    const existing = map.get(r.countryCode);
    if (existing) {
      existing.vendors.push(r);
      // Prefer a non-empty country image if any row has one
      if (!existing.countryImageUrl && r.countryImageUrl) existing.countryImageUrl = r.countryImageUrl;
    } else {
      map.set(r.countryCode, {
        countryCode: r.countryCode,
        country: r.country,
        countryEn: r.countryEn,
        region: r.region,
        bannerColor: r.bannerColor,
        countryImageUrl: r.countryImageUrl,
        vendors: [r],
      });
    }
  }
  return Array.from(map.values());
}

export interface WorldwideLabels {
  hero_badge: string;
  hero_title: string;
  hero_sub: string;
  breadcrumb_home: string;
  breadcrumb_worldwide: string;
  filter_label: string;
  region_all: string;
  region_asia: string;
  region_north_america: string;
  region_south_america: string;
  region_europe: string;
  region_oceania: string;
  region_middle_east: string;
  region_africa: string;
  region_cis: string;
  visit_store: string;
  coming_soon: string;
  partner_badge: string;
  partner_title: string;
  partner_body: string;
}

export const LABEL_KEYS: (keyof WorldwideLabels)[] = [
  'hero_badge', 'hero_title', 'hero_sub',
  'breadcrumb_home', 'breadcrumb_worldwide',
  'filter_label', 'region_all',
  'region_asia', 'region_north_america', 'region_south_america',
  'region_europe', 'region_oceania', 'region_middle_east',
  'region_africa', 'region_cis',
  'visit_store', 'coming_soon',
  'partner_badge', 'partner_title', 'partner_body',
];

export const SUPPORTED_LANGS = ['kr', 'en', 'cn', 'jp', 'vn', 'th'] as const;
export type WorldwideLang = typeof SUPPORTED_LANGS[number];

export const DEFAULT_LABELS: Record<WorldwideLang, WorldwideLabels> = {
  kr: {
    hero_badge: 'SHOP WORLDWIDE',
    hero_title: '전 세계에서 콕콕가든을 만나보세요',
    hero_sub: '글로벌 파트너와 함께하는 K-뷰티',
    breadcrumb_home: '홈',
    breadcrumb_worldwide: '월드와이드',
    filter_label: '지역 선택',
    region_all: '전체',
    region_asia: '아시아',
    region_north_america: '북미',
    region_south_america: '남미',
    region_europe: '유럽',
    region_oceania: '오세아니아',
    region_middle_east: '중동',
    region_africa: '아프리카',
    region_cis: 'CIS',
    visit_store: '스토어 방문',
    coming_soon: '준비중',
    partner_badge: '파트너십',
    partner_title: '파트너십 문의',
    partner_body: '전 세계 파트너 모집 중입니다. 아래 버튼으로 문의해주세요.',
  },
  en: {
    hero_badge: 'SHOP WORLDWIDE',
    hero_title: 'Shop Kokkok Garden Worldwide',
    hero_sub: 'Available across the globe through our trusted partners',
    breadcrumb_home: 'HOME',
    breadcrumb_worldwide: 'SHOP WORLDWIDE',
    filter_label: 'Filter by Region',
    region_all: 'ALL',
    region_asia: 'ASIA',
    region_north_america: 'NORTH AMERICA',
    region_south_america: 'SOUTH AMERICA',
    region_europe: 'EUROPE',
    region_oceania: 'OCEANIA',
    region_middle_east: 'MIDDLE EAST',
    region_africa: 'AFRICA',
    region_cis: 'CIS',
    visit_store: 'Visit Store',
    coming_soon: 'Coming Soon',
    partner_badge: 'Become a Partner',
    partner_title: 'Want to carry Kokkok Garden?',
    partner_body: 'We are actively seeking new global retail partners. Reach out to us to learn more.',
  },
  cn: {
    hero_badge: '全球购',
    hero_title: '在全球购买 Kokkok Garden',
    hero_sub: '通过我们值得信赖的合作伙伴遍布全球',
    breadcrumb_home: '首页',
    breadcrumb_worldwide: '全球购',
    filter_label: '按地区筛选',
    region_all: '全部',
    region_asia: '亚洲',
    region_north_america: '北美',
    region_south_america: '南美',
    region_europe: '欧洲',
    region_oceania: '大洋洲',
    region_middle_east: '中东',
    region_africa: '非洲',
    region_cis: '独联体',
    visit_store: '前往商店',
    coming_soon: '即将推出',
    partner_badge: '合作',
    partner_title: '想销售 Kokkok Garden？',
    partner_body: '我们正在积极寻找新的全球零售合作伙伴。请联系我们了解更多。',
  },
  jp: {
    hero_badge: '世界中で購入',
    hero_title: '世界中でKOKKOK Gardenを購入',
    hero_sub: '信頼できるパートナーを通じて世界中で販売中',
    breadcrumb_home: 'ホーム',
    breadcrumb_worldwide: '世界中で購入',
    filter_label: '地域で絞り込む',
    region_all: 'すべて',
    region_asia: 'アジア',
    region_north_america: '北米',
    region_south_america: '南米',
    region_europe: 'ヨーロッパ',
    region_oceania: 'オセアニア',
    region_middle_east: '中東',
    region_africa: 'アフリカ',
    region_cis: 'CIS',
    visit_store: 'ストアを見る',
    coming_soon: '準備中',
    partner_badge: 'パートナー募集',
    partner_title: 'KOKKOK Gardenの取扱をご希望の方へ',
    partner_body: '新しいグローバル小売パートナーを積極的に募集しています。詳細はお問い合わせください。',
  },
  vn: {
    hero_badge: 'MUA TOÀN CẦU',
    hero_title: 'Mua Kokkok Garden Toàn Cầu',
    hero_sub: 'Có mặt toàn cầu thông qua các đối tác tin cậy',
    breadcrumb_home: 'TRANG CHỦ',
    breadcrumb_worldwide: 'MUA TOÀN CẦU',
    filter_label: 'Lọc theo Khu vực',
    region_all: 'TẤT CẢ',
    region_asia: 'CHÂU Á',
    region_north_america: 'BẮC MỸ',
    region_south_america: 'NAM MỸ',
    region_europe: 'CHÂU ÂU',
    region_oceania: 'CHÂU ĐẠI DƯƠNG',
    region_middle_east: 'TRUNG ĐÔNG',
    region_africa: 'CHÂU PHI',
    region_cis: 'CIS',
    visit_store: 'Ghé Cửa Hàng',
    coming_soon: 'Sắp ra mắt',
    partner_badge: 'Trở Thành Đối Tác',
    partner_title: 'Bạn muốn phân phối Kokkok Garden?',
    partner_body: 'Chúng tôi đang tìm kiếm đối tác bán lẻ toàn cầu mới. Liên hệ để biết thêm chi tiết.',
  },
  th: {
    hero_badge: 'ช้อปทั่วโลก',
    hero_title: 'ช้อป Kokkok Garden ทั่วโลก',
    hero_sub: 'มีจำหน่ายทั่วโลกผ่านพันธมิตรที่เชื่อถือได้',
    breadcrumb_home: 'หน้าหลัก',
    breadcrumb_worldwide: 'ช้อปทั่วโลก',
    filter_label: 'กรองตามภูมิภาค',
    region_all: 'ทั้งหมด',
    region_asia: 'เอเชีย',
    region_north_america: 'อเมริกาเหนือ',
    region_south_america: 'อเมริกาใต้',
    region_europe: 'ยุโรป',
    region_oceania: 'โอเชียเนีย',
    region_middle_east: 'ตะวันออกกลาง',
    region_africa: 'แอฟริกา',
    region_cis: 'CIS',
    visit_store: 'เยี่ยมชมร้าน',
    coming_soon: 'เร็วๆ นี้',
    partner_badge: 'เป็นพันธมิตร',
    partner_title: 'ต้องการจำหน่าย Kokkok Garden?',
    partner_body: 'เรากำลังมองหาพันธมิตรค้าปลีกระดับโลกรายใหม่ ติดต่อเราเพื่อเรียนรู้เพิ่มเติม',
  },
};

type SeedRow = [id: string, country: string, countryEn: string, region: Region, storeName: string, storeUrl: string, bannerColor: string];

const SEED_ROWS: SeedRow[] = [
  ['kr', '한국', 'South Korea', 'ASIA', 'Kokkok Garden Official', 'https://www.kokkokgarden.com/kr', '#4a7ab5'],
  ['jp', '日本', 'Japan', 'ASIA', 'Kokkok Garden Japan', '#', '#bc002d'],
  ['cn', '中国', 'China', 'ASIA', 'Kokkok Garden China', '#', '#de2910'],
  ['tw', '台灣', 'Taiwan', 'ASIA', 'Kokkok Garden Taiwan', '#', '#003070'],
  ['hk', '香港', 'Hong Kong', 'ASIA', 'Kokkok Garden HK', '#', '#de2910'],
  ['sg', 'Singapore', 'Singapore', 'ASIA', 'Kokkok Garden SG', '#', '#ef3340'],
  ['my', 'Malaysia', 'Malaysia', 'ASIA', 'Kokkok Garden Malaysia', '#', '#cc0001'],
  ['th', 'ประเทศไทย', 'Thailand', 'ASIA', 'Kokkok Garden Thailand', '#', '#2d2a4a'],
  ['vn', 'Việt Nam', 'Vietnam', 'ASIA', 'Kokkok Garden Vietnam', '#', '#da251d'],
  ['id', 'Indonesia', 'Indonesia', 'ASIA', 'Kokkok Garden Indonesia', '#', '#ce1126'],
  ['ph', 'Philippines', 'Philippines', 'ASIA', 'Kokkok Garden Philippines', '#', '#0038a8'],
  ['us', 'United States', 'United States', 'NORTH AMERICA', 'Kokkok Garden USA', '#', '#3c3b6e'],
  ['ca', 'Canada', 'Canada', 'NORTH AMERICA', 'Kokkok Garden Canada', '#', '#ff0000'],
  ['mx', 'México', 'Mexico', 'NORTH AMERICA', 'Kokkok Garden Mexico', '#', '#006847'],
  ['gb', 'United Kingdom', 'United Kingdom', 'EUROPE', 'Kokkok Garden UK', '#', '#012169'],
  ['de', 'Deutschland', 'Germany', 'EUROPE', 'Kokkok Garden Germany', '#', '#2a2a2a'],
  ['fr', 'France', 'France', 'EUROPE', 'Kokkok Garden France', '#', '#002395'],
  ['it', 'Italia', 'Italy', 'EUROPE', 'Kokkok Garden Italy', '#', '#009246'],
  ['es', 'España', 'Spain', 'EUROPE', 'Kokkok Garden Spain', '#', '#aa151b'],
  ['nl', 'Nederland', 'Netherlands', 'EUROPE', 'Kokkok Garden NL', '#', '#ae1c28'],
  ['pl', 'Polska', 'Poland', 'EUROPE', 'Kokkok Garden Poland', '#', '#dc143c'],
  ['ae', 'UAE', 'UAE', 'MIDDLE EAST', 'Kokkok Garden UAE', '#', '#00732f'],
  ['sa', 'Saudi Arabia', 'Saudi Arabia', 'MIDDLE EAST', 'Kokkok Garden KSA', '#', '#006c35'],
  ['au', 'Australia', 'Australia', 'OCEANIA', 'Kokkok Garden Australia', '#', '#00008b'],
  ['nz', 'New Zealand', 'New Zealand', 'OCEANIA', 'Kokkok Garden NZ', '#', '#00247d'],
  ['br', 'Brasil', 'Brazil', 'SOUTH AMERICA', 'Kokkok Garden Brazil', '#', '#009c3b'],
  ['cl', 'Chile', 'Chile', 'SOUTH AMERICA', 'Kokkok Garden Chile', '#', '#d52b1e'],
  ['ru', 'Россия', 'Russia', 'CIS', 'Kokkok Garden Russia', '#', '#cc0000'],
  ['kz', 'Қазақстан', 'Kazakhstan', 'CIS', 'Kokkok Garden Kazakhstan', '#', '#00AFCA'],
];

export const DEFAULT_RETAILERS: RetailerEntry[] = SEED_ROWS.map(([id, country, countryEn, region, storeName, storeUrl, bannerColor]) => ({
  id,
  countryCode: id,
  country,
  countryEn,
  region,
  storeName,
  storeUrl,
  storeLogoUrl: '',
  countryImageUrl: '',
  bannerColor,
}));

export function resolveLabels(lang: string): WorldwideLabels {
  return DEFAULT_LABELS[lang as WorldwideLang] ?? DEFAULT_LABELS.en;
}
