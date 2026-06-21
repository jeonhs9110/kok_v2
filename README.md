# 콕콕가든 V2

K-Beauty 멀티리전 이커머스. 한국 사용자는 구매 가능 스토어(`/kr`), 해외 사용자는 뷰잉 + AI 상담 스토어로 분기.

## 스택

- Next.js 16 (App Router) / React 19 / TypeScript 5
- Tailwind CSS 4
- Supabase (PostgreSQL + Auth + Storage)
- OpenAI GPT-4o-mini (자동 번역, 24h 캐시)
- Embla Carousel, Tiptap 3, Lucide React

## 아키텍처

```
[Vercel / EC2] ───────► Next.js (SSR + RSC)
       │                 │
       │                 ├─► Supabase (DB + Auth + Storage)
       │                 ├─► OpenAI (챗봇 + 번역)
       │                 └─► RSS / Naver scrape
       │
       └─► ALB ─► t4g.small EC2 (운영) — 향후 t3a로 이전 (Phase 2)
```

- 스토어프론트는 RSC 중심 (한 페이지에 9~10개 unstable_cache 채널)
- 관리자(`/admin/*`)는 hook-orchestrated 패턴 — 매 페이지가 단일 `useXxx` 훅을 통해 데이터 + 핸들러를 받음
- 인증: Supabase JWT를 미들웨어에서 검증 (`src/middleware.ts`). 레거시 `kokkok_admin_auth` 쿠키 경로는 차단됨.
- RLS: products / categories / menus / users / 모든 admin-edited 테이블에 적용. 자세한 단계는 `supabase/migrations/00000000000017+_rls_*.sql` 참조.

## 라우트 개요

```
/                        지역 자동 리다이렉트
/[lang]/                 홈
/[lang]/products         상품 목록
/[lang]/products/[id]    상품 상세
/[lang]/worldwide        글로벌 판매처
/[lang]/menus/[slug]     게시판 / CMS 페이지
/cart                    장바구니
/login, /register        인증
/admin/*                 관리자 (14개 모듈)
/api/chat                AI 챗봇
/api/health              ALB 헬스 체크
/api/track               방문 트래킹
```

주 지원 언어: 한국어, 영어 (cn / jp / vn / th 콘텐츠 컬럼 지원)

## 개발 환경

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev                  # localhost:3000
```

### 환경변수

전체 목록 + 설명: [`.env.example`](.env.example)

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 필수 (빌드 타임 inline)
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 측 전용 (RLS bypass). 절대 클라이언트로 노출 금지.
- `OPENAI_API_KEY` — 챗봇용

> ⚠️ Vercel + EC2 둘 다에 동일한 키를 설정해야 함. 한쪽만 누락되면 storefront가 빈 화면 (메모리에 기록된 과거 사고).

## 빌드 / 실행

```bash
npm run build              # 표준 빌드
npm start                  # standalone 실행
npm run analyze            # 번들 크기 분석 (ANALYZE=true 모드)
npm run lint               # ESLint
npx tsc --noEmit           # 타입 체크
npm run test:e2e           # Playwright e2e (smoke + admin)
```

### e2e 사전 조건

관리자 e2e는 `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD`가 있어야 실행됨 (없으면 자동 skip):

```
# .env.test.local
E2E_ADMIN_EMAIL=admin@kokkok.com
E2E_ADMIN_PASSWORD=...
```

## CI

- `.github/workflows/pr-checks.yml` — 모든 PR에서 tsc + ESLint 통과 강제
- `.github/workflows/build-publish-artifact.yml` — master merge 시 standalone 빌드 → S3 (`kokkok-deploy-artifacts/latest.tar.gz` + `master-<commit>.tar.gz`)

## 배포

| 환경 | 호스트 | 트리거 |
|---|---|---|
| Preview | Vercel | 모든 PR 자동 |
| 개발 미러 | Vercel `kok_v2` 프로젝트 | master push |
| 운영 | AWS EC2 t4g.small (ap-northeast-2) | master merge → S3 → EC2 user-data refetches |

운영 배포 절차 + 롤백 단계: [`RUNBOOKS.md`](RUNBOOKS.md)

## 추가 문서

- [`.env.example`](.env.example) — 환경변수 레퍼런스
- [`RUNBOOKS.md`](RUNBOOKS.md) — 운영자 일상 작업 + 비상 상황 대응
- [`tests/e2e/README.md`](tests/e2e/README.md) — e2e 작성 가이드
</content>
