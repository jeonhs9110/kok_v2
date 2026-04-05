@AGENTS.md

# KOKKOK Garden V2 - Project Guide

## Overview
K-beauty(한국 화장품) 멀티리전 이커머스 프로토타입. 한국 사용자는 구매 가능한 스토어(`/kr`), 해외 사용자는 뷰잉 전용 스토어(`/gl`)로 분기된다.

## Tech Stack
- **Framework**: Next.js 16.2.2 (App Router) + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 4 (utility-first, no component library)
- **DB/Auth/Storage**: Supabase (PostgreSQL + Auth + Storage)
- **Translation**: OpenAI GPT-4o mini (한→5개국어, 24시간 캐시)
- **Carousel**: Embla Carousel 8.6
- **Icons**: Lucide React
- **Deploy**: Vercel

## Route Architecture
```
/                           → Geo-redirect (KR→/kr/kr, Others→/gl/en)
/kr/[lang]/                 → 한국 스토어 (구매 가능)
/kr/[lang]/products         → 상품 목록
/kr/[lang]/products/[id]    → 상품 상세
/kr/[lang]/worldwide        → 글로벌 판매처 안내
/gl/[lang]/                 → 글로벌 스토어 (뷰잉 전용 + AI 챗봇)
/gl/[lang]/products         → 상품 목록 (읽기 전용)
/gl/[lang]/products/[id]    → 상품 상세 (구매 불가)
/gl/[lang]/worldwide        → 글로벌 판매처 안내
/login                      → 관리자 로그인
/register                   → 관리자 회원가입
/admin                      → 대시보드
/admin/products             → 상품 CRUD + 이미지 업로드
/admin/users                → 회원 관리 (목업)
/admin/shorts               → YouTube Shorts 관리
/admin/media                → 미디어 관리 (플레이스홀더)
/api/debug-env              → 환경변수 디버그
```

## Supported Languages
kr(한국어), en(영어), cn(중국어), jp(일본어), vn(베트남어), th(태국어)

## Key Directories
```
src/app/           → 페이지 라우트 (App Router)
src/components/    → 공통 컴포넌트 (Header, Footer, HeroSlider 등)
src/lib/api/       → 상품 API & 목업 데이터
src/lib/i18n/      → 다국어 번역 (Context 기반, 라이브러리 없음)
src/lib/openai.ts  → GPT 번역 로직 (unstable_cache)
src/lib/supabase/  → Supabase 클라이언트 (browser/server)
```

## Database Tables (Supabase)
- `users` — 사용자 프로필 (auth.users 동기화)
- `products` — 상품 (name, price, images, is_active 등)
- `orders` — 주문 내역
- `cart_items` — 장바구니
- `media_stories` — 브랜드 스토리
- `shorts` — YouTube Shorts

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL        # 필수
NEXT_PUBLIC_SUPABASE_ANON_KEY   # 필수
OPENAI_API_KEY                  # 선택 (번역용)
```

## Business Logic Highlights
- **Region Split**: `x-user-country` 헤더로 KR/GL 분기. KR은 구매 가능, GL은 뷰잉+챗봇
- **Translation**: `lang !== 'kr'`일 때 GPT-4o mini로 상품 정보 자동 번역 (24h 캐시)
- **Admin Auth**: Supabase Auth + 목업 폴백 (`admin123`/`456789123`), 쿠키 `kokkok_admin_auth`
- **Product Display**: "Weekly Best" (전반부) + "New Arrivals" (후반부 역순)
- **Shorts**: YouTube ID 파싱, Supabase 저장, 홈페이지 최대 10개 표시

## Current Phase
Phase 1 (현재): 스토어 UI, 목업 장바구니/체크아웃, 관리자 CRUD
Phase 2 (예정): 실제 장바구니, 결제 연동, 주문 처리
