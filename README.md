<h1 align="center">KOKKOK Garden V2</h1>
<h3 align="center">K-Beauty Multi-Region E-Commerce Platform — 한국 화장품 글로벌 이커머스</h3>

<p align="center">
  <em>A dual-storefront Next.js 16 platform that splits Korean shoppers (checkout-enabled) from international visitors (view-only + AI concierge), with real-time GPT translation across six languages and a full admin CMS.</em><br>
  <sub>Next.js 16 App Router · React 19 · Supabase · OpenAI GPT-4o-mini · Tailwind 4 · Tiptap · Embla · Vercel</sub>
</p>

<p align="center">
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16.2-000000?logo=nextdotjs&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20Storage-3ECF8E?logo=supabase&logoColor=white">
  <img alt="OpenAI" src="https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?logo=openai&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-4-38B2AC?logo=tailwindcss&logoColor=white">
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-deployed-000000?logo=vercel&logoColor=white">
  <img alt="Status" src="https://img.shields.io/badge/status-live-brightgreen">
</p>

<p align="center">
  <b>Live:</b> <a href="https://kokv2.vercel.app/">kokv2.vercel.app</a><br>
  <sub>(Auto geo-split — KR → Korean storefront · others → global view-only)</sub>
</p>

---

## 🇰🇷 프로젝트 개요 (한국어)

**KOKKOK Garden V2**는 한국 화장품(K-Beauty) 브랜드를 위한 **이중 지역(dual-region) 이커머스 플랫폼**입니다. 사용자의 국가를 자동 판별하여 한국 사용자는 구매 가능한 스토어(`/kr`)로, 해외 사용자는 **뷰잉 전용 + AI 챗봇 컨시어지** 스토어(`/gl`)로 분기시키는 구조를 Next.js 16 App Router 위에서 구현했습니다. 모든 라우트는 `[lang]` 동적 세그먼트로 래핑되어 **한국어·영어·중국어·일본어·베트남어·태국어 6개 언어**를 지원하며, 한국어 이외의 언어로 접속할 경우 OpenAI **GPT-4o-mini**가 상품명·설명·브랜드 카피를 실시간으로 번역하고 Next.js `unstable_cache`로 **24시간 캐싱**하여 호출 비용을 최소화합니다.

복잡도 측면에서는 단순한 "쇼핑몰 템플릿"이 아니라 **풀스택 운영 도구**로 설계되었습니다. Supabase(PostgreSQL + Auth + Storage) 위에 상품(`products`)·주문(`orders`)·장바구니(`cart_items`)·회원(`users`)·브랜드 스토리(`media_stories`)·쇼츠(`shorts`)·게시판(`menus`/`posts`)·댓글(`comments`)·프로모션 배너·결제 설정·법적 고지 페이지까지 **14개 이상의 관리자 모듈**이 별도 라우트(`/admin/*`)로 분리되어 있으며, 각 모듈은 이미지 업로드(Supabase Storage), CRUD, 다국어 필드 관리, 활성/비활성 토글을 독립적으로 수행합니다. 에디터는 **Tiptap + Tiptap Image/Link 확장**으로 리치 텍스트 게시물 작성을 지원하고, 홈페이지 캐러셀은 **Embla Carousel + Autoplay 플러그인**으로 자동 재생, Instagram 섹션은 공식 Instagram 임베드 URL + **RSS.app 기반 자동 갱신**으로 최신 포스트를 서버리스로 주기적 폴링합니다.

AI 레이어는 두 축으로 구성됩니다 — ① **GPT 번역 파이프라인**은 언어 코드가 `kr`이 아닐 때만 작동하며 상품/페이지 렌더링 전에 서버 컴포넌트 레벨에서 해석되어 **클라이언트에 이미 번역된 JSON을 흘려보냅니다**. ② **글로벌 스토어 AI 챗봇**은 `/api/chat` 엔드포인트에서 **IP 기반 레이트 리미팅(분당 10회)**과 Supabase에 저장된 동적 챗봇 설정(모델·그리팅·활성 여부)을 결합하여 해외 방문자에게 상품 안내와 브랜드 설명을 제공합니다. 인증 계층에는 Supabase Auth 외에 **목업 관리자 폴백(`admin123`/`456789123`)**이 있어 환경변수가 비어 있을 때도 어드민이 동작하며, 모든 접근은 `kokkok_admin_auth` 쿠키로 보호됩니다.

**핵심 기술적 의사결정**으로는 ① 다국어를 i18next 같은 라이브러리 없이 **React Context + 타입 세이프 번역 딕셔너리**로 직접 구현하여 번들 크기를 줄였고, ② 지역 분기를 미들웨어가 아닌 **`x-user-country` 헤더 기반 리다이렉트**로 처리해 CDN 캐시 친화적으로 만들었으며, ③ 최근 본 상품·방문 통계는 `localStorage` + `/api/track` 엔드포인트로 **클라이언트·서버 이중 집계**하여 개인화 데이터를 축적합니다. 전체 애플리케이션은 **Vercel에 서버리스로 배포**되며 (`kokv2.vercel.app`) 한국어 방문자와 해외 방문자 모두 동일 엣지 네트워크에서 동일 지연으로 서빙됩니다.

