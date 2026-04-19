<h1 align="center">KOKKOK Garden V2</h1>
<h3 align="center">K-Beauty Multi-Region E-Commerce Platform</h3>

<p align="center">
  <em>A production-deployed, dual-storefront Next.js platform for a Korean cosmetics brand that sells at home and showcases abroad.</em><br>
  <sub>Next.js 16 App Router · React 19 · Supabase · GPT-4o-mini Translation · Tiptap · Embla · Vercel Edge</sub>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.2-000000?logo=nextdotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20Storage-3ECF8E?logo=supabase&logoColor=white">
  <img alt="OpenAI" src="https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai&logoColor=white">
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-deployed-000000?logo=vercel&logoColor=white">
  <img alt="Status" src="https://img.shields.io/badge/status-live-brightgreen">
  <img alt="License" src="https://img.shields.io/badge/source-public-blue">
</p>

<p align="center">
  <b>Live demo:</b> <a href="https://kokv2.vercel.app/">https://kokv2.vercel.app/</a><br>
  <sub>(Auto geo-split — KR visitors → checkout-enabled storefront · everyone else → view-only storefront with AI concierge)</sub>
</p>

---

## 🇰🇷 프로젝트 개요 (한국어)

**KOKKOK Garden V2**는 한국 화장품(K-Beauty) 브랜드를 위한 **이중 지역 이커머스 플랫폼**입니다.
사용자의 국가를 자동 판별하여 한국 사용자는 **구매 가능한 스토어(`/kr`)** 로, 해외 사용자는
**뷰잉 전용 + AI 컨시어지 챗봇 스토어(`/gl`)** 로 동일 코드베이스 내에서 분기시킵니다.
모든 라우트는 `[lang]` 동적 세그먼트로 래핑되어 **한국어·영어·중국어·일본어·베트남어·태국어
6개 언어**를 지원하며, 한국어 이외의 언어로 접속할 경우 **OpenAI GPT-4o-mini**가 상품명·
설명·브랜드 카피를 서버 컴포넌트 레벨에서 실시간 번역하고, Next.js `unstable_cache`로
**`(lang, productId, updatedAt)` 키 기준 24시간 캐싱**하여 번역 비용을 호출당이 아닌 이슈당
비용으로 눌렀습니다. 전체 스택은 스토어프론트 → 관리자 CMS(14+ 모듈) → Supabase(Postgres
+ Auth + Storage) → GPT 번역 → AI 챗봇 → Vercel Edge 배포까지 **단일 Next.js App Router
애플리케이션**으로 통합되어 있습니다.

**복잡도 측면** — 단순 "쇼핑몰 템플릿"이 아니라 **풀스택 운영 도구**로 설계했습니다.
Supabase 위에 상품·주문·장바구니·회원·브랜드 스토리·쇼츠·게시판(메뉴/포스트/댓글)·
정적 CMS 페이지·프로모션 배너·결제 설정·법적 고지·챗봇 설정·Instagram 피드까지 **14개
이상의 관리자 모듈**이 독립 라우트(`/admin/*`)로 분리되어 있으며, 각 모듈은 이미지 업로드
(Supabase Storage), CRUD, 활성/비활성 토글, 다국어 필드 관리를 자체적으로 수행합니다.
에디터는 **Tiptap 3** (StarterKit + Image + Link)으로 리치 텍스트 게시물을 지원하고,
홈페이지 캐러셀은 **Embla Carousel + Autoplay**로, Instagram 섹션은 공식 임베드 URL +
**RSS.app 자동 갱신** 엔드포인트(`/api/instagram/refresh`)로 Meta Graph API 의존성 없이
최신 포스트를 주기적 폴링합니다. 해외 스토어 AI 챗봇은 `/api/chat`에서 **IP 기반 레이트
리미팅(분당 10회)** 과 Supabase에 저장된 런타임 챗봇 설정(모델·그리팅·활성 여부)을
결합하여 해외 방문자에게 상품 안내와 브랜드 설명을 제공하며, 인증 계층에는 Supabase Auth
외에 **목업 관리자 폴백(`admin123`/`456789123`)** 이 있어 환경변수가 비어 있을 때도
어드민이 작동합니다.

