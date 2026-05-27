-- ============================================================
-- KOKKOK GARDEN V2 — Worldwide page admin migration
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Per-language UI labels for the /worldwide page
CREATE TABLE IF NOT EXISTS public.worldwide_labels (
  label_key text PRIMARY KEY,
  kr text DEFAULT '',
  en text DEFAULT '',
  cn text DEFAULT '',
  jp text DEFAULT '',
  vn text DEFAULT '',
  th text DEFAULT '',
  updated_at timestamptz DEFAULT timezone('utc', now())
);

ALTER TABLE public.worldwide_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read worldwide_labels" ON public.worldwide_labels;
DROP POLICY IF EXISTS "Public write worldwide_labels" ON public.worldwide_labels;
CREATE POLICY "Public read worldwide_labels" ON public.worldwide_labels FOR SELECT USING (true);
CREATE POLICY "Public write worldwide_labels" ON public.worldwide_labels FOR ALL USING (true);

-- Retailer entries (one row per country)
CREATE TABLE IF NOT EXISTS public.worldwide_retailers (
  id bigserial PRIMARY KEY,
  country_code text NOT NULL,       -- ISO 3166-1 alpha-2 lowercase (used for flag CDN)
  country_native text NOT NULL,      -- native spelling, e.g. 日本
  country_en text NOT NULL,          -- English spelling, e.g. Japan
  region text NOT NULL,              -- ASIA / NORTH AMERICA / EUROPE / OCEANIA / MIDDLE EAST / AFRICA / CIS / SOUTH AMERICA
  store_name text DEFAULT '',
  store_url text DEFAULT '#',
  banner_color text DEFAULT '#111111',
  is_active boolean DEFAULT true,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT timezone('utc', now()),
  updated_at timestamptz DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_worldwide_retailers_region ON public.worldwide_retailers(region);
CREATE INDEX IF NOT EXISTS idx_worldwide_retailers_sort ON public.worldwide_retailers(sort_order);

ALTER TABLE public.worldwide_retailers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read worldwide_retailers" ON public.worldwide_retailers;
DROP POLICY IF EXISTS "Public write worldwide_retailers" ON public.worldwide_retailers;
CREATE POLICY "Public read worldwide_retailers" ON public.worldwide_retailers FOR SELECT USING (true);
CREATE POLICY "Public write worldwide_retailers" ON public.worldwide_retailers FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────
-- Seed labels (6 languages per key)
-- ─────────────────────────────────────────────────────────
INSERT INTO public.worldwide_labels (label_key, kr, en, cn, jp, vn, th) VALUES
  ('hero_badge',            'SHOP WORLDWIDE', 'SHOP WORLDWIDE', '全球购', '世界中で購入', 'MUA TOÀN CẦU', 'ช้อปทั่วโลก'),
  ('hero_title',            '전 세계에서 콕콕가든을 만나보세요', 'Shop Kokkok Garden Worldwide', '在全球购买 Kokkok Garden', '世界中でKOKKOK Gardenを購入', 'Mua Kokkok Garden Toàn Cầu', 'ช้อป Kokkok Garden ทั่วโลก'),
  ('hero_sub',              '글로벌 파트너와 함께하는 K-뷰티', 'Available across the globe through our trusted partners', '通过我们值得信赖的合作伙伴遍布全球', '信頼できるパートナーを通じて世界中で販売中', 'Có mặt toàn cầu thông qua các đối tác tin cậy', 'มีจำหน่ายทั่วโลกผ่านพันธมิตรที่เชื่อถือได้'),
  ('breadcrumb_home',       '홈', 'HOME', '首页', 'ホーム', 'TRANG CHỦ', 'หน้าหลัก'),
  ('breadcrumb_worldwide',  '월드와이드', 'SHOP WORLDWIDE', '全球购', '世界中で購入', 'MUA TOÀN CẦU', 'ช้อปทั่วโลก'),
  ('filter_label',          '지역 선택', 'Filter by Region', '按地区筛选', '地域で絞り込む', 'Lọc theo Khu vực', 'กรองตามภูมิภาค'),
  ('region_all',            '전체', 'ALL', '全部', 'すべて', 'TẤT CẢ', 'ทั้งหมด'),
  ('region_asia',           '아시아', 'ASIA', '亚洲', 'アジア', 'CHÂU Á', 'เอเชีย'),
  ('region_north_america',  '북미', 'NORTH AMERICA', '北美', '北米', 'BẮC MỸ', 'อเมริกาเหนือ'),
  ('region_south_america',  '남미', 'SOUTH AMERICA', '南美', '南米', 'NAM MỸ', 'อเมริกาใต้'),
  ('region_europe',         '유럽', 'EUROPE', '欧洲', 'ヨーロッパ', 'CHÂU ÂU', 'ยุโรป'),
  ('region_oceania',        '오세아니아', 'OCEANIA', '大洋洲', 'オセアニア', 'CHÂU ĐẠI DƯƠNG', 'โอเชียเนีย'),
  ('region_middle_east',    '중동', 'MIDDLE EAST', '中东', '中東', 'TRUNG ĐÔNG', 'ตะวันออกกลาง'),
  ('region_africa',         '아프리카', 'AFRICA', '非洲', 'アフリカ', 'CHÂU PHI', 'แอฟริกา'),
  ('region_cis',            'CIS', 'CIS', '独联体', 'CIS', 'CIS', 'CIS'),
  ('visit_store',           '스토어 방문', 'Visit Store', '前往商店', 'ストアを見る', 'Ghé Cửa Hàng', 'เยี่ยมชมร้าน'),
  ('coming_soon',           '준비중', 'Coming Soon', '即将推出', '準備中', 'Sắp ra mắt', 'เร็วๆ นี้'),
  ('partner_badge',         '파트너십', 'Become a Partner', '合作', 'パートナー募集', 'Trở Thành Đối Tác', 'เป็นพันธมิตร'),
  ('partner_title',         '파트너십 문의', 'Want to carry Kokkok Garden?', '想销售 Kokkok Garden？', 'KOKKOK Gardenの取扱をご希望の方へ', 'Bạn muốn phân phối Kokkok Garden?', 'ต้องการจำหน่าย Kokkok Garden?'),
  ('partner_body',          '전 세계 파트너 모집 중입니다. 아래 버튼으로 문의해주세요.', 'We are actively seeking new global retail partners. Reach out to us to learn more.', '我们正在积极寻找新的全球零售合作伙伴。请联系我们了解更多。', '新しいグローバル小売パートナーを積極的に募集しています。詳細はお問い合わせください。', 'Chúng tôi đang tìm kiếm đối tác bán lẻ toàn cầu mới. Liên hệ để biết thêm chi tiết.', 'เรากำลังมองหาพันธมิตรค้าปลีกระดับโลกรายใหม่ ติดต่อเราเพื่อเรียนรู้เพิ่มเติม')
ON CONFLICT (label_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- Seed retailers (29 countries, matches current hardcoded list)
-- ─────────────────────────────────────────────────────────
INSERT INTO public.worldwide_retailers (country_code, country_native, country_en, region, store_name, store_url, banner_color, sort_order) VALUES
  ('kr', '한국', 'South Korea', 'ASIA', 'Kokkok Garden Official', 'https://kokv2.vercel.app/kr', '#4a7ab5', 10),
  ('jp', '日本', 'Japan', 'ASIA', 'Kokkok Garden Japan', '#', '#bc002d', 20),
  ('cn', '中国', 'China', 'ASIA', 'Kokkok Garden China', '#', '#de2910', 30),
  ('tw', '台灣', 'Taiwan', 'ASIA', 'Kokkok Garden Taiwan', '#', '#003070', 40),
  ('hk', '香港', 'Hong Kong', 'ASIA', 'Kokkok Garden HK', '#', '#de2910', 50),
  ('sg', 'Singapore', 'Singapore', 'ASIA', 'Kokkok Garden SG', '#', '#ef3340', 60),
  ('my', 'Malaysia', 'Malaysia', 'ASIA', 'Kokkok Garden Malaysia', '#', '#cc0001', 70),
  ('th', 'ประเทศไทย', 'Thailand', 'ASIA', 'Kokkok Garden Thailand', '#', '#2d2a4a', 80),
  ('vn', 'Việt Nam', 'Vietnam', 'ASIA', 'Kokkok Garden Vietnam', '#', '#da251d', 90),
  ('id', 'Indonesia', 'Indonesia', 'ASIA', 'Kokkok Garden Indonesia', '#', '#ce1126', 100),
  ('ph', 'Philippines', 'Philippines', 'ASIA', 'Kokkok Garden Philippines', '#', '#0038a8', 110),
  ('us', 'United States', 'United States', 'NORTH AMERICA', 'Kokkok Garden USA', '#', '#3c3b6e', 200),
  ('ca', 'Canada', 'Canada', 'NORTH AMERICA', 'Kokkok Garden Canada', '#', '#ff0000', 210),
  ('mx', 'México', 'Mexico', 'NORTH AMERICA', 'Kokkok Garden Mexico', '#', '#006847', 220),
  ('gb', 'United Kingdom', 'United Kingdom', 'EUROPE', 'Kokkok Garden UK', '#', '#012169', 300),
  ('de', 'Deutschland', 'Germany', 'EUROPE', 'Kokkok Garden Germany', '#', '#2a2a2a', 310),
  ('fr', 'France', 'France', 'EUROPE', 'Kokkok Garden France', '#', '#002395', 320),
  ('it', 'Italia', 'Italy', 'EUROPE', 'Kokkok Garden Italy', '#', '#009246', 330),
  ('es', 'España', 'Spain', 'EUROPE', 'Kokkok Garden Spain', '#', '#aa151b', 340),
  ('nl', 'Nederland', 'Netherlands', 'EUROPE', 'Kokkok Garden NL', '#', '#ae1c28', 350),
  ('pl', 'Polska', 'Poland', 'EUROPE', 'Kokkok Garden Poland', '#', '#dc143c', 360),
  ('ae', 'UAE', 'UAE', 'MIDDLE EAST', 'Kokkok Garden UAE', '#', '#00732f', 400),
  ('sa', 'Saudi Arabia', 'Saudi Arabia', 'MIDDLE EAST', 'Kokkok Garden KSA', '#', '#006c35', 410),
  ('au', 'Australia', 'Australia', 'OCEANIA', 'Kokkok Garden Australia', '#', '#00008b', 500),
  ('nz', 'New Zealand', 'New Zealand', 'OCEANIA', 'Kokkok Garden NZ', '#', '#00247d', 510),
  ('br', 'Brasil', 'Brazil', 'SOUTH AMERICA', 'Kokkok Garden Brazil', '#', '#009c3b', 600),
  ('cl', 'Chile', 'Chile', 'SOUTH AMERICA', 'Kokkok Garden Chile', '#', '#d52b1e', 610),
  ('ru', 'Россия', 'Russia', 'CIS', 'Kokkok Garden Russia', '#', '#cc0000', 700),
  ('kz', 'Қазақстан', 'Kazakhstan', 'CIS', 'Kokkok Garden Kazakhstan', '#', '#00AFCA', 710)
ON CONFLICT DO NOTHING;
