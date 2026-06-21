# 관리자 운영 매뉴얼

운영자가 자주 수행하는 작업 + 장애 대응 절차. 모든 절차는 `/admin` 로그인 상태를 전제로 함.

---

## 일상 작업

### 1. 새 상품 등록

1. `/admin/products` → 상단의 **상품 추가** 클릭
2. 모달이 열리면 순서대로:
   - 메인 이미지 업로드 (5:6 비율 권장, 95% 품질)
   - 상품명 / 성분 태그 / 카테고리 / 서브카테고리
   - 가격 + 정가 (할인 표시 자동 계산)
   - 한 줄 요약 (`summary`) + 한 줄 설명 (`description`)
   - 상세페이지 컴포넌트 → 이미지/영상/YouTube를 위→아래 순서로 추가
   - 네이버 스토어 URL (구매 버튼 연결)
   - **Best Seller로 노출** 체크 → 홈 메인 BEST SELLER에 추가
3. **상품 저장** → 자동으로 `/admin/products` 목록으로 복귀
4. 확인: 새로고침 → 목록 최상단에 보이는지 + 활성 상태 표시 확인

> 상세 컴포넌트 영상은 30MB 이하 권장. 30MB 초과 시 확인 모달 자동 표시.

### 2. 홈페이지 섹션 순서 변경

1. `/admin/homepage` → 좌측 섹션 카드 리스트
2. 카드를 위/아래로 드래그 → 즉시 저장 + 우측 1440px 미리보기 갱신
3. **theme / logo / menus / top-stripe / footer**는 고정 (드래그 불가)
4. 띠배너 추가:
   - 그룹 제목 우측 `+` → 띠배너 카드가 carousel 위에 자동 삽입
   - 편집 드로어 자동 열림 → 텍스트 / 색상 / 링크 입력 → **저장**

> 드래그 실수 시 페이지 새로고침으로 마지막 저장된 순서가 다시 표시되지 않음 (즉시 저장됨). 신중하게 드래그.

### 3. 푸터 사업자 정보 / 전화번호 수정

1. `/admin/legal` → **사업자 정보** 아코디언 펼치기
2. 수정 가능 필드:
   - 상호 (한국어 / 영어), 대표자명, 사업자등록번호, 통신판매업신고번호
   - 주소 (한국어 / 영어), 대표 전화번호, 대표 이메일
   - 은행명, 계좌번호, 예금주
   - Instagram URL, YouTube URL
   - 고객센터 운영시간 / 점심시간 / 휴무일 (한 / 영)
   - 개인정보 보호책임자명 + 이메일
3. 푸터 표시 항목 토글로 그룹별 노출 제어 (회사 정보, 주소, 이메일, 전화, 운영시간, 계좌, SNS)
4. **사업자 정보 저장** → 60초 이내 storefront 반영 (헤더 캐시 즉시 evict)

### 4. 약관 / 개인정보처리방침 편집

1. `/admin/legal` → **이용약관** 또는 **개인정보처리방침**
2. 언어 토글 (한국어 / 영어) → 제목 + 본문 입력
3. **공개** 체크 후 **저장** → `/terms` 또는 `/privacy`에서 확인 가능

### 5. 캐러셀 슬라이드 추가

1. `/admin/carousel` → **슬라이드 추가**
2. 모달 좌측 폼:
   - **PC 이미지** (필수, 2400×1500px 이상 권장) — 1000px 미만이면 흐림 경고 자동 표시
   - **모바일 이미지** (선택, 1200×1500 또는 1080×1920) — 비워두면 PC 이미지 사용
   - 배지 / 제목 / 서브타이틀 → 언어 탭으로 다국어
   - 색상 / 폰트 / 타이포그래피 → 우측 미리보기에 실시간 반영
   - 위치 anchor → 미리보기에서 클릭으로 텍스트 / 이미지 초점 위치 지정
3. **슬라이드 저장** → 60초 이내 홈에 반영

---

## 장애 대응

### A. 사이트가 안 열림

**증상**: `https://www.kokkokgarden.com` 접속 시 502 / 503 / 무한 로딩.

**1차 확인**:
```bash
curl -i https://www.kokkokgarden.com/api/health
```

