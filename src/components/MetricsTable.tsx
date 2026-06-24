'use client'

import { StoreSale } from '@/lib/supabase'

type Props = {
  storeSales: StoreSale[]
}

export default function MetricsTable({ storeSales }: Props) {
  const sorted = [...storeSales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-gray-700">결제 건수 / 객단가</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-gray-500">
              <th className="pb-2 font-medium">날짜</th>
              <th className="pb-2 font-medium text-right">매출</th>
              <th className="pb-2 font-medium text-right">건수</th>
              <th className="pb-2 font-medium text-right">객단가</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-400">
                  데이터가 없습니다
                </td>
              </tr>
            )}
            {sorted.map((row) => (
              <tr key={row.date} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="py-2 text-gray-600">{row.date}</td>
                <td className="py-2 text-right font-medium">₩{row.amount.toLocaleString()}</td>
                <td className="py-2 text-right text-gray-600">{row.count}건</td>
                <td className="py-2 text-right text-gray-600">
                  ₩{row.avg_order_value ? row.avg_order_value.toLocaleString() : Math.round(row.amount / row.count).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
