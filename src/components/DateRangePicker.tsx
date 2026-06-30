'use client'

import { useState, useRef, useEffect } from 'react'
import { DayPicker } from 'react-day-picker'
import { ko } from 'react-day-picker/locale'
import 'react-day-picker/style.css'

type Range = { from: Date; to: Date }

type Props = {
  from: Date
  to: Date
  onChange: (from: Date, to: Date) => void
  earliestDate?: Date
}

const fmt = (d: Date) =>
  d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })

export default function DateRangePicker({ from, to, onChange, earliestDate }: Props) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<{ from?: Date; to?: Date }>({ from, to })
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleToggle = () => {
    if (!open) setPending({ from, to })
    setOpen(!open)
  }

  const handleConfirm = () => {
    if (pending.from && pending.to) {
      onChange(pending.from, pending.to)
      setOpen(false)
    }
  }

  const label =
    pending.from && pending.to
      ? `${fmt(pending.from)} ~ ${fmt(pending.to)}`
      : '날짜를 선택하세요'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm hover:border-gray-300"
      >
        <svg className="h-4 w-4 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="whitespace-nowrap font-medium">
          {fmt(from)} ~ {fmt(to)}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-2xl border border-gray-100 bg-white p-4 shadow-2xl sm:w-[320px]">
          <p className="mb-1 text-base font-bold text-gray-900">조회 기간을 선택하세요</p>
          <p className="mb-3 text-xs text-gray-400">기간은 최대 1년까지 선택할 수 있어요</p>

          {/* 빠른 선택 버튼 */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            {([
              { label: '오늘', days: 0 },
              { label: '어제', days: 1 },
              { label: '일주일', days: 6 },
              { label: '2주', days: 13 },
              { label: '한달', days: 29 },
            ] as const).map(({ label: l, days }) => {
              const t = new Date(); t.setHours(0,0,0,0)
              const f = new Date(t); f.setDate(f.getDate() - days)
              const isActive =
                pending.from?.toDateString() === f.toDateString() &&
                pending.to?.toDateString() === t.toDateString()
              return (
                <button
                  key={l}
                  onClick={() => {
                    setPending({ from: f, to: t })
                    onChange(f, t)
                    setOpen(false)
                  }}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {l}
                </button>
              )
            })}
            {earliestDate && (() => {
              const t = new Date(); t.setHours(0,0,0,0)
              const f = new Date(earliestDate); f.setHours(0,0,0,0)
              const isActive =
                pending.from?.toDateString() === f.toDateString() &&
                pending.to?.toDateString() === t.toDateString()
              return (
                <button
                  onClick={() => {
                    setPending({ from: f, to: t })
                    onChange(f, t)
                    setOpen(false)
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-yellow-400 text-gray-900'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  전체
                </button>
              )
            })()}
          </div>

          <DayPicker
            mode="range"
            selected={pending as { from: Date; to?: Date }}
            onSelect={(r) => setPending(r ?? {})}
            locale={ko}
            captionLayout="label"
            showOutsideDays={false}
            styles={{
              month_caption: { fontWeight: '700', fontSize: '1rem' },
              day: { borderRadius: '50%' },
            }}
            classNames={{
              selected: 'rdp-selected',
              range_start: 'rdp-range_start',
              range_end: 'rdp-range_end',
              range_middle: 'rdp-range_middle',
            }}
          />
          <button
            onClick={handleConfirm}
            disabled={!pending.from || !pending.to}
            className="mt-2 w-full rounded-xl bg-yellow-400 py-3 text-sm font-bold text-gray-900 transition hover:bg-yellow-300 disabled:opacity-40"
          >
            {label}
          </button>
        </div>
      )}
    </div>
  )
}