---

## 🎯 What is this?

KOKKOK Garden V2 is a **production-ready K-beauty commerce platform** built around one observation: Korean cosmetics brands sell in *two fundamentally different modes* at once.

- **Korean shoppers** expect a normal checkout flow — cart, payment, shipping, Korean-language product copy.
- **International browsers** discover K-beauty on Instagram/TikTok but **can't actually buy** (the brand ships only inside Korea) — so they need a **view-only showcase** that explains the product, shows where to buy abroad, and answers questions in their own language via an AI concierge.

The system auto-detects the visitor's country and serves the right experience without the user ever choosing. Everything else — admin CMS, translations, payments config, content — is one codebase.

---

## 🧠 Architecture

```
                       ┌────────────────────┐
                       │  Visitor Request   │
                       │  x-user-country: ? │
                       └─────────┬──────────┘
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
      ┌──────────────────┐              ┌──────────────────┐
      │   /kr  (Korea)   │              │   /gl  (Global)  │
      │   checkout-on    │              │   view-only      │
      │   Korean copy    │              │   + AI chatbot   │
      └────────┬─────────┘              └────────┬─────────┘
               │                                 │
               │            ┌────────────────────┘
               ▼            ▼
      ┌──────────────────────────────┐     ┌──────────────────┐
      │   [lang] dynamic segment     │────▶│  GPT-4o-mini     │
      │   kr · en · cn · jp · vn · th│     │  translate (24h  │
      └──────────┬───────────────────┘     │  unstable_cache) │
                 ▼                          └──────────────────┘
      ┌──────────────────────────────┐
      │   Supabase (Postgres/Auth/   │
      │   Storage) — products, orders│
      │   users, menus, posts,       │
      │   comments, shorts, media…   │
      └──────────────────────────────┘
                 ▲
                 │
      ┌──────────┴───────────────────┐
      │   /admin/*   (14+ modules)   │
      │   Tiptap editor · image CDN  │
      │   per-module CRUD + i18n     │
      └──────────────────────────────┘
```

---

## 🔑 Key complexity

| Layer | What it does | Why it's non-trivial |
|---|---|---|
| **Dual-region routing** | Korean visitors land at `/kr/kr`, everyone else at `/gl/en` | Branches run on the same codebase — same components read a `region` prop and conditionally render cart/checkout vs. "where to buy" CTAs |
| **Six-language i18n** | KR · EN · CN · JP · VN · TH, typed translation dictionaries, no i18n library | Built on React Context + server-resolved translation; lighter bundle than i18next, type-safe at compile time |
| **GPT translation layer** | Product name / description / brand copy translated on-the-fly for non-KR languages | `unstable_cache` keyed on `(lang, productId, updatedAt)` with 24h TTL — first hit pays the API, every other visitor gets sub-ms cache reads |
| **Admin CMS (14+ modules)** | Products · Users · Shorts · Carousel · Categories · Menus → Posts → Comments · Pages · Promo banners · Instagram feed · Chatbot config · Payments · Legal · Registration | Each module has its own CRUD page, image upload to Supabase Storage, active/inactive toggling, and independent multi-language fields |
| **Rich-text editor** | Tiptap 3 (StarterKit + Image + Link) for menu posts with Korean content | Nested `[lang]/menus/[slug]/[postId]` route hierarchy with edit mode, comment thread, and per-language rendering |
| **AI chatbot** | `/api/chat` — per-IP rate limit (10/min), dynamic config pulled from Supabase, greeting per language | Stateless serverless handler that lazily hydrates chatbot config on every cold start, falls back to a default when DB is unreachable |
| **Instagram integration** | Official Instagram embed URLs + RSS.app auto-refresh endpoint (`/api/instagram/refresh`) | Avoids paying for the Graph API by polling the brand's public RSS feed and re-writing stored embeds when new posts drop |
| **Analytics** | `/api/track` endpoint + `localStorage` "recently viewed" | Client-side ring buffer + server-side event capture; powers the `/recent` personalization page |
| **Auth** | Supabase Auth for real accounts + **mock admin fallback** when env vars are absent | Makes the repo runnable with zero setup (demo mode) while remaining production-correct when configured |

---

## 📁 Route map

