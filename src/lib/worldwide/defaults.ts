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
  id: string;
  country: string;      // native spelling (what shows on the card)
  countryEn: string;    // English spelling (uppercase row)
  region: Region;
  storeName: string;
  storeUrl: string;
  bannerColor: string;
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

export const DEFAULT_RETAILERS: RetailerEntry[] = [
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
  { id: 'us', country: 'United States', countryEn: 'United States', region: 'NORTH AMERICA', storeName: 'Kokkok Garden USA', storeUrl: '#', bannerColor: '#3c3b6e' },
  { id: 'ca', country: 'Canada', countryEn: 'Canada', region: 'NORTH AMERICA', storeName: 'Kokkok Garden Canada', storeUrl: '#', bannerColor: '#ff0000' },
  { id: 'mx', country: 'México', countryEn: 'Mexico', region: 'NORTH AMERICA', storeName: 'Kokkok Garden Mexico', storeUrl: '#', bannerColor: '#006847' },
  { id: 'gb', country: 'United Kingdom', countryEn: 'United Kingdom', region: 'EUROPE', storeName: 'Kokkok Garden UK', storeUrl: '#', bannerColor: '#012169' },
  { id: 'de', country: 'Deutschland', countryEn: 'Germany', region: 'EUROPE', storeName: 'Kokkok Garden Germany', storeUrl: '#', bannerColor: '#2a2a2a' },
  { id: 'fr', country: 'France', countryEn: 'France', region: 'EUROPE', storeName: 'Kokkok Garden France', storeUrl: '#', bannerColor: '#002395' },
  { id: 'it', country: 'Italia', countryEn: 'Italy', region: 'EUROPE', storeName: 'Kokkok Garden Italy', storeUrl: '#', bannerColor: '#009246' },
  { id: 'es', country: 'España', countryEn: 'Spain', region: 'EUROPE', storeName: 'Kokkok Garden Spain', storeUrl: '#', bannerColor: '#aa151b' },
  { id: 'nl', country: 'Nederland', countryEn: 'Netherlands', region: 'EUROPE', storeName: 'Kokkok Garden NL', storeUrl: '#', bannerColor: '#ae1c28' },
  { id: 'pl', country: 'Polska', countryEn: 'Poland', region: 'EUROPE', storeName: 'Kokkok Garden Poland', storeUrl: '#', bannerColor: '#dc143c' },
  { id: 'ae', country: 'UAE', countryEn: 'UAE', region: 'MIDDLE EAST', storeName: 'Kokkok Garden UAE', storeUrl: '#', bannerColor: '#00732f' },
  { id: 'sa', country: 'Saudi Arabia', countryEn: 'Saudi Arabia', region: 'MIDDLE EAST', storeName: 'Kokkok Garden KSA', storeUrl: '#', bannerColor: '#006c35' },
  { id: 'au', country: 'Australia', countryEn: 'Australia', region: 'OCEANIA', storeName: 'Kokkok Garden Australia', storeUrl: '#', bannerColor: '#00008b' },
  { id: 'nz', country: 'New Zealand', countryEn: 'New Zealand', region: 'OCEANIA', storeName: 'Kokkok Garden NZ', storeUrl: '#', bannerColor: '#00247d' },
  { id: 'br', country: 'Brasil', countryEn: 'Brazil', region: 'SOUTH AMERICA', storeName: 'Kokkok Garden Brazil', storeUrl: '#', bannerColor: '#009c3b' },
  { id: 'cl', country: 'Chile', countryEn: 'Chile', region: 'SOUTH AMERICA', storeName: 'Kokkok Garden Chile', storeUrl: '#', bannerColor: '#d52b1e' },
  { id: 'ru', country: 'Россия', countryEn: 'Russia', region: 'CIS', storeName: 'Kokkok Garden Russia', storeUrl: '#', bannerColor: '#cc0000' },
  { id: 'kz', country: 'Қазақстан', countryEn: 'Kazakhstan', region: 'CIS', storeName: 'Kokkok Garden Kazakhstan', storeUrl: '#', bannerColor: '#00AFCA' },
];

export function resolveLabels(lang: string): WorldwideLabels {
  return DEFAULT_LABELS[lang as WorldwideLang] ?? DEFAULT_LABELS.en;
}
