'use client'

import { useState } from 'react'
import { OwnedMediaRecord, StoreSale } from '@/lib/supabase'

type Platform = '인스타' | '틱톡' | '샤오홍슈'

type Props = {
  list: OwnedMediaRecord[]
  storeSales: StoreSale[]
  onAdd: (r: OwnedMediaRecord) => void
  onDelete: (id: string) => void
}

const PLATFORM_CONFIG: Record<Platform, {
  icon: string
  color: string
  bg: string
  fields: { key: string; label: string }[]
}> = {
  인스타: {
    icon: '📸',
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    fields: [
      { key: 'views', label: '조회수' },
      { key: 'likes', label: '좋아요' },
      { key: 'saves', label: '저장수' },
      { key: 'comments', label: '댓글수' },
    ],
  },
  틱톡: {
    icon: '🎵',
    color: 'text-gray-900',
    bg: 'bg-gray-50',
    fields: [
      { key: 'views', label: '조회수' },
      { key: 'likes', label: '좋아요' },
      { key: 'saves', label: '저장수' },
      { key: 'shares', label: '공유수' },
    ],
  },
  샤오홍슈: {
    icon: '📕',
    color: 'text-red-600',
    bg: 'bg-red-50',
    fields: [
      { key: 'views', label: '조회수' },
      { key: 'likes', label: '좋아요' },
      { key: 'saves', label: '수집' },
      { key: 'comments', label: '댓글' },
    ],
  },
}

const PLATFORMS: Platform[] = ['인스타', '틱톡', '샤오홍슈']

function calcRoi(r: OwnedMediaRecord, storeSales: StoreSale[]) {
  if (!r.cost || r.cost <= 0) return null
  const d = new Date(r.date)
  const sum = (diffMin: number, diffMax: number) =>
    storeSales
      .filter(s => {
        const diff = (new Date(s.date).getTime() - d.getTime()) / 86400000
        return diff >= diffMin && diff <= diffMax
      })
      .reduce((acc, s) => acc + s.amount, 0)
  const before = sum(-3, -1)
  const after = sum(1, 3)
  const uplift = after - before
  return { uplift, roi: Math.round((uplift / r.cost) * 100) }
}

const emptyForm = {
  date: '',
  content_note: '',
  views: '',
  likes: '',
  saves: '',
  shares: '',
  comments: '',
  cost: '',
}

export default function OwnedMediaPanel({ list, storeSales, onAdd, onDelete }: Props) {
  const [tab, setTab] = useState<Platform>('인스타')
  const [open, setOpen] = useState(false)
  const [formPlatform, setFormPlatform] = useState<Platform>('인스타')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const filtered = list.filter(r => r.platform === tab)
  const cfg = PLATFORM_CONFIG[tab]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.date) return
    setSaving(true)
    const body = {
      platform: formPlatform,
      date: form.date,
      content_note: form.content_note || null,
      views: parseInt(form.views) || 0,
      likes: parseInt(form.likes) || 0,
      saves: parseInt(form.saves) || 0,
      shares: parseInt(form.shares) || 0,
      comments: parseInt(form.comments) || 0,
      cost: form.cost ? parseInt(form.cost) : null,
    }
    const res = await fetch('/api/owned-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const record = await res.json()
      onAdd(record)
      setForm(emptyForm)
      setOpen(false)
      setTab(formPlatform)
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    await fetch('/api/owned-media', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    onDelete(id)
  }

  const formCfg = PLATFORM_CONFIG[formPlatform]

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-700">온드미디어 성과</h2>
          <p className="text-xs text-gray-400 mt-0.5">인스타·틱톡·샤오홍슈 콘텐츠 성과를 기록하고 매출 기여를 추적합니다</p>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600"
        >
          <span className="text-base leading-none">+</span> 성과 추가
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="mb-4 rounded-xl bg-gray-50 p-4 space-y-3">
          {/* 플랫폼 선택 */}
          <div className="flex gap-2">
            {PLATFORMS.map(p => (
              <button
                key={p}
                type="button"
                onClick={() => setFormPlatform(p)}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  formPlatform === p
                    ? 'bg-rose-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {PLATFORM_CONFIG[p].icon} {p}
              </button>
            ))}
          </div>

          {/* 날짜 + 메모 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">날짜</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">콘텐츠 메모 (선택)</label>
              <input
                type="text"
                placeholder="예: 명동 매장 소개 영상"
                value={form.content_note}
                onChange={e => setForm(f => ({ ...f, content_note: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
              />
            </div>
          </div>

          {/* 플랫폼별 지표 */}
          <div className="grid grid-cols-4 gap-3">
            {formCfg.fields.map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form[field.key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
                />
              </div>
            ))}
          </div>

          {/* 비용 */}
          <div className="max-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">제작/광고 비용 (원, 선택)</label>
            <input
              type="number"
              placeholder="예: 500000"
              value={form.cost}
              onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      )}

      {/* 플랫폼 탭 */}
      <div className="flex gap-1 mb-4 border-b border-gray-100 pb-1">
        {PLATFORMS.map(p => {
          const c = PLATFORM_CONFIG[p]
          const count = list.filter(r => r.platform === p).length
          return (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === p ? 'bg-rose-50 text-rose-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {c.icon} {p}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === p ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-400'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-4">
          {cfg.icon} {tab} 성과 데이터가 없습니다
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const roi = calcRoi(r, storeSales)
            const fields = PLATFORM_CONFIG[r.platform].fields
            return (
              <div key={r.id} className={`rounded-lg border border-gray-100 ${cfg.bg} px-4 py-3`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base">{cfg.icon}</span>
                      <span className={`text-sm font-semibold ${cfg.color}`}>{r.date}</span>
                      {r.content_note && (
                        <span className="text-xs text-gray-500 truncate">{r.content_note}</span>
                      )}
                    </div>
                    {/* 지표 뱃지 */}
                    <div className="flex flex-wrap gap-2">
                      {fields.map(field => {
                        const val = r[field.key as keyof OwnedMediaRecord] as number
                        if (!val || val <= 0) return null
                        return (
                          <span key={field.key} className="text-xs text-gray-600 bg-white rounded-md px-2 py-0.5 border border-gray-100">
                            {field.label} {val.toLocaleString()}
                          </span>
                        )
                      })}
                      {r.cost && r.cost > 0 && (
                        <span className="text-xs text-gray-400 bg-white rounded-md px-2 py-0.5 border border-gray-100">
                          비용 ₩{r.cost.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
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
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="text-gray-300 hover:text-red-400 text-xs"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
