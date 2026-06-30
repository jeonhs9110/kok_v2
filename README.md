# 콕콕가든 V2

K-Beauty 멀티리전 이커머스. 한국 사용자는 구매 가능 스토어(`/kr`), 해외 사용자는 뷰잉 + AI 상담 스토어로 분기.

## 스택

- Next.js 16 (App Router) / React 19 / TypeScript 5
- Tailwind CSS 4
- AWS RDS PostgreSQL 16 (데이터 저장)
- AWS Cognito (인증)
- AWS S3 + CloudFront (`/media/*` 정적 자산)
- AWS SES (이메일 발송)
- OpenAI GPT-4o-mini (자동 번역, 24h 캐시)
- Embla Carousel, Tiptap 3, Lucide React

## 아키텍처

```
Yesnic(레지스트라)
   └─► Route 53 (DNS, AWS 권한)
         └─► CloudFront
               ├─► ALB ─► EC2 t4g.small (ap-northeast-2)
               │           └─► Next.js (SSR + RSC)
               │                 ├─► RDS Postgres (DB)
               │                 ├─► Cognito (인증)
               │                 ├─► S3 / CloudFront (이미지 + 영상)
               │                 ├─► SES (트랜잭션 메일)
               │                 ├─► OpenAI (챗봇)
               │                 └─► Instagram RSS / Naver scrape
               │
               └─► S3 (kokkok-media → /media/*)
```

- 스토어프론트는 RSC 중심 (한 페이지에 9~10개 `unstable_cache` 채널)
- 관리자(`/admin/*`)는 hook-orchestrated 패턴 — 매 페이지가 단일 `useXxx` 훅을 통해 데이터 + 핸들러를 받음
- 인증: `src/proxy.ts` 미들웨어가 Cognito ID 토큰(JWT) 쿠키를 검증. `cognito:groups` 클레임으로 `/admin/*` 권한 차단
- 권한: RDS에서는 application-level role-based access (Cognito의 `admins` / `super_admins` 그룹). 관리자 변경/삭제는 super-admin 한정.

## 라우트 개요

```
/                        지역 자동 리다이렉트 (CloudFront-viewer-country)
/[lang]/                 홈
/[lang]/products         상품 목록
/[lang]/products/[id]    상품 상세
/[lang]/worldwide        글로벌 판매처
/[lang]/menus/[slug]     게시판 / CMS 페이지
/[lang]/pages/[slug]     관리자 빌더로 만든 페이지
/[lang]/reviews/[id]     리뷰 카드 상세
/cart                    장바구니
/login, /register        Cognito 인증
/forgot-password         비밀번호 재설정 코드 발송
/admin/*                 관리자 (홈 빌더 + 상품 + 회원 + 결제 등 25개+ 모듈)
/api/chat                AI 챗봇 (OpenAI)
/api/health              ALB 헬스 체크 (RDS ping)
/api/track               방문 트래킹 (분석)
/sitemap.xml             동적 sitemap (request 시점에 RDS 조회)
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

- `DATABASE_URL` — RDS Postgres 연결 문자열 (필수)
- `USE_RDS=true` — RDS 디스패처 활성화
- `USE_COGNITO=true`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` — Cognito 인증
- `USE_S3=true`, `S3_STORAGE_BUCKET`, `S3_PUBLIC_CDN_URL` — S3+CloudFront 자산 경로
- `OPENAI_API_KEY` — 챗봇용
- `ANALYTICS_IP_SALT` — IP 해시용 솔트

## 빌드 / 실행

```bash
npm run build              # 표준 빌드 (Next.js standalone)
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

## CI / CD

- `.github/workflows/pr-checks.yml` — 모든 PR에서 tsc + ESLint + 빌드 통과 강제
- `.github/workflows/build-publish-artifact.yml` — master merge 시 standalone 빌드 → S3 (`kokkok-deploy-artifacts/latest.tar.gz`)
- EC2 user-data가 부팅 시 `latest.tar.gz`를 받아 standalone 시작 (Phase 2A)

## 배포

| 단계 | 호스트 | 트리거 |
|---|---|---|
| 빌드 | GitHub Actions (Bitbucket Pipelines 미러) | master push |
| 아티팩트 | S3 `kokkok-deploy-artifacts` | GHA 자동 업로드 |
| 운영 | AWS EC2 t4g.small (ap-northeast-2) | `terraform apply -replace=aws_instance.app` → EC2 user-data 재실행 → 새 인스턴스 healthy 시 ALB 자동 절체 |

운영 배포 절차 + 롤백 단계: [`RUNBOOKS.md`](RUNBOOKS.md)

## 추가 문서

- [`.env.example`](.env.example) — 환경변수 레퍼런스
- [`RUNBOOKS.md`](RUNBOOKS.md) — 운영자 일상 작업 + 비상 상황 대응
- [`infrastructure/`](infrastructure/) — Terraform (AWS 인프라 전체)
- [`tests/e2e/README.md`](tests/e2e/README.md) — e2e 작성 가이드
