'use client'

import { useState } from 'react'

type Props = {
  currentFrom: string
  currentTo: string
  prevFrom: string
  prevTo: string
}

type Status = 'idle' | 'loading' | 'done' | 'error'

// 간단한 마크다운 → JSX 변환 (react-markdown 없이)
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-base font-bold text-gray-800 mt-4 mb-2">{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-sm font-semibold text-gray-700 mt-3 mb-1">{line.slice(4)}</h3>)
    } else if (line.startsWith('- ')) {
      elements.push(
        <li key={key++} className="text-sm text-gray-600 ml-4 mb-1 list-disc">
          {line.slice(2)}
        </li>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} className="h-1" />)
    } else {
      elements.push(<p key={key++} className="text-sm text-gray-600 mb-1">{line}</p>)
    }
  }
  return elements
}

// 날짜 포맷: "2026-06-24" → "6월 24일"
function fmtDate(d: string) {
  const [, m, day] = d.split('-')
  return `${parseInt(m)}월 ${parseInt(day)}일`
}

export default function AIInsights({ currentFrom, currentTo, prevFrom, prevTo }: Props) {
  const [status, setStatus] = useState<Status>('idle')
  const [analysis, setAnalysis] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const run = async () => {
    setStatus('loading')
    setAnalysis('')
    setErrorMsg('')
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentFrom, currentTo, prevFrom, prevTo }),
      })
      const text = await res.text()
      let json: { analysis?: string; error?: string }
      try { json = JSON.parse(text) } catch { throw new Error('서버 응답 오류') }
      if (!res.ok) throw new Error(json.error ?? '분석 실패')
      setAnalysis(json.analysis ?? '')
      setStatus('done')
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : '알 수 없는 오류')
      setStatus('error')
    }
  }

  const periodLabel = `${fmtDate(currentFrom)}~${fmtDate(currentTo)} vs ${fmtDate(prevFrom)}~${fmtDate(prevTo)}`

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h2 className="text-base font-semibold text-gray-700">AI 매출 분석</h2>
          <span className="text-xs text-gray-400">{periodLabel}</span>
        </div>
        {status !== 'loading' && (
          <button
            onClick={run}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 transition"
          >
            {status === 'idle' ? '✨ AI 분석 시작' : status === 'done' ? '🔄 다시 분석' : '🔄 재시도'}
          </button>
        )}
      </div>

      {status === 'idle' && (
        <p className="text-sm text-gray-400">
          전월 대비 매출 변화를 분석하고, 명절·인플루언서·국가별 패턴을 바탕으로 원인을 추론합니다.
        </p>
      )}

      {status === 'loading' && (
        <div className="flex items-center gap-3 py-6 justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
          <span className="text-sm text-indigo-500">데이터 분석 중... (10~20초 소요)</span>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600">
          오류: {errorMsg}
        </div>
      )}

      {status === 'done' && analysis && (
        <div className="mt-1">
          {renderMarkdown(analysis)}
        </div>
      )}
    </div>
  )
}
