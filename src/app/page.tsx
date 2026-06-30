'use client'

import { useEffect, useState, useCallback } from 'react'
import KPICard from '@/components/KPICard'
import DailySalesChart from '@/components/DailySalesChart'
import CountryChart from '@/components/CountryChart'
import MetricsTable from '@/components/MetricsTable'
import DateRangePicker from '@/components/DateRangePicker'
import PPLPanel from '@/components/PPLPanel'
import OwnedMediaPanel from '@/components/OwnedMediaPanel'
import HolidayCalendar from '@/components/HolidayCalendar'
import AIInsights from '@/components/AIInsights'
import CountryDayPattern from '@/components/CountryDayPattern'
import HourlySalesChart from '@/components/HourlySalesChart'
import { StoreSale, TaxRefundSale, PPLRecord, OwnedMediaRecord } from '@/lib/supabase'

// 데모 데이터 (Supabase 미설정 시 표시)
function makeDemoData() {
  const store: StoreSale[] = []
  const tax: TaxRefundSale[] = []
  const countries = ['중국', '일본', '미국', '태국', '대만', '홍콩', '싱가포르']
  const base = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const amount = 800000 + Math.round(Math.random() * 1200000)
    const count = 20 + Math.floor(Math.random() * 40)
    store.push({ id: dateStr, date: dateStr, store: '명동', amount, count, avg_order_value: Math.round(amount / count), scraped_at: '' })
    countries.forEach((country, ci) => {
      const w = [0.35, 0.25, 0.12, 0.1, 0.08, 0.06, 0.04][ci]
      const ta = Math.round(amount * w * (0.8 + Math.random() * 0.4))
      const tc = Math.max(1, Math.round(count * w))
      tax.push({ id: `${dateStr}-${country}`, date: dateStr, store: '명동', country, amount: ta, count: tc, scraped_at: '' })
    })
  }
  return { store, tax }
}
const { store: DEMO_STORE, tax: DEMO_TAX } = makeDemoData()

function defaultRange() {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - 29)
  return { from, to }
}

