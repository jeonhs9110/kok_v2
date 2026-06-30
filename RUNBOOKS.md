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

### 6. 회원 CSV 내보내기 (마케팅용)

1. `/admin/users` → 우측 상단 **CSV 내보내기** (녹색 버튼)
2. 다운로드되는 파일: `kokkok-customers-YYYY-MM-DD.csv`
3. UTF-8 BOM 포함 → Excel 더블클릭으로 한글 헤더 그대로 열림
4. 컬럼: 이메일, 이름, 권한, 전화번호, 성별, 생년월일, 국가, 피부 타입, 마케팅 동의, 이메일 인증, 가입일

### 7. 회원 권한 변경 (일반 ↔ 관리자)

1. `/admin/users` → 해당 행 클릭하여 상세 페이지 진입
2. **권한 변경** 버튼 (방패 모양 아이콘)
3. ⚠️ **super-admin 권한 필요**. 일반 admin은 권한 변경 불가.

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
- ALB target 확인 (AWS 콘솔 → EC2 → Target Groups → kokkok-tg) → 인스턴스가 healthy인지
- EC2 SSM Session Manager 접속 → `sudo journalctl -u kokkok -n 100` 로그 확인
- 환경변수 확인: `cat /etc/kokkok/env`
- 인스턴스 재시작: `terraform apply -replace=aws_instance.app` (infrastructure 디렉토리에서)

### B. 직전 배포 후 사이트 깨짐 → 롤백

**Quick path**:
1. AWS 콘솔 → S3 → `kokkok-deploy-artifacts/` 버킷
2. `latest.tar.gz` → 이전 정상 버전으로 덮어쓰기 (versioning 활성화되어 있음 → Object → Versions → 이전 버전 Restore)
3. `terraform apply -replace=aws_instance.app` → 새 EC2가 부팅 시 `latest.tar.gz`를 다시 받음
4. ~2-3분 후 `/api/health` 200 확인

**소스 단에서 revert**:
1. `git revert <bad-commit>` → master push
2. GitHub Actions가 자동으로 새 `latest.tar.gz` 생성
3. `terraform apply -replace=aws_instance.app`

### C. RDS 다운 / 응답 없음

**증상**: `/api/health`가 `rds.products: ok=false` 반환.

1. AWS 콘솔 → RDS → `kokkok-postgres` 인스턴스 상태 확인
2. CloudWatch Alarms 확인 (RDS CPU, 연결 수, 디스크 등)
3. AWS Health Dashboard (https://health.aws.amazon.com)에서 ap-northeast-2 RDS 장애 공지 확인
4. 짧은 장애면 자동 회복. 길어지면 RDS Snapshot에서 복구 (deletion protection 활성화되어 있어 실수 삭제 불가).
5. 복구 동안 storefront는 `unstable_cache` 덕분에 ~60초 동안 정상. TTL 만료 후 빈 상태.

### D. OpenAI API 키 만료 / 챗봇 503

**증상**: `/api/chat` 503 응답. 챗봇이 응답 안 함.

1. OpenAI dashboard에서 새 API 키 발급
2. `infrastructure/secrets.auto.tfvars`에서 `openai_api_key` 갱신
3. `cd infrastructure && terraform apply -replace=aws_instance.app`
4. 약 90초 후 새 인스턴스 healthy → `curl -X POST https://www.kokkokgarden.com/api/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"hi"}]}'`로 검증

### E. 운영자 비밀번호 잃어버림

1. `/login` 페이지 → **비밀번호 찾기** 클릭
2. 이메일 입력 → Cognito가 6자리 인증 코드 발송 (현재 발신처: Cognito 기본 sender. SES 승인 후 `noreply@kokkokgarden.com`)
3. 메일 수신 → `/forgot-password` 화면에서 코드 + 새 비밀번호 입력
4. 변경 완료 → 새 비밀번호로 로그인

**메일이 안 오면**:
- 스팸함 확인 (현재 Cognito 기본 sender는 도메인 신뢰도 낮음)
- 그래도 없으면: 개발자가 AWS 콘솔 → Cognito → User Pool → 해당 사용자 → "Reset password" 수동 발급

### F. 인스타그램 임베드가 회색 상자로 보임

1. Instagram 측 차단 (rate limit / 차단 IP) 가능성
2. 다른 네트워크에서 확인 → 사용자에게도 동일 증상이면 RSS 다시 새로고침 (`/admin/instagram` → RSS 갱신)
3. 지속되면 Instagram Graph API 토큰 갱신 필요 — 개발자 협조

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

**Q. 가입 인증 메일이 스팸함으로 들어감**
- 현재 Cognito 기본 sender 사용 중. AWS SES production access 승인되면 `noreply@kokkokgarden.com`으로 전환되어 정상화 예정. 그때까지는 고객 안내문구에 "스팸함도 확인해주세요" 포함 권장.
