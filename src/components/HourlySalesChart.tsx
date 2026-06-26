'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

type HourlyRow = { id: string; date: string; store: string; hour: number; count: number; amount: number }

function formatKRW(v: number) {
  if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`
  if (v >= 10000) return `${(v / 10000).toFixed(0)}만`
  return v.toLocaleString()
}

// 08~23 → 00 → 01 (명동 새벽 1시 영업)
const HOURS = [...Array.from({ length: 16 }, (_, i) => i + 8), 0, 1]

export default function HourlySalesChart() {
  const [rows, setRows] = useState<HourlyRow[]>([])
  const [storeFilter, setStoreFilter] = useState<'전체' | '명동' | '성수'>('전체')
  const [loading, setLoading] = useState(true)
  const [dateLabel, setDateLabel] = useState('')

  useEffect(() => {
    setLoading(true)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const dateStr = yesterday.toISOString().split('T')[0]
    setDateLabel(`${dateStr.slice(5).replace('-', '/')} 기준`)

    fetch(`/api/hourly?date=${dateStr}`)
      .then(r => r.json())
      .then(data => {
        setRows(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = storeFilter === '전체' ? rows : rows.filter(r => r.store === storeFilter)

  // 시간대별 집계 (매장 합산)
  const byHour: Record<number, { amount: number; count: number }> = {}
  for (const r of filtered) {
    if (!byHour[r.hour]) byHour[r.hour] = { amount: 0, count: 0 }
    byHour[r.hour].amount += r.amount
    byHour[r.hour].count += r.count
  }

  const chartData = HOURS.map(h => ({
    hour: `${String(h).padStart(2, '0')}시`,
    amount: byHour[h]?.amount ?? 0,
    count: byHour[h]?.count ?? 0,
  }))

  const maxAmount = Math.max(...chartData.map(d => d.amount), 1)
  const peakHour = chartData.reduce((a, b) => (a.amount > b.amount ? a : b), chartData[0])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-700">시간대별 매출</h2>
          <p className="text-xs text-gray-400 mt-0.5">{dateLabel} · 올댓페이 자동 수집</p>
        </div>
        <div className="flex items-center gap-3">
          {peakHour?.amount > 0 && (
            <span className="text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
              피크: {peakHour.hour} ({formatKRW(peakHour.amount)})
            </span>
          )}
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(['전체', '명동', '성수'] as const).map(s => (
              <button key={s} onClick={() => setStoreFilter(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${storeFilter === s ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center text-sm text-gray-400">불러오는 중...</div>
      ) : rows.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-2">
          <p className="text-sm text-gray-400">데이터 없음</p>
          <p className="text-xs text-gray-300">새로고침 버튼으로 어제 시간대별 데이터를 수집하세요</p>
        </div>
      ) : (
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ left: 0, right: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={0} angle={-45} textAnchor="end" height={36} />
              <YAxis tickFormatter={formatKRW} tick={{ fontSize: 10 }} width={48} />
              <Tooltip
                formatter={(v) => [`₩${Number(v).toLocaleString()}`, '매출']}
                labelStyle={{ fontSize: 12, fontWeight: 600 }}
              />
              <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                {chartData.map((d) => (
                  <Cell
                    key={d.hour}
                    fill={d.amount === maxAmount && maxAmount > 0 ? '#6366f1' : '#c7d2fe'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* 피크 타임 요약 */}
          <div className="grid grid-cols-3 gap-3 border-t border-gray-50 pt-3">
            {chartData
              .filter(d => d.amount > 0)
              .sort((a, b) => b.amount - a.amount)
              .slice(0, 3)
              .map((d, i) => (
                <div key={d.hour} className="rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-xs font-bold ${i === 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                      #{i + 1}
                    </span>
                    <span className="text-xs font-medium text-gray-700">{d.hour}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{formatKRW(d.amount)}</p>
                  {d.count > 0 && <p className="text-xs text-gray-400">{d.count}건</p>}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
