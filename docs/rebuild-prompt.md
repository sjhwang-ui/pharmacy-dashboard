# 퓨어약국 마케팅 대시보드 재구축 프롬프트

이 문서를 Claude Code에 붙여넣으면 대시보드를 처음부터 똑같이 만들 수 있습니다.

---

## 사전 준비 (직접 해야 하는 것)

### 1. Supabase 프로젝트 생성
1. supabase.com 가입 → New Project 생성
2. SQL Editor에서 아래 쿼리 실행

```sql
CREATE TABLE store_sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL, store VARCHAR(20) NOT NULL,
  amount DECIMAL(12,2) NOT NULL, count INTEGER NOT NULL,
  avg_order_value DECIMAL(12,2), scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, store)
);
CREATE TABLE tax_refund_sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL, store VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL, amount DECIMAL(12,2) NOT NULL,
  count INTEGER NOT NULL, scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, country, store)
);
CREATE TABLE hourly_sales (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL, store VARCHAR(20) NOT NULL,
  hour INTEGER NOT NULL, count INTEGER NOT NULL,
  amount DECIMAL(12,2) NOT NULL, scraped_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(date, store, hour)
);
CREATE TABLE influencer_ppl (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL, name VARCHAR(200) NOT NULL,
  engagement INTEGER DEFAULT 0, note TEXT, cost INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE owned_media (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  platform VARCHAR(20) NOT NULL, date DATE NOT NULL,
  content_note TEXT, views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0, saves INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0, comments INTEGER DEFAULT 0,
  cost INTEGER, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE slack_threads (
  thread_ts TEXT PRIMARY KEY,
  messages JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE store_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_refund_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE hourly_sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_ppl DISABLE ROW LEVEL SECURITY;
ALTER TABLE owned_media DISABLE ROW LEVEL SECURITY;
ALTER TABLE slack_threads DISABLE ROW LEVEL SECURITY;
```

3. Project Settings → API에서 URL과 anon key 복사

### 2. .env.local 파일 준비
```
GTFETRS_MD_ID=           # gtfetrs 명동 아이디
GTFETRS_MD_PW=           # gtfetrs 명동 비밀번호
GTFETRS_SS_ID=           # gtfetrs 성수 아이디
GTFETRS_SS_PW=           # gtfetrs 성수 비밀번호
ALLTHATPAY_MD_ID=        # 올댓페이 명동 아이디
ALLTHATPAY_MD_PW=        # 올댓페이 명동 비밀번호
ALLTHATPAY_SS_ID=        # 올댓페이 성수 아이디
ALLTHATPAY_SS_PW=        # 올댓페이 성수 비밀번호
NEXT_PUBLIC_SUPABASE_URL=        # Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon key
ANTHROPIC_API_KEY=       # AI 분석용 (console.anthropic.com)
SLACK_SIGNING_SECRET=    # Slack 앱 설정에서 복사
SLACK_BOT_TOKEN=         # Slack 앱 설정에서 복사
```

---

## Claude Code에 붙여넣을 프롬프트

