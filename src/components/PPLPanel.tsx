'use client'

import { useState } from 'react'
import { PPLRecord, StoreSale } from '@/lib/supabase'

type Props = {
  pplList: PPLRecord[]
  storeSales: StoreSale[]
  onAdd: (r: PPLRecord) => void
  onDelete: (id: string) => void
}

function calcRoi(p: PPLRecord, storeSales: StoreSale[]) {
  if (!p.cost || p.cost <= 0) return null
  const d = new Date(p.date)
  const sum = (diffMin: number, diffMax: number) =>
    storeSales
      .filter(r => {
        const diff = (new Date(r.date).getTime() - d.getTime()) / 86400000
        return diff >= diffMin && diff <= diffMax
      })
      .reduce((s, r) => s + r.amount, 0)
  const before = sum(-3, -1)
  const after = sum(1, 3)
  const uplift = after - before
  return { uplift, roi: Math.round((uplift / p.cost) * 100) }
}

export default function PPLPanel({ pplList, storeSales, onAdd, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ date: '', name: '', engagement: '', note: '', cost: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.date || !form.name) return
    setSaving(true)
    const res = await fetch('/api/ppl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        engagement: parseInt(form.engagement) || 0,
        cost: form.cost ? parseInt(form.cost) : null,
      }),
    })
    if (res.ok) {
      const record = await res.json()
      onAdd(record)
      setForm({ date: '', name: '', engagement: '', note: '', cost: '' })
      setOpen(false)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await fetch('/api/ppl', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    onDelete(id)
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-700">인플루언서 PPL</h2>
          <p className="text-xs text-gray-400 mt-0.5">이름과 공유+저장 합계를 입력하면 매출 차트에 표시됩니다</p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-purple-700"
        >
          <span className="text-base leading-none">+</span> PPL 추가
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mb-4 rounded-xl bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">인플루언서 이름</label>
              <input type="text" placeholder="예: @홍길동" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none" required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">공유+저장 합계</label>
              <input type="number" placeholder="예: 1200" value={form.engagement} onChange={e => setForm(f => ({ ...f, engagement: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">PPL 비용 (원)</label>
              <input type="number" placeholder="예: 300000" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">메모 (선택)</label>
              <input type="text" placeholder="예: 틱톡, 대만" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">취소</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50">
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}

      {pplList.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-4">아직 입력된 PPL 데이터가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {pplList.map(r => {
            const roi = calcRoi(r, storeSales)
            return (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">✨</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-400 flex flex-wrap gap-x-2">
                      <span>{r.date}</span>
                      {r.engagement > 0 && <span className="text-purple-500">공유+저장 {r.engagement.toLocaleString()}</span>}
                      {r.cost && r.cost > 0 && <span className="text-gray-400">비용 ₩{r.cost.toLocaleString()}</span>}
                      {r.note && <span>· {r.note}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  {roi && (
                    <div className="text-right">
                      <p className={`text-xs font-bold ${roi.roi >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        ROI {roi.roi >= 0 ? '+' : ''}{roi.roi}%
                      </p>
                      <p className="text-xs text-gray-400">
                        매출 {roi.uplift >= 0 ? '+' : ''}₩{roi.uplift.toLocaleString()}
                      </p>
                    </div>
                  )}
                  <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400 text-xs">삭제</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