export default function Dashboard() {
  const [dateRange, setDateRange] = useState(defaultRange)
  const [storeSales, setStoreSales] = useState<StoreSale[]>([])
  const [taxRefund, setTaxRefund] = useState<TaxRefundSale[]>([])
  const [kpiSales, setKpiSales] = useState<{ store: StoreSale[]; tax: TaxRefundSale[] }>({ store: [], tax: [] })
  const [prevKpiSales, setPrevKpiSales] = useState<{ store: StoreSale[]; tax: TaxRefundSale[] }>({ store: [], tax: [] })
  const [pplList, setPplList] = useState<PPLRecord[]>([])
  const [ownedMediaList, setOwnedMediaList] = useState<OwnedMediaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // KPI 전용 fetch: 이번달 + 전월 동기간
  useEffect(() => {
    const t = new Date()
    const todayStr = t.toISOString().split('T')[0]
    const monthStart = todayStr.slice(0, 7) + '-01'

    // 전월 동기간: 전월 1일 ~ 전월의 오늘 날짜
    const prevMonthLastDay = new Date(t.getFullYear(), t.getMonth(), 0).getDate()
    const prevDay = Math.min(t.getDate(), prevMonthLastDay)
    const prevMonthStart = new Date(t.getFullYear(), t.getMonth() - 1, 1).toISOString().split('T')[0]
    const prevMonthSameDay = new Date(t.getFullYear(), t.getMonth() - 1, prevDay).toISOString().split('T')[0]

    Promise.all([
      fetch(`/api/sales?from=${monthStart}&to=${todayStr}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/sales?from=${prevMonthStart}&to=${prevMonthSameDay}`).then(r => r.ok ? r.json() : null),
    ]).then(([cur, prev]) => {
      if (cur) setKpiSales({ store: cur.storeSales ?? [], tax: cur.taxRefund ?? [] })
      if (prev) setPrevKpiSales({ store: prev.storeSales ?? [], tax: prev.taxRefund ?? [] })
    }).catch(() => {})
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const from = dateRange.from.toISOString().split('T')[0]
      const to = dateRange.to.toISOString().split('T')[0]
      const [salesRes, pplRes, ownedRes] = await Promise.all([
        fetch(`/api/sales?from=${from}&to=${to}`),
        fetch('/api/ppl'),
        fetch('/api/owned-media'),
      ])
      if (!salesRes.ok) throw new Error('API error')
      const json = await salesRes.json()
      setStoreSales(json.storeSales ?? [])
      setTaxRefund(json.taxRefund ?? [])
      if (pplRes.ok) setPplList(await pplRes.json())
      if (ownedRes.ok) setOwnedMediaList(await ownedRes.json())
      setLastUpdated(new Date().toLocaleString('ko-KR'))
    } catch {
      setStoreSales(DEMO_STORE)
      setTaxRefund(DEMO_TAX)
      setLastUpdated('데모 데이터 (Supabase 미설정)')
    } finally {
      setLoading(false)
    }
  }, [dateRange])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleScrape = async () => {
    setScraping(true)
    await fetch('/api/scrape', { method: 'POST' })
    await fetchData()
    setScraping(false)
  }

  // KPI 계산
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  // 전월 동기 날짜 계산
  const tDate = new Date(today)
  const prevMonthLastDay = new Date(tDate.getFullYear(), tDate.getMonth(), 0).getDate()
  const prevToday = new Date(tDate.getFullYear(), tDate.getMonth() - 1, Math.min(tDate.getDate(), prevMonthLastDay))
    .toISOString().split('T')[0]
  const prevYesterday = new Date(tDate.getFullYear(), tDate.getMonth() - 1, Math.min(tDate.getDate() - 1, prevMonthLastDay))
    .toISOString().split('T')[0]

  function pct(cur: number, prev: number): number | null {
    if (prev === 0 || cur === 0) return null
    return ((cur - prev) / prev) * 100
  }

  // KPI: kpiSales 사용 (dateRange 무관, 항상 이번달 전체)
  const todayStores = kpiSales.store.filter((s) => s.date === today)
  const yesterdayStores = kpiSales.store.filter((s) => s.date === yesterdayStr)
  const todayStoreAmount = todayStores.reduce((sum, s) => sum + s.amount, 0)
  const todayStoreCount = todayStores.reduce((sum, s) => sum + s.count, 0)
  const yesterdayStoreAmount = yesterdayStores.reduce((sum, s) => sum + s.amount, 0)
  const yesterdayStoreCount = yesterdayStores.reduce((sum, s) => sum + s.count, 0)

  // 이번달 누적 매출
  const thisMonthTotal = kpiSales.store.reduce((sum, s) => sum + s.amount, 0)
  const thisMonthLabel = `${parseInt(today.slice(5, 7))}월 합산`

  // 택스리펀 합계 (kpiSales 기준, '합계' 행만)
  const kpiTaxSummary = kpiSales.tax.filter((t) => t.country === '합계')
  const yesterdayTaxTotal = kpiTaxSummary.filter((t) => t.date === yesterdayStr).reduce((sum, t) => sum + t.amount, 0)
  const yesterdayTaxCount = kpiTaxSummary.filter((t) => t.date === yesterdayStr).reduce((sum, t) => sum + t.count, 0)

  // 전월 동기 비교
  const prevTodayAmount = prevKpiSales.store.filter((s) => s.date === prevToday).reduce((sum, s) => sum + s.amount, 0)
  const prevYesterdayAmount = prevKpiSales.store.filter((s) => s.date === prevYesterday).reduce((sum, s) => sum + s.amount, 0)
  const prevMonthTotal = prevKpiSales.store.reduce((sum, s) => sum + s.amount, 0)
  const prevTaxSummary = prevKpiSales.tax.filter((t) => t.country === '합계')
  const prevYesterdayTax = prevTaxSummary.filter((t) => t.date === prevYesterday).reduce((sum, t) => sum + t.amount, 0)

  // 차트용 택스리펀 (dateRange 기준)
  const taxSummary = taxRefund.filter((t) => t.country === '합계')

  // 국가별 (합계 제외)
  const countryTax = taxRefund.filter((t) => t.country !== '합계')

  const avgOrderValue =
    storeSales.length && storeSales.reduce((s, r) => s + r.count, 0) > 0
      ? Math.round(
          storeSales.reduce((s, r) => s + r.amount, 0) /
            storeSales.filter((r) => r.count > 0).reduce((s, r) => s + r.count, 0)
        )
      : null

  return (
    <main className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="min-w-0">
            <h1 className="whitespace-nowrap text-xl font-bold text-gray-900">퓨어약국 마케팅 대시보드</h1>
            {lastUpdated && (
              <p className="mt-0.5 truncate text-xs text-gray-400">{lastUpdated}</p>
            )}
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-3">
            <DateRangePicker
              from={dateRange.from}
              to={dateRange.to}
              onChange={(from, to) => setDateRange({ from, to })}
            />
            <button
              onClick={handleScrape}
              disabled={scraping}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {scraping ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  수집 중...
                </>
              ) : (
                '지금 새로고침'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {loading ? (
          <div className="flex h-64 items-center justify-center text-gray-400">
            데이터 불러오는 중...
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI 카드 */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <KPICard
                title="오늘 매장 매출"
                value={todayStoreAmount ? `₩${todayStoreAmount.toLocaleString()}` : '-'}
                sub={todayStoreCount ? `${todayStoreCount}건` : '업데이트 전'}
                color="blue"
                change={pct(todayStoreAmount, prevTodayAmount)}
              />
              <KPICard
                title="어제 매장 매출"
                value={yesterdayStoreAmount ? `₩${yesterdayStoreAmount.toLocaleString()}` : '-'}
                sub={yesterdayStoreCount ? `${yesterdayStoreCount}건` : '데이터 없음'}
                color="blue"
                change={pct(yesterdayStoreAmount, prevYesterdayAmount)}
              />
              <KPICard
                title="어제 택스리펀"
                value={yesterdayTaxTotal ? `₩${yesterdayTaxTotal.toLocaleString()}` : '-'}
                sub={yesterdayTaxCount ? `${yesterdayTaxCount}건` : '데이터 없음'}
                color="green"
                change={pct(yesterdayTaxTotal, prevYesterdayTax)}
              />
              <KPICard
                title="이번달 누적 매출"
                value={thisMonthTotal ? `₩${thisMonthTotal.toLocaleString()}` : '-'}
                sub={thisMonthLabel}
                color="orange"
                change={pct(thisMonthTotal, prevMonthTotal)}
              />
            </div>

            {/* 차트 — 풀폭 스택 */}
            <div className="grid grid-cols-1 gap-6">
              <DailySalesChart storeSales={storeSales} taxRefund={taxSummary} pplData={pplList} />
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <HourlySalesChart />
                <CountryDayPattern taxRefund={countryTax} />
              </div>
              <CountryChart taxRefund={countryTax} pplData={pplList} />
            </div>

            {/* 인플루언서 PPL */}
            <PPLPanel
              pplList={pplList}
              storeSales={storeSales}
              onAdd={(r) => setPplList((prev) => [r, ...prev])}
              onDelete={(id) => setPplList((prev) => prev.filter((p) => p.id !== id))}
            />

            {/* 온드미디어 성과 */}
            <OwnedMediaPanel
              list={ownedMediaList}
              storeSales={storeSales}
              onAdd={(r) => setOwnedMediaList((prev) => [r, ...prev])}
              onDelete={(id) => setOwnedMediaList((prev) => prev.filter((m) => m.id !== id))}
            />

            {/* 명절 캘린더 */}
            <HolidayCalendar />

            {/* AI 분석 */}
            {(() => {
              const to = dateRange.to
              const curYear = to.getFullYear()
              const curMonth = to.getMonth() // 0-indexed
              const currentFrom = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`
              const currentTo = to.toISOString().split('T')[0]
              const prevYear = curMonth === 0 ? curYear - 1 : curYear
              const prevMonth = curMonth === 0 ? 12 : curMonth // 1-indexed
              const prevLastDay = new Date(prevYear, prevMonth, 0).getDate()
              const prevFrom = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
              const prevTo = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${prevLastDay}`
              return (
                <AIInsights
                  currentFrom={currentFrom}
                  currentTo={currentTo}
                  prevFrom={prevFrom}
                  prevTo={prevTo}
                />
              )
            })()}

            {/* 테이블 */}
            <MetricsTable storeSales={storeSales} />
          </div>
        )}
      </div>
    </main>
  )
}