```
퓨어약국 마케팅 대시보드를 처음부터 만들어줘.

## 배경
명동·성수 두 매장을 운영하는 K-뷰티 약국. 주요 고객은 중국·일본·대만 동아시아 외국인 관광객.
택스리펀 사이트와 결제 사이트에서 매일 자동으로 데이터를 긁어와서 대시보드에 표시.

## 기술 스택
- Next.js 15 App Router + Tailwind CSS + Recharts
- Supabase PostgreSQL (RLS 비활성화)
- Playwright 헤드리스 스크래핑
- Vercel 배포
- GitHub Actions 자동화 (매일 오전 9시 KST = UTC 00:00)

## 대시보드 화면 구성 (위→아래 순서)

### 1. 헤더
- 제목: "퓨어약국 마케팅 대시보드"
- 날짜 범위 필터 (7일/30일/90일/커스텀)
- "지금 새로고침" 버튼 → /api/scrape 호출

### 2. KPI 카드 4개
- 오늘 매장 매출 / 어제 매장 매출 / 어제 택스리펀 / 이번달 누적 매출
- 전월 동기 대비 ↑↓% 표시
- KPI는 dateRange 무관하게 항상 이번달 1일~오늘 기준으로 별도 fetch

### 3. 일별 매출 차트
- 명동/성수 라인 차트 (Recharts LineChart)
- 주말 구간 ReferenceArea로 음영 처리
- PPL 날짜에 ReferenceLine + 이름 표시
- 한·중·일·대만 명절 세로선 표시
- 날짜 아래 날씨 이모지 표시 (Open-Meteo archive API, 서울 위도 37.5665 경도 126.9780)
- XAxis interval=0, 날짜 20일 초과 시 -45도 기울임

### 4. 시간대별 매출 차트 + 국가별 요일 패턴 (가로 나란히)
- 시간대별: 명동/성수 막대 차트, 0~23시 전체 표시
- 요일 패턴: 국가별로 요일(월~일)별 평균 택스리펀 히트맵

### 5. 국가별 택스리펀 차트
- 막대/추이/파이/기타 탭 전환
- 주말 음영, PPL 마커 표시
- 상위 8개국 표시, 나머지 기타 합산

### 6. 인플루언서 PPL 패널
- 입력: 날짜, 이름, 공유+저장 합계, 비용(원), 메모
- ROI 자동 계산: (PPL 후 3일 매출 합계 - PPL 전 3일 매출 합계) / 비용 × 100
- 추가/삭제 기능

### 7. 온드미디어 성과 패널
- 탭: 인스타 / 틱톡 / 샤오홍슈
- 인스타 입력 지표: 조회수, 좋아요, 저장수, 댓글수
- 틱톡 입력 지표: 조회수, 좋아요, 저장수, 공유수
- 샤오홍슈 입력 지표: 조회수, 좋아요, 수집, 댓글
- 비용 입력 시 ROI 자동 계산 (PPL과 동일 방식)
- 추가/삭제 기능

### 8. 명절 캘린더
- 한국·중국·일본·대만 주요 명절 목록
- 현재 선택된 날짜 범위 내 명절만 표시
- 국가별 국기 이모지 표시

### 9. AI 분석 패널
- "AI 분석 보기" 버튼 클릭 시 실행
- 현재 달 vs 전달 자동 비교
- Claude API (claude-haiku-4-5-20251001) 사용
- 분석 출력: 한줄요약 / 주요 수치 변화 / 원인 추정 / 다음달 제안

### 10. 메트릭스 테이블
- 일별 명동/성수 매출, 건수, 객단가 상세 테이블

## API Routes
- GET /api/sales?from=&to= → tax_refund_sales + store_sales 조회 (1000행 초과 시 페이지네이션 필수)
- GET/POST/DELETE /api/ppl → influencer_ppl CRUD
- GET/POST/DELETE /api/owned-media → owned_media CRUD
- GET /api/hourly → hourly_sales 최근 데이터
- GET /api/weather?from=&to= → Open-Meteo archive API 날씨 코드 → 이모지 변환
- POST /api/analyze → Claude API 전월 대비 분석
- POST /api/scrape → scrapers/run-all.ts 실행
- POST /api/slack → Slack 봇 이벤트 처리

## 스크래퍼

### scrapers/gtfetrs.ts
- 사이트: merchant.gtfetrs.com
- Playwright로 로그인 후 "일별 발행내역" → 기간별/국적별 탭 조회
- 최근 60일을 30일씩 2구간으로 나눠 수집
- Linux 환경: --no-sandbox, --disable-setuid-sandbox, --disable-dev-shm-usage 옵션 필수
- tax_refund_sales 테이블에 upsert (onConflict: date, country, store)
- country='합계' 행 = 일별 총계

### scrapers/allthatpay.ts
- 사이트: scmadm.allthatpay.kr
- scrapeAllthatpay(): 매출캘린더(/shop/calen)에서 최근 3개월 일별 데이터 수집
- scrapeHourlySales(): /shop/time에서 시간대별 매출 수집
- Linux 환경: --no-sandbox, --disable-setuid-sandbox, --disable-dev-shm-usage 옵션 필수
- store_sales upsert (onConflict: date, store)
- hourly_sales upsert (onConflict: date, store, hour)

### scrapers/run-all.ts
- 실행 순서: gtfetrs 명동 → 성수 → allthatpay 명동 → 성수 → hourly 명동 → 성수
- 수집 완료 후 어제 날짜 기준 3개 테이블 데이터 건수 검증
- 어느 테이블이든 0건이면 process.exit(1) → GitHub Actions 실패 처리

## GitHub Actions (.github/workflows/daily-scraper.yml)
- schedule: cron '0 0 * * *' (매일 KST 09:00)
- workflow_dispatch: 수동 실행 버튼
- Node.js 22 사용 (Supabase 클라이언트 요구사항)
- npx playwright install chromium --with-deps
- 실패 시 SLACK_WEBHOOK_URL로 알림 발송
- Secrets 목록: GTFETRS_MD_ID/PW, GTFETRS_SS_ID/PW, ALLTHATPAY_MD_ID/PW, ALLTHATPAY_SS_ID/PW, SUPABASE_URL, SUPABASE_ANON_KEY, SLACK_WEBHOOK_URL

## Slack 봇
- Slack Bolt HTTP 모드 (Vercel 서버리스 함수)
- app_mention 이벤트 수신
- Vercel waitUntil로 비동기 처리 (타임아웃 방지)
- Claude API tool_use로 Supabase 데이터 조회 후 한국어 답변
- 대화 히스토리 slack_threads 테이블에 저장 (thread_ts 기준)

## 환경변수
.env.local 파일에 아래 항목 입력:
GTFETRS_MD_ID, GTFETRS_MD_PW, GTFETRS_SS_ID, GTFETRS_SS_PW
ALLTHATPAY_MD_ID, ALLTHATPAY_MD_PW, ALLTHATPAY_SS_ID, ALLTHATPAY_SS_PW
NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY, SLACK_SIGNING_SECRET, SLACK_BOT_TOKEN
```

---

## 배포 순서

1. GitHub에 레포 생성 후 코드 push
2. Supabase 테이블 생성 (위 SQL 실행)
3. vercel.com에서 GitHub 레포 연결 + 환경변수 입력 후 Deploy
4. GitHub Actions Secrets 입력
5. 완료
