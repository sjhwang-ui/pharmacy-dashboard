'use client'

import { TaxRefundSale } from '@/lib/supabase'

type Props = {
  taxRefund: TaxRefundSale[]
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일']
const DAY_IDX = [1, 2, 3, 4, 5, 6, 0] // getDay() → 월~일

function formatKRW(v: number) {
  if (v >= 10000000) return `${(v / 10000000).toFixed(0)}천만`
  if (v >= 1000000) return `${(v / 1000000).toFixed(0)}백만`
  if (v >= 10000) return `${(v / 10000).toFixed(0)}만`
  return v.toLocaleString()
}

export default function CountryDayPattern({ taxRefund }: Props) {
  const filtered = taxRefund.filter(t => t.country !== '합계')

  // 국가별 총액 → top 6
  const totals: Record<string, number> = {}
  for (const t of filtered) totals[t.country] = (totals[t.country] ?? 0) + t.amount
  const top6 = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0])

  // 국가 × 요일 평균 매출 계산
  const matrix: Record<string, Record<number, { sum: number; cnt: number }>> = {}
  for (const country of top6) {
    matrix[country] = {}
    for (const d of DAY_IDX) matrix[country][d] = { sum: 0, cnt: 0 }
  }

  // 날짜별로 집계
  const dateMap: Record<string, Record<string, number>> = {}
  for (const t of filtered) {
    if (!top6.includes(t.country)) continue
    if (!dateMap[t.date]) dateMap[t.date] = {}
    dateMap[t.date][t.country] = (dateMap[t.date][t.country] ?? 0) + t.amount
  }
  for (const [date, countries] of Object.entries(dateMap)) {
    const dayOfWeek = new Date(date).getDay()
    for (const [country, amount] of Object.entries(countries)) {
      if (matrix[country]?.[dayOfWeek]) {
        matrix[country][dayOfWeek].sum += amount
        matrix[country][dayOfWeek].cnt += 1
      }
    }
  }

  // 전체 최댓값 (색상 스케일용)
  let maxVal = 0
  for (const country of top6) {
    for (const d of DAY_IDX) {
      const { sum, cnt } = matrix[country][d]
      const avg = cnt > 0 ? sum / cnt : 0
      if (avg > maxVal) maxVal = avg
    }
  }

  if (top6.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-3">국가별 요일 패턴</h2>
        <p className="text-sm text-gray-400 text-center py-8">데이터가 없습니다</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-700">국가별 요일 패턴</h2>
        <p className="text-xs text-gray-400 mt-0.5">요일별 평균 택스리펀 금액 · 색이 진할수록 매출 높음</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-xs text-gray-400 font-medium pb-2 w-20">국가</th>
              {DAYS.map((d, i) => (
                <th key={d} className={`text-center text-xs font-medium pb-2 ${i >= 5 ? 'text-blue-500' : 'text-gray-500'}`}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {top6.map(country => (
              <tr key={country}>
                <td className="py-1.5 text-xs text-gray-600 font-medium pr-2">{country}</td>
                {DAY_IDX.map((dayOfWeek, i) => {
                  const { sum, cnt } = matrix[country][dayOfWeek]
                  const avg = cnt > 0 ? Math.round(sum / cnt) : 0
                  const intensity = maxVal > 0 ? avg / maxVal : 0
                  const bg = intensity > 0
                    ? `rgba(99, 102, 241, ${0.08 + intensity * 0.72})`
                    : '#f9fafb'
                  const textColor = intensity > 0.5 ? '#fff' : '#374151'
                  return (
                    <td key={dayOfWeek} className="py-1.5 px-1 text-center">
                      <div
                        className="rounded-lg py-2 px-1 mx-0.5"
                        style={{ backgroundColor: bg, color: textColor }}
                        title={`${country} ${DAYS[i]}: 평균 ₩${avg.toLocaleString()}`}
                      >
                        <p className="text-xs font-medium leading-tight">{avg > 0 ? formatKRW(avg) : '-'}</p>
                        {cnt > 0 && <p className="text-[10px] opacity-70 mt-0.5">{cnt}일</p>}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 범례 */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-xs text-gray-400">낮음</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map(v => (
          <div key={v} className="w-6 h-4 rounded" style={{ backgroundColor: `rgba(99,102,241,${0.08 + v * 0.72})` }} />
        ))}
        <span className="text-xs text-gray-400">높음</span>
        <span className="ml-3 text-xs text-blue-400">토·일 = 주말</span>
      </div>
    </div>
  )
}
