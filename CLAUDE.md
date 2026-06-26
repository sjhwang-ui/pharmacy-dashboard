@AGENTS.md

# 퓨어약국 마케팅 대시보드

## 프로젝트 목적
명동·성수 두 매장을 운영하는 K-뷰티 약국의 마케팅 의사결정을 데이터 기반으로 전환하기 위한 자동화 대시보드.
주요 고객은 동아시아 외국인 관광객(중국·일본·대만 등)이며, TikTok 3계정(영미·대만·일본)으로 콘텐츠 마케팅을 운영 중.

## 핵심 데이터 흐름
- **gtfetrs** (merchant.gtfetrs.com) → 국가별 택스리펀 금액·건수 → `tax_refund_sales`
- **allthatpay** (scmadm.allthatpay.kr) → 매장 일별 매출·건수, 시간대별 매출 → `store_sales`, `hourly_sales`
- **수동 입력** → 인플루언서 PPL 기록, 비용 → `influencer_ppl`

## 기술 스택
- Next.js 15 App Router (Turbopack), Tailwind CSS, Recharts
- Supabase PostgreSQL (RLS 비활성화)
- Playwright headless 스크래핑
- Vercel 배포: https://pharmacy-dashboard-iota.vercel.app
- GitHub: https://github.com/shindeokhyeon/pharmacy-dashboard

## 주요 화면 구성 (page.tsx)
1. **KPI 4개** — 오늘 매장매출, 어제 매장매출, 어제 택스리펀, 이번달 누적매출 (모두 전월 동기 대비 ↑↓%)
2. **일별 매출 차트** — 명동/성수 라인, PPL 마커, 주말 음영
3. **시간대별 매출** + **국가별 요일 패턴** (나란히)
4. **국가별 택스리펀** — 막대/추이/파이/기타 탭, 주말 음영, PPL 마커, 기타 합산 항목
5. **PPL 패널** — ROI 자동 계산 (PPL 전후 3일 매출 비교)
6. **명절 캘린더** — 한·중·일·대만 주요 명절
7. **AI 분석** — 전월 대비 자동 분석 (Anthropic 크레딧 필요)
8. **메트릭스 테이블** — 일별 상세 수치

## Supabase 테이블
- `store_sales` — date, store(명동/성수), amount, count, avg_order_value
- `tax_refund_sales` — date, store, country, amount, count (country='합계' 행이 일별 총계)
- `hourly_sales` — date, store, hour(0~23), count, amount
- `influencer_ppl` — date, name, engagement, note, cost

## KPI 설계 의도
KPI는 dateRange(차트 기간 필터)와 무관하게 항상 이번달 1일~오늘 데이터를 별도 fetch해서 표시.
전월 비교는 전월 동일 날짜 기준 (예: 6/25 ↔ 5/25).

## 스크래퍼 구조
- `scrapers/run-all.ts` — gtfetrs 2개 + allthatpay 2개 + hourly 2개 순차 실행
- `scrapers/gtfetrs.ts` — 명동/성수 각각 로그인 후 국가별 택스리펀 수집
- `scrapers/allthatpay.ts` — `scrapeAllthatpay()` 일별 매출, `scrapeHourlySales()` 시간대별 매출
- 새로고침 버튼 → `/api/scrape` → `run-all.ts` 실행

## 환경변수 (.env.local)
```
GTFETRS_MD_ID / GTFETRS_MD_PW       # gtfetrs 명동
GTFETRS_SS_ID / GTFETRS_SS_PW       # gtfetrs 성수
ALLTHATPAY_MD_ID / ALLTHATPAY_MD_PW  # 올댓페이 명동
ALLTHATPAY_SS_ID / ALLTHATPAY_SS_PW  # 올댓페이 성수
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY                    # AI 분석용, 크레딧 선충전 필요
```

## 미완성 / 다음 작업
- TikTok 3계정 조회수·팔로워 자동 수집 미연동 (차주 목표)
- 상품별 매출: allthatpay `/shop/prodstat`에서 자동 수집 가능하나 미구현
- AI 분석: Anthropic 크레딧 소진 시 오류 — console.anthropic.com/settings/billing에서 충전

## 인수인계 문서
Notion: https://app.notion.com/p/38b12630f2898153904ed6b5abdc2fdb
