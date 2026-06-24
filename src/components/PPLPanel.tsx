'use client'

import { useState } from 'react'
import { PPLRecord } from '@/lib/supabase'

type Props = {
  pplList: PPLRecord[]
  onAdd: (r: PPLRecord) => void
  onDelete: (id: string) => void
}

export default function PPLPanel({ pplList, onAdd, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ date: '', name: '', engagement: '', note: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.date || !form.name) return
    setSaving(true)
    const res = await fetch('/api/ppl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, engagement: parseInt(form.engagement) || 0 }),
    })
    if (res.ok) {
      const record = await res.json()
      onAdd(record)
      setForm({ date: '', name: '', engagement: '', note: '' })
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

      {/* 입력 폼 */}
      {open && (
        <form onSubmit={handleSubmit} className="mb-4 rounded-xl bg-gray-50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">인플루언서 이름</label>
              <input
                type="text"
                placeholder="예: @홍길동"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">공유+저장 합계</label>
              <input
                type="number"
                placeholder="예: 1200"
                value={form.engagement}
                onChange={e => setForm(f => ({ ...f, engagement: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">메모 (선택)</label>
              <input
                type="text"
                placeholder="예: 틱톡, 뷰티 크리에이터"
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-400 focus:outline-none"
              />
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

      {/* 목록 */}
      {pplList.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-4">아직 입력된 PPL 데이터가 없습니다</p>
      ) : (
        <div className="space-y-2">
          {pplList.map(r => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-2.5">
              <div className="flex items-center gap-3">
                <span className="text-lg">✨</span>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{r.name}</p>
                  <p className="text-xs text-gray-400">
                    {r.date}
                    {r.engagement > 0 && <span className="ml-2 text-purple-500">공유+저장 {r.engagement.toLocaleString()}</span>}
                    {r.note && <span className="ml-2">· {r.note}</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDelete(r.id)} className="text-gray-300 hover:text-red-400 text-xs">삭제</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