**핵심 기술적 의사결정** — ① 다국어를 `i18next` 같은 라이브러리 없이 **React Context + 타입
세이프 번역 딕셔너리**로 직접 구현해 번들 크기를 줄였고, ② 지역 분기를 미들웨어가 아닌
**`x-user-country` 헤더 기반 서버 리다이렉트**로 처리해 CDN 캐시 친화적으로 만들었으며,
③ 최근 본 상품·방문 통계는 `localStorage` + `/api/track` 엔드포인트로 **클라이언트·서버
이중 집계**하여 개인화 데이터를 축적합니다. ④ Supabase가 설정되지 않은 환경에서는 **목업
시드 데이터로 전체 앱이 여전히 동작**하도록 설계하여 제로-셋업 데모와 프로덕션 동일
코드베이스를 유지합니다. 본 저장소는 **공개 포트폴리오**이며 브랜드 자산·상품 이미지·카피의
상업적 재사용은 허용되지 않습니다.

---

## 🎯 What is this?

KOKKOK Garden V2 is an end-to-end **K-beauty commerce platform** built around one observation: Korean cosmetics brands sell in *two fundamentally different modes* at once.

- **Korean shoppers** expect a normal checkout flow — cart, payment, shipping, Korean product copy.
- **International browsers** discover K-beauty on Instagram and TikTok but **cannot actually buy** (the brand ships only inside Korea) — so they need a **view-only showcase** that explains the product, points to overseas resellers, and answers questions in their own language.

The site auto-detects the visitor's country and serves the correct experience without the user ever choosing. Admin CMS, translations, payments config, and content — all one codebase.

Deployed on Vercel Edge with per-route server components and per-language GPT translation caching.

---

## 🧠 Request Pipeline

```
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Visitor    │──▶│  Geo split   │──▶│  [lang]      │──▶│  Server      │
│  hits /     │   │  x-user-     │   │  dynamic     │   │  Component   │
│             │   │  country     │   │  segment     │   │  data fetch  │
└─────────────┘   └──────────────┘   └──────────────┘   └──────┬───────┘
                                                               │ product rows
┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────▼───────┐
│  Vercel     │◀──│  Rendered    │◀──│  GPT-4o      │◀──│  Supabase    │
│  Edge → UA  │   │  HTML + JSON │   │  translate   │   │  Postgres    │
│             │   │              │   │  (24h cache) │   │  + Storage   │
└─────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
```

### Stage-by-stage

| # | Stage | What it produces | Key insight |
|---|-------|-----------------|-------------|
| ① | **Geo split** | Route decision: `/kr` vs `/gl` | Header-based (`x-user-country`) instead of middleware — stays CDN cache-friendly and bypassable for QA via cookie override |
| ② | **Language segment** | `[lang]` ∈ `{kr, en, cn, jp, vn, th}` | Typed translation dictionaries resolved on the server, shipped as already-translated JSON — no client-side i18n runtime, no flash of untranslated content |
| ③ | **Data fetch** | Product / page / post rows | Supabase SSR client with cookie-aware auth — same server component reads public catalogue for storefront or privileged CRUD data for admin |
| ④ | **GPT translation** | Localised product name, description, brand copy | Only fires for `lang !== 'kr'`; keyed by `(lang, productId, updatedAt)` — the `updatedAt` component auto-invalidates when admins edit a product |
| ⑤ | **unstable_cache** | 24h TTL cached translation JSON | First visitor per `(lang, product)` pays the GPT call, all subsequent visitors get sub-ms cache reads |
| ⑥ | **Region-aware render** | Same component tree, different CTAs | `/kr` → "Add to Cart" / checkout; `/gl` → "Where to Buy" + AI chatbot floating button |
| ⑦ | **AI chatbot** (`/gl` only) | `/api/chat` — per-IP 10/min rate limit | Stateless serverless; hydrates chatbot config from Supabase on each cold start, falls back to defaults if DB is unreachable |
| ⑧ | **Analytics + personalisation** | `localStorage` ring buffer + `/api/track` | Dual-sided capture powers the `/recent` page and admin view counts |

