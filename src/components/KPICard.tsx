'use client'

type Props = {
  title: string
  value: string
  sub?: string
  color?: 'blue' | 'green' | 'purple' | 'orange'
  change?: number | null // 전월 대비 % (양수=증가, 음수=감소)
}

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
}

export default function KPICard({ title, value, sub, color = 'blue', change }: Props) {
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium opacity-70">{title}</p>
        {change != null && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
            change >= 0
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-600'
          }`}>
            {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  )
}
