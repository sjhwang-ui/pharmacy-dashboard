'use client'

import { useEffect, useState, useCallback } from 'react'
import KPICard from '@/components/KPICard'
import DailySalesChart from '@/components/DailySalesChart'
import CountryChart from '@/components/CountryChart'
import MetricsTable from '@/components/MetricsTable'
import DateRangePicker from '@/components/DateRangePicker'
import PPLPanel from '@/components/PPLPanel'
import HolidayCalendar from '@/components/HolidayCalendar'
import AIInsights from '@/components/AIInsights'
import { StoreSale, TaxRefundSale, PPLRecord } from '@/lib/supabase'

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
  const [pplList, setPplList] = useState<PPLRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const from = dateRange.from.toISOString().split('T')[0]
      const to = dateRange.to.toISOString().split('T')[0]
      const [salesRes, pplRes] = await Promise.all([
        fetch(`/api/sales?from=${from}&to=${to}`),
        fetch('/api/ppl'),
      ])
      if (!salesRes.ok) throw new Error('API error')
      const json = await salesRes.json()
      setStoreSales(json.storeSales ?? [])
      setTaxRefund(json.taxRefund ?? [])
      if (pplRes.ok) setPplList(await pplRes.json())
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

  // 오늘 매장 매출 = 명동+성수 합산
  const todayStores = storeSales.filter((s) => s.date === today)
  const todayStoreAmount = todayStores.reduce((sum, s) => sum + s.amount, 0)
  const todayStoreCount = todayStores.reduce((sum, s) => sum + s.count, 0)

  // 오늘 택스리펀 없으면 어제 데이터 사용
  const todayTax = taxRefund.filter((t) => t.date === today)
  const yesterdayTax = taxRefund.filter((t) => t.date === yesterdayStr)
  const activeTax = todayTax.length > 0 ? todayTax : yesterdayTax
  const activeTaxLabel = todayTax.length > 0 ? '오늘' : '어제'
  const todayTaxTotal = activeTax.reduce((sum, t) => sum + t.amount, 0)
  const todayTaxCount = activeTax.reduce((sum, t) => sum + t.count, 0)

  // 국가별 (합계 제외)
  const countryTax = taxRefund.filter((t) => t.country !== '합계')
  const countrySet = new Set(countryTax.map((t) => t.country))
  const topCountry = Object.entries(
    countryTax.reduce((acc, t) => {
      acc[t.country] = (acc[t.country] ?? 0) + t.amount
      return acc
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])[0]

  // 택스리펀 합계 데이터 (일별 추이용)
  const taxSummary = taxRefund.filter((t) => t.country === '합계')

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
                sub={todayStoreCount ? `${todayStoreCount}건` : '데이터 없음'}
                color="blue"
              />
              <KPICard
                title={`${activeTaxLabel} 택스리펀`}
                value={todayTaxTotal ? `₩${todayTaxTotal.toLocaleString()}` : '-'}
                sub={todayTaxCount ? `${todayTaxCount}건` : '데이터 없음'}
                color="green"
              />
              <KPICard
                title="방문 국가 수"
                value={countrySet.size ? `${countrySet.size}개국` : '집계 중'}
                sub={topCountry ? `Top: ${topCountry[0]}` : '국적별 데이터 수집 예정'}
                color="purple"
              />
              <KPICard
                title="평균 객단가"
                value={avgOrderValue ? `₩${avgOrderValue.toLocaleString()}` : '-'}
                sub={`${Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1}일 평균`}
                color="orange"
              />
            </div>

            {/* 차트 — 풀폭 스택 */}
            <div className="grid grid-cols-1 gap-6">
              <DailySalesChart storeSales={storeSales} taxRefund={taxSummary} pplData={pplList} />
              <CountryChart taxRefund={countryTax} pplData={pplList} />
            </div>

            {/* 인플루언서 PPL */}
            <PPLPanel
              pplList={pplList}
              onAdd={(r) => setPplList((prev) => [r, ...prev])}
              onDelete={(id) => setPplList((prev) => prev.filter((p) => p.id !== id))}
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
