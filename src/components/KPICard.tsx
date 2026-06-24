'use client'

type Props = {
  title: string
  value: string
  sub?: string
  color?: 'blue' | 'green' | 'purple' | 'orange'
}

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
}

export default function KPICard({ title, value, sub, color = 'blue' }: Props) {
  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]}`}>
      <p className="text-sm font-medium opacity-70">{title}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  )
}
