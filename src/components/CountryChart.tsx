'use client'

import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { TaxRefundSale } from '@/lib/supabase'

type Props = {
  taxRefund: TaxRefundSale[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']
const STORES = ['전체', '명동', '성수'] as const
type StoreFilter = (typeof STORES)[number]

export default function CountryChart({ taxRefund }: Props) {
  const [view, setView] = useState<'bar' | 'pie'>('bar')
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('전체')

  const filtered = storeFilter === '전체' ? taxRefund : taxRefund.filter((t) => t.store === storeFilter)

  // 국가별 합산
  const byCountry: Record<string, { amount: number; count: number }> = {}
  for (const t of filtered) {
    if (!byCountry[t.country]) byCountry[t.country] = { amount: 0, count: 0 }
    byCountry[t.country].amount += t.amount
    byCountry[t.country].count += t.count
  }

  const data = Object.entries(byCountry)
    .map(([country, v]) => ({ country, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 15)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">국가별 택스리펀</h2>
        <div className="flex gap-1.5">
          {/* 매장 필터 */}
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {STORES.map((s) => (
              <button
                key={s}
                onClick={() => setStoreFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  storeFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {/* 차트 타입 */}
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['bar', 'pie'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v === 'bar' ? '막대' : '파이'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        {view === 'bar' ? (
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={65} />
            <Tooltip formatter={(v) => `₩${Number(v).toLocaleString()}`} />
            <Bar dataKey="amount" name="금액" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        ) : (
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="country"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `₩${Number(v).toLocaleString()}`} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}
