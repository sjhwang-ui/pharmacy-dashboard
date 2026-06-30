'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { StoreSale, TaxRefundSale, PPLRecord } from '@/lib/supabase'
import { HOLIDAYS, COUNTRY_CONFIG } from '@/lib/holidays'

type Props = {
  storeSales: StoreSale[]
  taxRefund: TaxRefundSale[]
  pplData?: PPLRecord[]
}

function formatKRW(value: number) {
  if (value >= 10000) return `${(value / 10000).toFixed(0)}만`
  return value.toLocaleString()
}

// 날씨 코드 WMO → 이모지 (서버와 동일 매핑)
function wmoToEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '⛅'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '🌨️'
  return '⛈️'
}
void wmoToEmoji // suppress unused warning

// 날씨 이모지가 있는 커스텀 XAxis tick
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function WeatherTick({ x, y, payload, weatherMap }: any) {
  const emoji = weatherMap[payload.value] ?? ''
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="#6b7280" fontSize={11}>
        {payload.value}
      </text>
      {emoji && (
        <text x={0} y={0} dy={26} textAnchor="middle" fontSize={13}>
          {emoji}
        </text>
      )}
    </g>
  )
}

export default function DailySalesChart({ storeSales, taxRefund: _taxRefund, pplData = [] }: Props) {
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set())
  const [weatherMap, setWeatherMap] = useState<Record<string, string>>({})

  const allDates = Array.from(new Set(storeSales.map((s) => s.date))).sort()

  useEffect(() => {
    if (allDates.length === 0) return
    const from = allDates[0]
    const to = allDates[allDates.length - 1]
    fetch(`/api/weather?from=${from}&to=${to}`)
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, string>) => {
        // XAxis는 "MM-DD" 형식이므로 키 변환
        const sliced: Record<string, string> = {}
        for (const [k, v] of Object.entries(data)) sliced[k.slice(5)] = v
        setWeatherMap(sliced)
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDates[0], allDates[allDates.length - 1]])

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

  const allDatesSet = new Set(allDates)
  const holidaysInRange = HOLIDAYS.filter(h => allDatesSet.has(h.date))

  const data = allDates.map((date) => {
    const mdStore = storeSales.filter((s) => s.date === date && s.store === '명동')
    const ssStore = storeSales.filter((s) => s.date === date && s.store === '성수')
    return {
      date: date.slice(5),
      '명동 매출': mdStore.reduce((s, r) => s + r.amount, 0) || null,
      '성수 매출': ssStore.reduce((s, r) => s + r.amount, 0) || null,
    }
  })

  const toggleKey = (key: string) => {
    setHiddenKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderTooltip = ({ active, payload, label }: { active?: boolean; payload?: readonly any[]; label?: string | number }) => {
    if (!active || !payload?.length || !label) return null
    const labelStr = String(label)
    const pplOnDate = pplData.filter(p => p.date.slice(5) === labelStr)
    const holidaysOnDate = holidaysInRange.filter(h => h.date.slice(5) === labelStr)

    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-xl text-xs min-w-[200px]">
        <p className="font-bold text-gray-700 mb-2">{labelStr}</p>
        <div className="space-y-0.5">
          {payload.map((entry) =>
            entry.value ? (
              <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                <span style={{ color: entry.color }}>{entry.dataKey}</span>
                <span className="font-medium text-gray-800">₩{Number(entry.value).toLocaleString()}</span>
              </div>
            ) : null
          )}
        </div>
        {pplOnDate.map(p => (
          <div key={p.id} className="mt-2.5 -mx-3 -mb-3 px-3 pb-3 pt-2.5 border-t border-amber-100 bg-amber-50 rounded-b-xl">
            <p className="font-bold text-amber-800">✨ {p.name}</p>
            {p.engagement > 0 && <p className="text-amber-600 mt-0.5">공유+저장 {p.engagement.toLocaleString()}</p>}
            {p.note && <p className="text-gray-400 mt-0.5">{p.note}</p>}
          </div>
        ))}
        {holidaysOnDate.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
            {holidaysOnDate.map((h, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span>{COUNTRY_CONFIG[h.country].flag}</span>
                <span className="text-gray-500">{h.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-gray-700">일별 매출 추이</h2>
      <ResponsiveContainer width="100%" height={330}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            height={50}
            tick={(props) => <WeatherTick {...props} weatherMap={weatherMap} />}
          />
          <YAxis tickFormatter={formatKRW} tick={{ fontSize: 11 }} />
          <Tooltip content={renderTooltip} />
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

          {weekendRanges.map((r, i) => (
            <ReferenceArea key={`w-${i}`} x1={r.x1} x2={r.x2} fill="#f5f5ff" fillOpacity={0.6} />
          ))}
          {holidaysInRange.map((h, i) => (
            <ReferenceLine
              key={`h-${i}`}
              x={h.date.slice(5)}
              stroke={COUNTRY_CONFIG[h.country].stroke}
              strokeWidth={h.type === 'major' ? 2 : 1}
              strokeOpacity={h.type === 'major' ? 0.5 : 0.3}
              strokeDasharray={h.type === 'major' ? '4 3' : '2 3'}
            />
          ))}
          {pplData.filter(p => allDatesSet.has(p.date)).map((p) => (
            <ReferenceLine
              key={p.id}
              x={p.date.slice(5)}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 3"
              label={{ value: `✨ ${p.name}`, position: 'top', fill: '#b45309', fontSize: 10, fontWeight: 600 }}
            />
          ))}

          <Line type="monotone" dataKey="명동 매출" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls hide={hiddenKeys.has('명동 매출')} />
          <Line type="monotone" dataKey="성수 매출" stroke="#10b981" strokeWidth={2} dot={false} connectNulls hide={hiddenKeys.has('성수 매출')} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
