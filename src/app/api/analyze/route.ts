import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { supabase } from '@/lib/supabase'
import { HOLIDAYS } from '@/lib/holidays'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function pct(current: number, prev: number): string {
  if (prev === 0) return current > 0 ? '+∞%' : '0%'
  const r = ((current - prev) / prev) * 100
  return (r >= 0 ? '+' : '') + r.toFixed(1) + '%'
}

function formatAmt(v: number): string {
  if (v >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`
  if (v >= 10_000) return `${(v / 10_000).toFixed(0)}만`
  return v.toLocaleString()
}

export async function POST(req: NextRequest) {
  try {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.' }, { status: 500 })
  }

  const { currentFrom, currentTo, prevFrom, prevTo } = await req.json()

  // ── 데이터 조회 ──
  const [curStore, prevStore, curTax, prevTax, pplData] = await Promise.all([
    supabase.from('store_sales').select('*').gte('date', currentFrom).lte('date', currentTo),
    supabase.from('store_sales').select('*').gte('date', prevFrom).lte('date', prevTo),
    supabase.from('tax_refund_sales').select('*').gte('date', currentFrom).lte('date', currentTo),
    supabase.from('tax_refund_sales').select('*').gte('date', prevFrom).lte('date', prevTo),
    supabase.from('influencer_ppl').select('*').gte('date', currentFrom).lte('date', currentTo),
  ])

  const curSales = curStore.data ?? []
  const prvSales = prevStore.data ?? []
  const curRefund = (curTax.data ?? []).filter(t => t.country !== '합계')
  const prvRefund = (prevTax.data ?? []).filter(t => t.country !== '합계')
  const ppls = pplData.data ?? []

  // ── 매장 매출 집계 ──
  const storeSum = (rows: typeof curSales, store: string) =>
    rows.filter(r => r.store === store).reduce((s, r) => s + r.amount, 0)
  const storeCount = (rows: typeof curSales, store: string) =>
    rows.filter(r => r.store === store).reduce((s, r) => s + r.count, 0)

  const curMD = storeSum(curSales, '명동'), curSS = storeSum(curSales, '성수')
  const prvMD = storeSum(prvSales, '명동'), prvSS = storeSum(prvSales, '성수')
  const curTotal = curMD + curSS, prvTotal = prvMD + prvSS

  const curCntMD = storeCount(curSales, '명동'), curCntSS = storeCount(curSales, '성수')
  const curAvg = (curCntMD + curCntSS) > 0 ? Math.round(curTotal / (curCntMD + curCntSS)) : 0
  const prvCntMD = storeCount(prvSales, '명동'), prvCntSS = storeCount(prvSales, '성수')
  const prvAvg = (prvCntMD + prvCntSS) > 0 ? Math.round(prvTotal / (prvCntMD + prvCntSS)) : 0

  // ── 국가별 집계 ──
  const sumByCountry = (rows: typeof curRefund) => {
    const m: Record<string, number> = {}
    for (const r of rows) m[r.country] = (m[r.country] ?? 0) + r.amount
    return m
  }
  const curByCountry = sumByCountry(curRefund)
  const prvByCountry = sumByCountry(prvRefund)
  const allCountries = Array.from(new Set([...Object.keys(curByCountry), ...Object.keys(prvByCountry)]))
  const top10 = allCountries
    .sort((a, b) => (curByCountry[b] ?? 0) - (curByCountry[a] ?? 0))
    .slice(0, 10)
    .map(c => ({
      country: c,
      current: curByCountry[c] ?? 0,
      prev: prvByCountry[c] ?? 0,
      change: pct(curByCountry[c] ?? 0, prvByCountry[c] ?? 0),
    }))

  // ── 요일 패턴 (현재 기간) ──
  const dayAmounts: { weekday: number[]; weekend: number[] } = { weekday: [], weekend: [] }
  for (const r of curSales) {
    const day = new Date(r.date).getDay()
    const bucket = day === 0 || day === 6 ? 'weekend' : 'weekday'
    dayAmounts[bucket].push(r.amount)
  }
  const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
  const weekdayAvg = avg(dayAmounts.weekday)
  const weekendAvg = avg(dayAmounts.weekend)

  // ── PPL 이벤트 전후 3일 매출 변화 ──
  const pplImpact = ppls.map(p => {
    const d = new Date(p.date)
    const before = curSales
      .filter(r => {
        const diff = (new Date(r.date).getTime() - d.getTime()) / 86400000
        return diff >= -3 && diff < 0
      })
      .reduce((s, r) => s + r.amount, 0) / 3
    const after = curSales
      .filter(r => {
        const diff = (new Date(r.date).getTime() - d.getTime()) / 86400000
        return diff > 0 && diff <= 3
      })
      .reduce((s, r) => s + r.amount, 0) / 3
    return {
      name: p.name,
      date: p.date,
      engagement: p.engagement,
      before3dayAvg: Math.round(before),
      after3dayAvg: Math.round(after),
      change: pct(after, before),
    }
  })

  // ── 기간 내 주요 명절 ──
  const majorHolidaysInPeriod = HOLIDAYS.filter(h =>
    h.type === 'major' && h.date >= currentFrom && h.date <= currentTo
  )
  const majorHolidaysInPrev = HOLIDAYS.filter(h =>
    h.type === 'major' && h.date >= prevFrom && h.date <= prevTo
  )

  // ── Claude에 넘길 데이터 구조 ──
  const analysisData = {
    period: { current: `${currentFrom} ~ ${currentTo}`, prev: `${prevFrom} ~ ${prevTo}` },
    storeSales: {
      total: { current: formatAmt(curTotal), prev: formatAmt(prvTotal), change: pct(curTotal, prvTotal) },
      명동: { current: formatAmt(curMD), prev: formatAmt(prvMD), change: pct(curMD, prvMD) },
      성수: { current: formatAmt(curSS), prev: formatAmt(prvSS), change: pct(curSS, prvSS) },
      avgOrderValue: { current: `₩${curAvg.toLocaleString()}`, prev: `₩${prvAvg.toLocaleString()}`, change: pct(curAvg, prvAvg) },
    },
    taxRefundTop10: top10.map(c => `${c.country}: ${formatAmt(c.current)} (${c.change})`),
    dayPattern: {
      weekdayAvg: formatAmt(weekdayAvg),
      weekendAvg: formatAmt(weekendAvg),
      weekendPremium: pct(weekendAvg, weekdayAvg),
    },
    pplEvents: pplImpact.map(p =>
      `${p.name} (${p.date}, 참여도 ${p.engagement}) — 전후 평균 매출: ${formatAmt(p.before3dayAvg)} → ${formatAmt(p.after3dayAvg)} (${p.change})`
    ),
    majorHolidays: {
      current: majorHolidaysInPeriod.map(h => `${h.name} (${h.date}, ${h.country})`),
      prev: majorHolidaysInPrev.map(h => `${h.name} (${h.date}, ${h.country})`),
    },
  }

  // ── Claude 호출 ──
  const systemPrompt = `당신은 퓨어약국의 마케팅 분석 어시스턴트입니다.
퓨어약국은 서울 명동·성수에 위치한 외국인 관광객 대상 약국으로, 주 고객은 중국·대만·일본·말레이시아 등 동아시아 관광객입니다.
데이터를 바탕으로 한국어로 핵심 인사이트를 제공하세요. 수치는 항상 구체적으로 언급하세요.`

  const userPrompt = `다음 데이터를 분석해 마케팅 인사이트를 제공해주세요:

${JSON.stringify(analysisData, null, 2)}

아래 형식으로 답변하세요 (마크다운):

## [현재기간] 성과 요약
(한 문장 핵심 요약)

### 주요 수치 변화
- (bullet 4~5개, 수치 구체적으로)

### 원인 추정
- (bullet 4~5개, 명절/PPL/패턴 등 데이터 근거 + 가설, 해당 국기 이모지 사용)

### 다음 달 액션 제안
- (1~2개, 구체적인 제안)`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  return NextResponse.json({ analysis: text, meta: analysisData })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '서버 오류가 발생했습니다.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
