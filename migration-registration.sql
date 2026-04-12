-- ============================================================
-- KOKKOK GARDEN V2 — Registration & Auth System Migration
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Customer profiles (extends auth.users with business data)
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  name text,
  phone text,
  gender text,
  birthday date,
  age_range text,
  country text,
  skin_type text,
  marketing_consent boolean DEFAULT false,
  privacy_consent boolean DEFAULT false,
  is_verified boolean DEFAULT false,
  auth_provider text,
  custom_fields jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT timezone('utc', now()),
  updated_at timestamptz DEFAULT timezone('utc', now())
);
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Users write own profile" ON public.customer_profiles;
DROP POLICY IF EXISTS "Admin read all profiles" ON public.customer_profiles;
CREATE POLICY "Users read own profile" ON public.customer_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users write own profile" ON public.customer_profiles FOR ALL USING (true);
CREATE POLICY "Admin read all profiles" ON public.customer_profiles FOR SELECT USING (true);

-- 2. Registration field config (admin-controlled form fields)
CREATE TABLE IF NOT EXISTS public.registration_config (
  id integer PRIMARY KEY DEFAULT 1,
  fields jsonb DEFAULT '[
    {"key": "email", "label_kr": "이메일", "label_en": "Email", "type": "email", "required": true, "enabled": true, "removable": false},
    {"key": "password", "label_kr": "비밀번호", "label_en": "Password", "type": "password", "required": true, "enabled": true, "removable": false},
    {"key": "name", "label_kr": "이름", "label_en": "Name", "type": "text", "required": true, "enabled": true, "removable": false},
    {"key": "phone", "label_kr": "전화번호", "label_en": "Phone Number", "type": "tel", "required": true, "enabled": true, "removable": true},
    {"key": "gender", "label_kr": "성별", "label_en": "Gender", "type": "select", "options_kr": ["남성","여성","기타","선택안함"], "options_en": ["Male","Female","Other","Prefer not to say"], "required": true, "enabled": true, "removable": true},
    {"key": "birthday", "label_kr": "생년월일", "label_en": "Birthday", "type": "date", "required": true, "enabled": true, "removable": true},
    {"key": "country", "label_kr": "국가", "label_en": "Country", "type": "text", "required": true, "enabled": true, "removable": true},
    {"key": "skin_type", "label_kr": "피부 타입", "label_en": "Skin Type", "type": "select", "options_kr": ["건성","지성","복합성","민감성","중성"], "options_en": ["Dry","Oily","Combination","Sensitive","Normal"], "required": false, "enabled": true, "removable": true}
  ]'::jsonb,
  require_marketing_consent boolean DEFAULT true,
  require_privacy_consent boolean DEFAULT true,
  terms_url text DEFAULT '/terms',
  privacy_url text DEFAULT '/privacy',
  updated_at timestamptz DEFAULT timezone('utc', now()),
  CONSTRAINT single_reg_config CHECK (id = 1)
);
INSERT INTO public.registration_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.registration_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read registration_config" ON public.registration_config FOR SELECT USING (true);
CREATE POLICY "Admin write registration_config" ON public.registration_config FOR ALL USING (true);

-- 3. Social auth provider config (admin inputs API keys)
CREATE TABLE IF NOT EXISTS public.auth_providers_config (
  id serial PRIMARY KEY,
  provider text UNIQUE NOT NULL,
  is_enabled boolean DEFAULT false,
  client_id text DEFAULT '',
  client_secret text DEFAULT '',
  additional_config jsonb DEFAULT '{}',
  help_url text DEFAULT '',
  description_kr text DEFAULT '',
  description_en text DEFAULT '',
  updated_at timestamptz DEFAULT timezone('utc', now())
);
ALTER TABLE public.auth_providers_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read auth_providers" ON public.auth_providers_config FOR SELECT USING (true);
CREATE POLICY "Admin write auth_providers" ON public.auth_providers_config FOR ALL USING (true);

-- Seed default providers
INSERT INTO public.auth_providers_config (provider, is_enabled, help_url, description_kr, description_en) VALUES
  ('google', false, 'https://console.cloud.google.com/apis/credentials', 'Google Cloud Console → OAuth 2.0 클라이언트 ID 생성', 'Google Cloud Console → Create OAuth 2.0 Client ID'),
  ('kakao', false, 'https://developers.kakao.com/console/app', 'Kakao Developers → 앱 생성 → REST API 키', 'Kakao Developers → Create App → REST API Key'),
  ('naver', false, 'https://developers.naver.com/apps/#/register', 'Naver Developers → 애플리케이션 등록 → 네이버 로그인', 'Naver Developers → Register App → Naver Login'),
  ('apple', false, 'https://developer.apple.com/account/resources/identifiers/list/serviceId', 'Apple Developer → Identifiers → Service IDs (연회비 $99 필요)', 'Apple Developer → Identifiers → Service IDs ($99/year required)')
ON CONFLICT (provider) DO NOTHING;

-- 4. Identity verification config (본인인증)
CREATE TABLE IF NOT EXISTS public.identity_verification_config (
  id integer PRIMARY KEY DEFAULT 1,
  is_enabled boolean DEFAULT false,
  provider text DEFAULT 'nice',
  api_key text DEFAULT '',
  secret_key text DEFAULT '',
  merchant_id text DEFAULT '',
  help_url text DEFAULT 'https://www.niceapi.co.kr/',
  description_kr text DEFAULT 'NICE 본인인증 — 통신사 본인인증 서비스',
  description_en text DEFAULT 'NICE Identity Verification — Korean carrier-based identity verification',
  updated_at timestamptz DEFAULT timezone('utc', now()),
  CONSTRAINT single_verification_config CHECK (id = 1)
);
INSERT INTO public.identity_verification_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.identity_verification_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read verification_config" ON public.identity_verification_config FOR SELECT USING (true);
CREATE POLICY "Admin write verification_config" ON public.identity_verification_config FOR ALL USING (true);