- `200 OK` + `{ status: "ok" }` → 사이트는 살아있음. CDN / 브라우저 캐시 문제 가능성
- `503` + `{ status: "degraded", checks: {...} }` → 어느 의존성이 죽었는지 응답 본문에서 확인
- 응답 없음 / 타임아웃 → ALB or EC2 자체가 다운

**2차 조치**:
- ALB target 확인 → EC2 인스턴스가 healthy인지
- EC2 SSH 접속 → `sudo journalctl -u kokkok -n 100` 로그 확인
- 환경변수 누락 의심 시 → `sudo systemctl show kokkok | grep Environment`

### B. 직전 배포 후 사이트 깨짐 → 롤백

**전제**: 운영자가 SSH 키 + IAM PassRole 권한 미보유 (Phase 2 작업). 현재는 권대영 (zero@dynamicsolution.co.kr) 협조 필요.

**Quick path** (권대영 통해):
1. S3 콘솔 → `kokkok-deploy-artifacts/` 버킷
2. `latest.tar.gz` → 이전 정상 커밋의 `master-<commit>.tar.gz`로 덮어쓰기 (objects → restore version)
3. EC2 인스턴스 재시작 → user-data가 `latest`를 다시 받아 standalone 시작
4. ~2~3분 후 `/api/health` 200 확인

**Phase 2 완료 시 자동화 예정**: `scripts/rollback.sh <commit-sha>` 한 줄로 수행.

### C. Supabase 다운 / 응답 없음

1. https://status.supabase.com 확인
2. 다운 확인되면 → 운영자 대시보드 (`/admin/*`) 일시적으로 사용 불가, storefront는 unstable_cache 덕분에 ~60초 동안은 정상 (TTL 만료 후 빈 상태)
3. 복구되면 자동 회복. 운영자에게 "1시간 내 복구 예정" 공지만 전달.

### D. OpenAI API 키 만료

**증상**: `/api/chat` 503 응답. 해외 사용자의 챗봇이 응답 안 함.

1. OpenAI dashboard → 새 API 키 발급
2. Vercel + EC2 양쪽에 `OPENAI_API_KEY` 갱신
   - Vercel: Project → Settings → Environment Variables
   - EC2: `/etc/systemd/system/kokkok.service` 환경변수 수정 → `sudo systemctl daemon-reload && sudo systemctl restart kokkok`
3. `curl /api/chat -X POST -d '{"message":"test"}'`로 검증

### E. 운영자 비밀번호 잃어버림

**전제**: 운영자에게 Supabase auth 계정이 있어야 함 (현재 미발급 — pending 작업).

**계정 발급 후 절차**:
1. `/login` → "비밀번호 찾기" → 이메일 입력
2. 메일 수신 → 링크 클릭 → `/auth/reset-password` 이동
3. 새 비밀번호 설정

**계정 미발급 상태**:
1. 개발자에게 임시 비밀번호 요청 (Supabase 콘솔에서 직접 발급)
2. 첫 로그인 후 즉시 비밀번호 변경

---

## 자주 묻는 질문

**Q. 상품 저장 후 홈 메인에 안 보임**
- BEST SELLER 체크가 되어 있는지 확인
- 카테고리 미선택 시 일부 영역에서 미노출 → 카테고리 지정
- 최대 60초 캐시 대기. 그래도 안 보이면 `/admin/homepage`에서 섹션 카드의 "활성" 카운트가 늘었는지 확인

**Q. 띠배너 삭제하니까 홈에서 빈 줄이 보임**
- `/admin/homepage`의 섹션 순서에 `banner:<삭제된id>`가 남아 있어서. 다른 띠배너 추가 → 드래그로 그 자리 차지 → 빈 항목은 자동 무시됨

**Q. 헤더 메뉴 폰트 변경 후 모바일에서 글자가 안 바뀜**
- `/admin/theme` "헤더 메뉴 글씨 크기"는 데스크탑 + 모바일 동시 적용. 변경 후 60초 대기 + 모바일 브라우저 캐시 새로고침

**Q. 인스타그램 임베드가 회색 상자로 보임**
- Instagram 측 차단 (rate limit / 차단 IP) 가능성. 다른 네트워크에서 확인 → 사용자에게도 동일 증상이면 RSS 다시 새로고침 (`/admin/instagram` → RSS 갱신)
</content>
