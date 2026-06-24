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
  LineChart,
  Line,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { TaxRefundSale, PPLRecord } from '@/lib/supabase'

type Props = {
  taxRefund: TaxRefundSale[]
  pplData?: PPLRecord[]
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6']
const STORES = ['전체', '명동', '성수'] as const
type StoreFilter = (typeof STORES)[number]

function formatKRW(v: number) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(0)}억`
  if (v >= 10000) return `${(v / 10000).toFixed(0)}만`
  return v.toLocaleString()
}

export default function CountryChart({ taxRefund, pplData = [] }: Props) {
  const [view, setView] = useState<'bar' | 'pie' | 'trend'>('trend')
  const [storeFilter, setStoreFilter] = useState<StoreFilter>('전체')
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set())

  const filtered = storeFilter === '전체' ? taxRefund : taxRefund.filter((t) => t.store === storeFilter)

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

  const top6 = data.slice(0, 6).map((d) => d.country)
  const allDates = Array.from(new Set(filtered.map((t) => t.date))).sort()
  const allDatesSet = new Set(allDates)

  const trendData = allDates.map((date) => {
    const row: Record<string, string | number> = { date: date.slice(5) }
    for (const country of top6) {
      const recs = filtered.filter((t) => t.date === date && t.country === country)
      row[country] = recs.reduce((s, r) => s + r.amount, 0) || 0
    }
    return row
  })

  const toggleKey = (key: string) => {
    setHiddenKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const pplInRange = pplData.filter(p => allDatesSet.has(p.date))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTrendTooltip = ({ active, payload, label }: { active?: boolean; payload?: readonly any[]; label?: string | number }) => {
    if (!active || !payload?.length || !label) return null
    const labelStr = String(label)
    const pplOnDate = pplData.filter(p => p.date.slice(5) === labelStr)

    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-xl text-xs min-w-[180px]">
        <p className="font-bold text-gray-700 mb-2">{labelStr}</p>
        <div className="space-y-0.5">
          {payload.filter(e => (e.value ?? 0) > 0).map((entry) => (
            <div key={entry.dataKey} className="flex items-center justify-between gap-4">
              <span style={{ color: entry.color }}>{entry.dataKey}</span>
              <span className="font-medium text-gray-800">₩{Number(entry.value).toLocaleString()}</span>
            </div>
          ))}
        </div>
        {pplOnDate.map(p => (
          <div key={p.id} className="mt-2.5 -mx-3 -mb-3 px-3 pb-3 pt-2.5 border-t border-amber-100 bg-amber-50 rounded-b-xl">
            <p className="font-bold text-amber-800">✨ {p.name}</p>
            {p.engagement > 0 && <p className="text-amber-600 mt-0.5">공유+저장 {p.engagement.toLocaleString()}</p>}
            {p.note && <p className="text-gray-400 mt-0.5">{p.note}</p>}
          </div>
        ))}
      </div>
    )
  }

  const barHeight = Math.max(300, data.length * 30)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-700">국가별 택스리펀</h2>
        <div className="flex gap-1.5">
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
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {([['bar', '막대'], ['trend', '추이'], ['pie', '파이']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'bar' && (
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
            <XAxis type="number" tickFormatter={formatKRW} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="country" tick={{ fontSize: 11 }} width={70} interval={0} />
            <Tooltip formatter={(v) => `₩${Number(v).toLocaleString()}`} />
            <Bar dataKey="amount" name="금액" fill="#3b82f6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}

      {view === 'trend' && (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatKRW} tick={{ fontSize: 11 }} />
            <Tooltip content={renderTrendTooltip} />
            <Legend
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onClick={(d: any) => toggleKey(d.dataKey ?? d.value)}
              formatter={(value) => (
                <span style={{
                  opacity: hiddenKeys.has(value) ? 0.35 : 1,
                  cursor: 'pointer',
                  textDecoration: hiddenKeys.has(value) ? 'line-through' : 'none',
                }}>
                  {value}
                </span>
              )}
            />

            {pplInRange.map((p) => (
              <ReferenceLine
                key={p.id}
                x={p.date.slice(5)}
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="4 3"
                label={{ value: `✨ ${p.name}`, position: 'top', fill: '#b45309', fontSize: 10, fontWeight: 600 }}
              />
            ))}

            {top6.map((country, i) => (
              <Line
                key={country}
                type="monotone"
                dataKey={country}
                stroke={COLORS[i]}
                strokeWidth={2}
                dot={false}
                connectNulls
                hide={hiddenKeys.has(country)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      {view === 'pie' && (
        <ResponsiveContainer width="100%" height={300}>
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
        </ResponsiveContainer>
      )}
    </div>
  )
}