---

## 🧩 Admin CMS — 14+ modules

Every content surface on the site is backed by its own admin route with CRUD, image upload, and active/inactive toggles:

| Module | Route | What it controls |
|---|---|---|
| Dashboard | `/admin` | Login-gated entry, high-level counts |
| Products | `/admin/products` | Catalogue — name, price, images[], category, is_active |
| Users | `/admin/users` | Member list |
| Shorts | `/admin/shorts` | YouTube Shorts — parses video IDs, orders the homepage feed |
| Carousel | `/admin/carousel` | Hero-slider images + per-language captions |
| Sub-hero | `/admin/sub-hero` | Secondary banner block |
| Categories | `/admin/categories` | Product taxonomy |
| Menus → Posts | `/admin/menus/[menuId]/posts` | Community/blog hierarchy, Tiptap editor with image upload |
| Pages | `/admin/pages` | Static CMS pages at `/[lang]/pages/[slug]` |
| Promo Banners | `/admin/promo-banners` | Homepage promotion cards |
| Instagram | `/admin/instagram` | Manages the RSS.app-sourced feed, manual refresh |
| Chatbot | `/admin/chatbot` | Runtime config — model, greeting per language, enable/disable |
| Payments | `/admin/payments` | Checkout method configuration (Phase 2) |
| Legal | `/admin/legal` | Terms / Privacy content |
| Registration | `/admin/registration` | Signup gates |
| Media | `/admin/media` | Asset library |

Every module is a **separate App Router page with its own server component data layer** — no monolithic admin shell coupling them. Admin auth uses Supabase Auth with a mock fallback (`admin123` / `456789123`) when env vars are empty, so the repo is runnable zero-setup.

---

## 🛠 Tech Stack

**Frontend**
- **Next.js 16.2.2** App Router — Server Components, Server Actions, `unstable_cache`, dynamic routes with `[lang]` + `[id]` + `[slug]`
- **React 19** + **TypeScript 5**
- **Tailwind CSS 4** (utility-first, no component library — keeps bundle lean)
- **Embla Carousel 8** + Autoplay plugin for hero slider and product rails
- **Tiptap 3** (StarterKit + Image + Link) rich-text editor for community posts
- **Lucide React** icons

**Backend / Data**
- **Supabase** — PostgreSQL (source of truth), Auth (email/password), Storage (product images + post images)
- `@supabase/ssr` for cookie-aware auth inside the App Router
- **docx** for admin Word-export reporting

**AI**
- **OpenAI GPT-4o-mini** — on-demand product translation + `/gl` storefront chatbot
- **Next.js `unstable_cache`** — 24h TTL keyed on `(lang, productId, updatedAt)`

**Integrations**
- **RSS.app** — polls the brand's public Instagram feed; refreshed via `/api/instagram/refresh` (no Meta Graph API dependency or Instagram Business account needed)

