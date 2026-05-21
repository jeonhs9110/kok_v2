# 콕콕가든 V2

K-Beauty 멀티리전 이커머스. 한국 사용자는 구매 가능 스토어(`/kr`), 해외 사용자는 뷰잉 + AI 상담 스토어로 분기.

## 스택

- Next.js 16 (App Router) / React 19 / TypeScript 5
- Tailwind CSS 4
- Supabase (PostgreSQL + Auth + Storage)
- OpenAI GPT-4o-mini (자동 번역, 24h 캐시)
- Embla Carousel, Tiptap 3, Lucide React

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
/api/track               방문 트래킹
```

주 지원 언어: 한국어, 영어

## 개발 환경

```bash
npm install
npm run dev
```

환경변수 (`.env.local`):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
```

## 빌드 / 실행

```bash
npm run build
npm start
```

## 배포

- 개발: GitHub master → Vercel 자동 배포
- 운영: AWS ALB + EC2 (ap-northeast-2)
