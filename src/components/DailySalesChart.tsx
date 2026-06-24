'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts'
import { StoreSale, TaxRefundSale } from '@/lib/supabase'

type Props = {
  storeSales: StoreSale[]
  taxRefund: TaxRefundSale[]
}

function formatKRW(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(0)}만`
  return value.toLocaleString()
}

export default function DailySalesChart({ storeSales, taxRefund }: Props) {
  // 날짜 목록
  const taxSummary = taxRefund.filter((t) => t.country === '합계')

  const allDates = Array.from(
    new Set([
      ...storeSales.map((s) => s.date),
      ...taxSummary.map((t) => t.date),
    ])
  ).sort()

  // 주말 구간 (토~일 쌍)
  const weekendRanges: { x1: string; x2: string }[] = []
  let satKey: string | null = null
  for (const date of allDates) {
    const key = date.slice(5)
    const day = new Date(date).getDay()
    if (day === 6) satKey = key
    if (day === 0) {
      weekendRanges.push({ x1: satKey ?? key, x2: key })
      satKey = null
    }
  }
  if (satKey) weekendRanges.push({ x1: satKey, x2: satKey })

  const data = allDates.map((date) => {
    const mdStore = storeSales.filter((s) => s.date === date && s.store === '명동')
    const ssStore = storeSales.filter((s) => s.date === date && s.store === '성수')
    const mdTax = taxSummary.filter((t) => t.date === date && t.store === '명동').reduce((s, r) => s + r.amount, 0)
    const ssTax = taxSummary.filter((t) => t.date === date && t.store === '성수').reduce((s, r) => s + r.amount, 0)

    return {
      date: date.slice(5),
      '명동 매출': mdStore.reduce((s, r) => s + r.amount, 0) || null,
      '성수 매출': ssStore.reduce((s, r) => s + r.amount, 0) || null,
      '명동 택스리펀': mdTax || null,
      '성수 택스리펀': ssTax || null,
    }
  })

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-gray-700">일별 매출 추이</h2>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={formatKRW} tick={{ fontSize: 11 }} />
          <Tooltip formatter={(v) => `₩${Number(v).toLocaleString()}`} />
          <Legend />
          {weekendRanges.map((r, i) => (
            <ReferenceArea key={i} x1={r.x1} x2={r.x2} fill="#f5f5ff" fillOpacity={0.6} />
          ))}
          <Line type="monotone" dataKey="명동 매출" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="성수 매출" stroke="#60a5fa" strokeWidth={2} dot={false} connectNulls strokeDasharray="4 2" />
          <Line type="monotone" dataKey="명동 택스리펀" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
          <Line type="monotone" dataKey="성수 택스리펀" stroke="#34d399" strokeWidth={2} dot={false} connectNulls strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