**Infrastructure**
- **Vercel** — serverless deploy at [kokv2.vercel.app](https://kokv2.vercel.app/), edge-cached HTML, per-region function execution
- No dedicated CI/CD — Vercel builds on push to `master`

---

## 🗄 Database (Supabase)

| Table | Purpose |
|---|---|
| `users` | Member profiles, synced with `auth.users` |
| `products` | Catalogue — name, price, images[], is_active, category |
| `orders` | Order history (Phase 2) |
| `cart_items` | Cart rows keyed by user |
| `media_stories` | Brand story content blocks |
| `shorts` | YouTube Shorts IDs + ordering |
| `menus` / `posts` / `comments` | Community board hierarchy |
| `pages` | Static CMS pages |
| `promo_banners` · `carousel` · `sub_hero` | Home-page visual modules |
| `instagram_posts` | Cached embed URLs from RSS.app |
| `chatbot_config` | Runtime model + per-language greetings |
| `page_views` | Analytics from `/api/track` |

All tables carry `created_at`, `updated_at`, and `is_active` where applicable; admin pages filter on `is_active` for soft-delete semantics.

---

## 🌏 Supported Languages

`kr` 한국어 · `en` English · `cn` 中文 · `jp` 日本語 · `vn` Tiếng Việt · `th` ภาษาไทย

For any non-Korean language, product copy is translated on-demand by GPT-4o-mini and cached for 24 hours per `(lang, productId, updatedAt)`. When an admin edits a product in the CMS, `updatedAt` changes and the next visitor in that language triggers a fresh translation — no manual cache bust.

---

## 🎯 Design Highlights

**Single-codebase dual storefronts.** The `/kr` and `/gl` branches reuse the same server components — region is a prop, not a separate app. Reduces drift and makes every feature (product cards, footers, checkouts) automatically work in both contexts.

**Zero-setup demo mode.** The admin falls back to mock credentials and seed data when Supabase env vars are missing. The full app runs with `npm run dev` and nothing else — useful for portfolio demos, forks, and CI smoke tests.

**Translation as a cache, not a build step.** GPT translation fires at first-request time (not build time), so adding a product in the admin doesn't require a redeploy to localise it. The 24h `unstable_cache` keeps costs bounded while `updatedAt`-keyed invalidation guarantees stale translations get rewritten the moment content changes.

**No i18n library.** A typed translation dictionary + React Context is ~2KB; `i18next` + plugins is 40KB+. The static translations (UI chrome, menu labels) are deterministic, so the lightweight approach wins on bundle size and type safety.

**Instagram without Meta.** The brand has no Instagram Business account, so the Graph API is off the table. Polling a public RSS.app feed and storing rendered embed URLs gives us auto-refreshing Instagram content with no OAuth, no webhook infrastructure, and no monthly minimums.

**Admin as a collection of sibling pages, not a framework.** Every CMS module is a plain Next.js page — it can be rewritten, removed, or replaced without a "framework upgrade." The only shared piece is `/admin/layout.tsx` (auth gate + sidebar).

---

## 🚀 Getting Started

```bash
# install
npm install

# run dev server (http://localhost:3000)
npm run dev

# production build
npm run build && npm start

# lint
npm run lint
```

### Environment

```bash
NEXT_PUBLIC_SUPABASE_URL=        # required for real DB
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # required for real DB
OPENAI_API_KEY=                  # optional — enables GPT translation + chatbot
```

Without any env vars, the admin uses the mock fallback (`admin123` / `456789123`) and the storefront serves seeded mock data. Convenient for demos — wire Supabase up for real usage.

---

## 📐 Route Map

```
/                           → Geo-redirect (KR → /kr/kr, else → /gl/en)
/[lang]/                    → Home (HeroSlider + Shorts + Instagram + Products)
/[lang]/products            → Catalogue
/[lang]/products/[id]       → Product detail (translated, region-aware CTAs)
/[lang]/worldwide           → Where to buy abroad
/[lang]/menus/[slug]        → Community menu (posts list)
/[lang]/menus/[slug]/write  → Tiptap new-post editor
/[lang]/menus/[slug]/[id]   → Post detail + comment thread
/[lang]/mypage              → Member area
/[lang]/recent              → Recently viewed (localStorage + server)
/[lang]/pages/[slug]        → Static CMS pages
/[lang]/privacy · /terms · /support

/admin/*                    → 14+ CMS modules (see table above)

/api/chat                   → AI chatbot (IP rate-limited)
/api/chat/config            → Runtime chatbot config
/api/instagram/refresh      → RSS.app → Supabase sync
/api/track                  → Page-view analytics
```

---

## 📈 Roadmap

- **Phase 1 (current)** — Storefront UI, admin CRUD, mock cart, Tiptap community board, AI chatbot, 6-language GPT translation
- **Phase 2** — Real cart persistence, payment integration (KakaoPay / card), order fulfilment, shipping flow, member loyalty

---

## 🔒 Source

This repository is public for portfolio purposes. **Brand assets, product imagery, and copy are not licensed for commercial reuse.** Code patterns, architecture, and integrations are free to reference.

---

## 👤 Author

**Hyunsik Jeon**
- GitHub: [@jeonhs9110](https://github.com/jeonhs9110)

---

<p align="center"><sub>KOKKOK Garden V2 · Dual-region K-Beauty storefront · Deployed on Vercel Edge</sub></p>
