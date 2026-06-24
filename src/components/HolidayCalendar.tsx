'use client'

import { useState } from 'react'
import { HOLIDAYS, COUNTRY_CONFIG, type CountryKey } from '@/lib/holidays'

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const startDay = first.getDay()
  const cells: (number | null)[] = Array(startDay).fill(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function dateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function HolidayCalendar() {
  const [filter, setFilter] = useState<CountryKey | 'ALL'>('ALL')
  const now = new Date()
  const months = [0, 1, 2].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const filtered = filter === 'ALL' ? HOLIDAYS : HOLIDAYS.filter(h => h.country === filter)
  const byDate = filtered.reduce<Record<string, typeof HOLIDAYS>>((acc, h) => {
    acc[h.date] = [...(acc[h.date] ?? []), h]
    return acc
  }, {})

  const todayStr = now.toISOString().split('T')[0]
  const upcoming = filtered
    .filter(h => h.date >= todayStr && h.type === 'major')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      {/* 헤더 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-gray-700">한·중·일·대만 주요 명절</h2>
        <div className="flex gap-1.5 ml-auto">
          {(['ALL', 'KR', 'CN', 'JP', 'TW'] as const).map(c => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === c
                  ? c === 'ALL' ? 'bg-gray-800 text-white' : `${COUNTRY_CONFIG[c].bg} ${COUNTRY_CONFIG[c].text} border ${COUNTRY_CONFIG[c].border}`
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {c === 'ALL' ? '전체' : `${COUNTRY_CONFIG[c].flag} ${COUNTRY_CONFIG[c].label}`}
            </button>
          ))}
        </div>
      </div>

      {/* 다가오는 주요 명절 */}
      {upcoming.length > 0 && (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {upcoming.map((h, i) => {
            const cfg = COUNTRY_CONFIG[h.country]
            const d = new Date(h.date)
            const daysLeft = Math.ceil((d.getTime() - now.getTime()) / 86400000)
            return (
              <div key={i} className={`shrink-0 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3 min-w-[130px]`}>
                <p className="text-lg leading-none mb-1">{cfg.flag}</p>
                <p className={`text-xs font-bold ${cfg.text}`}>{h.name}</p>
                <p className="text-xs text-gray-400 mt-1">{h.date.slice(5).replace('-', '/')}</p>
                <p className={`text-xs font-semibold ${cfg.text} mt-0.5`}>
                  {daysLeft === 0 ? '오늘!' : daysLeft === 1 ? '내일' : `D-${daysLeft}`}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* 3개월 달력 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {months.map(({ year, month }) => {
          const cells = getMonthGrid(year, month)
          const monthLabel = `${year}년 ${month + 1}월`
          return (
            <div key={`${year}-${month}`}>
              <p className="mb-2 text-sm font-bold text-gray-700">{monthLabel}</p>
              <div className="grid grid-cols-7 gap-px text-center text-[11px] font-medium text-gray-400 mb-1">
                {DAYS.map(d => <span key={d} className={d === '일' ? 'text-red-300' : d === '토' ? 'text-blue-300' : ''}>{d}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />
                  const ds = dateStr(year, month, day)
                  const holidays = byDate[ds] ?? []
                  const isToday = ds === todayStr
                  const dow = i % 7
                  return (
                    <div
                      key={i}
                      className={`relative rounded-lg p-1 min-h-[42px] transition ${
                        isToday ? 'bg-gray-900 text-white' : ''
                      }`}
                    >
                      <p className={`text-[11px] font-medium leading-none mb-1 ${
                        isToday ? 'text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-400' : 'text-gray-600'
                      }`}>{day}</p>
                      <div className="flex flex-wrap gap-px">
                        {holidays.map((h, hi) => {
                          const cfg = COUNTRY_CONFIG[h.country]
                          return (
                            <div key={hi} className="group relative">
                              <div className={`w-2 h-2 rounded-full ${cfg.dot} ${h.type === 'major' ? 'ring-1 ring-offset-0' : ''}`} />
                              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-10 hidden group-hover:block">
                                <div className={`rounded-lg border ${cfg.border} ${cfg.bg} px-2 py-1 text-[10px] ${cfg.text} font-medium whitespace-nowrap shadow-lg`}>
                                  {cfg.flag} {h.name}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* 범례 */}
      <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-3">
        {(Object.entries(COUNTRY_CONFIG) as [CountryKey, (typeof COUNTRY_CONFIG)[CountryKey]][]).map(([k, cfg]) => (
          <div key={k} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
            <span className="text-xs text-gray-500">{cfg.flag} {cfg.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400 ring-1 ring-gray-400 ring-offset-0" />
          <span className="text-xs text-gray-500">주요 명절 (연휴)</span>
        </div>
      </div>
    </div>
  )
}