```
/                           → Geo-redirect (KR → /kr/kr, else → /gl/en)
/[lang]/                    → Storefront home (HeroSlider + Shorts + Instagram + Products)
/[lang]/products            → Catalogue
/[lang]/products/[id]       → Product detail (translated, region-aware CTAs)
/[lang]/worldwide           → "Where to buy abroad"
/[lang]/menus/[slug]        → Community/blog menu (posts list)
/[lang]/menus/[slug]/write  → Tiptap editor — new post
/[lang]/menus/[slug]/[id]   → Post detail + comment thread
/[lang]/mypage              → Member area
/[lang]/recent              → Recently viewed (localStorage-driven)
/[lang]/pages/[slug]        → Static CMS pages
/[lang]/privacy · /terms · /support

/admin                      → Dashboard
/admin/products             → Product CRUD + image upload
/admin/users                → Members
/admin/shorts               → YouTube Shorts curation
/admin/carousel             → Hero slider images
/admin/sub-hero             → Secondary banner
/admin/categories           → Taxonomy
/admin/menus                → Community menus → /admin/menus/[menuId]/posts
/admin/pages                → Static CMS pages
/admin/promo-banners        → Promotion cards
/admin/instagram            → Instagram posts + RSS refresh
/admin/chatbot              → AI chatbot config (model, greetings, enable)
/admin/payments             → Payment settings
/admin/legal                → ToS / Privacy content
/admin/registration         → Signup toggles
/admin/media                → Media library

/api/chat                   → AI chatbot (rate-limited)
/api/chat/config            → Runtime chatbot config
/api/instagram/refresh      → RSS.app → Supabase sync
/api/track                  → Page-view analytics
```

---

## 🛠 Tech Stack

**Frontend**
- **Next.js 16.2.2** App Router (Server Components + Server Actions)
- **React 19** + **TypeScript 5**
- **Tailwind CSS 4** (utility-first, no component library)
- **Embla Carousel 8** + Autoplay plugin
- **Tiptap 3** rich-text editor (StarterKit + Image + Link)
- **Lucide React** icons

**Backend / Data**
- **Supabase** — PostgreSQL (source of truth), Auth (with email/password), Storage (product images)
- **Supabase SSR client** for server-component data fetching
- Supabase `@supabase/ssr` for cookie-aware auth in App Router

**AI**
- **OpenAI GPT-4o-mini** — product translation + global-storefront chatbot
- **Next.js `unstable_cache`** — 24h TTL on translated product JSON

**Infra**
- **Vercel** — serverless deploy (`kokv2.vercel.app`)
- **RSS.app** — Instagram feed polling (no Meta Graph API dependency)
- **docx** — Word export for admin reporting

---

## 🗄 Database (Supabase)

| Table | Purpose |
|---|---|
| `users` | Member profiles, synced with `auth.users` |
| `products` | Catalogue — name, price, images[], is_active, category |
| `orders` | Order history (Phase 2) |
| `cart_items` | Cart rows keyed by user |
| `media_stories` | Brand story content blocks |
| `shorts` | YouTube Shorts IDs + metadata |
| `menus` / `posts` / `comments` | Community/blog hierarchy |
| `pages` | Static CMS pages |
| `promo_banners` · `carousel` · `sub_hero` | Home-page visual modules |
| `instagram_posts` | Cached embed URLs from RSS.app |
| `chatbot_config` | Runtime model + greetings |
| `page_views` | Analytics from `/api/track` |

---

## 🌏 Supported Languages

`kr` 한국어 · `en` English · `cn` 中文 · `jp` 日本語 · `vn` Tiếng Việt · `th` ภาษาไทย

For any `lang !== 'kr'`, product copy is translated through GPT-4o-mini and cached for 24 hours per `(lang, productId, updatedAt)` tuple.

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
NEXT_PUBLIC_SUPABASE_URL=        # required
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # required
OPENAI_API_KEY=                  # optional — enables GPT translation + chatbot
```

Without any env vars, the admin still works via the mock fallback (`admin123` / `456789123`) and the storefront runs against seeded mock data — convenient for demos, but you'll want Supabase wired up for real usage.

---

## 📦 Project Structure

```
src/
├── app/
│   ├── [lang]/                    # language-scoped storefront
│   │   ├── page.tsx               # home
│   │   ├── products/              # list + detail
│   │   ├── menus/[slug]/          # community posts
│   │   ├── mypage/ recent/ worldwide/
│   │   ├── pages/[slug]/          # CMS pages
│   │   └── privacy/ terms/ support/
│   ├── admin/                     # 14+ CMS modules
│   ├── api/
│   │   ├── chat/                  # AI chatbot + config
│   │   ├── instagram/refresh/     # RSS sync
│   │   └── track/                 # analytics
│   └── sitemap.ts
├── components/
│   ├── Header · Footer · HeroSlider · PromoBanner · ShortsFeed
│   ├── InstagramSection · ProductCard · ProductGrid · Pagination
│   ├── AIChatbot · CookieConsent · LanguagePicker
│   ├── RecentViewTracker · PageTracker
│   ├── comments/ (Form · Item · Section)
│   └── pages/ (MenuPage · PostDetailPage · PostWritePage · MyPage)
└── lib/
    ├── api/             # product API + mock seed data
    ├── cart/            # cart logic
    ├── i18n/            # typed translation dictionaries
    ├── openai.ts        # GPT translation + caching
    └── supabase/        # browser + server clients
```

---

## 📈 Roadmap

- **Phase 1 (current)** — Storefront UI, admin CRUD, mock cart, Tiptap community board, AI chatbot, 6-language translation
- **Phase 2** — Real cart persistence, payment integration (KakaoPay / card), order fulfilment, shipping, member loyalty

---

## 🪪 License

Source is public for portfolio purposes. Commercial reuse of brand assets, product imagery, and copy is not permitted.
