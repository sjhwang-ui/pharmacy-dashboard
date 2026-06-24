'use client'

import { StoreSale } from '@/lib/supabase'

type Props = {
  storeSales: StoreSale[]
}

export default function MetricsTable({ storeSales }: Props) {
  const dates = Array.from(new Set(storeSales.map(s => s.date)))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 14)

  const byStore = (date: string, store: string) =>
    storeSales.find(s => s.date === date && s.store === store)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-gray-700">결제 건수 / 객단가</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-gray-500">
              <th className="pb-2 font-medium text-left">날짜</th>
              <th className="pb-2 font-medium text-right text-blue-600">명동 매출</th>
              <th className="pb-2 font-medium text-right text-blue-500">건수</th>
              <th className="pb-2 font-medium text-right text-blue-400">객단가</th>
              <th className="pb-2 pl-4 font-medium text-right text-emerald-600">성수 매출</th>
              <th className="pb-2 font-medium text-right text-emerald-500">건수</th>
              <th className="pb-2 font-medium text-right text-emerald-400">객단가</th>
            </tr>
          </thead>
          <tbody>
            {dates.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-gray-400">데이터가 없습니다</td>
              </tr>
            )}
            {dates.map((date) => {
              const md = byStore(date, '명동')
              const ss = byStore(date, '성수')
              const mdAvg = md && md.count > 0 ? (md.avg_order_value || Math.round(md.amount / md.count)) : null
              const ssAvg = ss && ss.count > 0 ? (ss.avg_order_value || Math.round(ss.amount / ss.count)) : null
              return (
                <tr key={date} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 text-gray-500 text-xs">{date}</td>
                  <td className="py-2 text-right font-medium text-blue-700">{md ? `₩${md.amount.toLocaleString()}` : '-'}</td>
                  <td className="py-2 text-right text-gray-500">{md ? `${md.count}건` : '-'}</td>
                  <td className="py-2 text-right text-gray-400">{mdAvg ? `₩${mdAvg.toLocaleString()}` : '-'}</td>
                  <td className="py-2 pl-4 text-right font-medium text-emerald-700">{ss ? `₩${ss.amount.toLocaleString()}` : '-'}</td>
                  <td className="py-2 text-right text-gray-500">{ss ? `${ss.count}건` : '-'}</td>
                  <td className="py-2 text-right text-gray-400">{ssAvg ? `₩${ssAvg.toLocaleString()}` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
