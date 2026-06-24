export type Holiday = {
  date: string
  name: string
  country: 'KR' | 'CN' | 'JP' | 'TW'
  type: 'major' | 'normal'
}

export const COUNTRY_CONFIG = {
  KR: { label: '한국', flag: '🇰🇷', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400', border: 'border-red-200', stroke: '#f87171' },
  CN: { label: '중국', flag: '🇨🇳', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400', border: 'border-orange-200', stroke: '#fb923c' },
  JP: { label: '일본', flag: '🇯🇵', bg: 'bg-pink-50', text: 'text-pink-700', dot: 'bg-pink-400', border: 'border-pink-200', stroke: '#f472b6' },
  TW: { label: '대만', flag: '🇹🇼', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400', border: 'border-blue-200', stroke: '#60a5fa' },
} as const

export type CountryKey = keyof typeof COUNTRY_CONFIG

export const HOLIDAYS: Holiday[] = [
  // ── 한국 ──
  { date: '2026-01-01', name: '신정', country: 'KR', type: 'normal' },
  { date: '2026-01-28', name: '설 연휴', country: 'KR', type: 'major' },
  { date: '2026-01-29', name: '설날', country: 'KR', type: 'major' },
  { date: '2026-01-30', name: '설 연휴', country: 'KR', type: 'major' },
  { date: '2026-03-01', name: '삼일절', country: 'KR', type: 'normal' },
  { date: '2026-05-05', name: '어린이날', country: 'KR', type: 'normal' },
  { date: '2026-05-15', name: '부처님오신날', country: 'KR', type: 'normal' },
  { date: '2026-06-06', name: '현충일', country: 'KR', type: 'normal' },
  { date: '2026-08-15', name: '광복절', country: 'KR', type: 'normal' },
  { date: '2026-09-24', name: '추석 연휴', country: 'KR', type: 'major' },
  { date: '2026-09-25', name: '추석', country: 'KR', type: 'major' },
  { date: '2026-09-26', name: '추석 연휴', country: 'KR', type: 'major' },
  { date: '2026-10-03', name: '개천절', country: 'KR', type: 'normal' },
  { date: '2026-10-09', name: '한글날', country: 'KR', type: 'normal' },
  { date: '2026-12-25', name: '크리스마스', country: 'KR', type: 'normal' },
  // ── 중국 ──
  { date: '2026-01-01', name: '신정', country: 'CN', type: 'normal' },
  { date: '2026-01-28', name: '춘절 연휴', country: 'CN', type: 'major' },
  { date: '2026-01-29', name: '춘절', country: 'CN', type: 'major' },
  { date: '2026-02-03', name: '춘절 연휴 끝', country: 'CN', type: 'major' },
  { date: '2026-04-04', name: '청명절', country: 'CN', type: 'normal' },
  { date: '2026-05-01', name: '노동절', country: 'CN', type: 'major' },
  { date: '2026-05-03', name: '노동절 연휴', country: 'CN', type: 'major' },
  { date: '2026-05-22', name: '단오절', country: 'CN', type: 'normal' },
  { date: '2026-09-23', name: '중추절', country: 'CN', type: 'major' },
  { date: '2026-10-01', name: '국경절 연휴', country: 'CN', type: 'major' },
  { date: '2026-10-07', name: '국경절 연휴 끝', country: 'CN', type: 'major' },
  // ── 일본 ──
  { date: '2026-01-01', name: '신정', country: 'JP', type: 'normal' },
  { date: '2026-01-12', name: '성인의 날', country: 'JP', type: 'normal' },
  { date: '2026-02-11', name: '건국기념일', country: 'JP', type: 'normal' },
  { date: '2026-03-20', name: '춘분', country: 'JP', type: 'normal' },
  { date: '2026-04-29', name: '쇼와의 날 (골든위크)', country: 'JP', type: 'major' },
  { date: '2026-05-03', name: '헌법기념일 (골든위크)', country: 'JP', type: 'major' },
  { date: '2026-05-04', name: '녹색의 날 (골든위크)', country: 'JP', type: 'major' },
  { date: '2026-05-05', name: '어린이날 (골든위크)', country: 'JP', type: 'major' },
  { date: '2026-07-20', name: '바다의 날', country: 'JP', type: 'normal' },
  { date: '2026-08-11', name: '산의 날', country: 'JP', type: 'normal' },
  { date: '2026-08-13', name: '오봉 시작', country: 'JP', type: 'major' },
  { date: '2026-08-16', name: '오봉 끝', country: 'JP', type: 'major' },
  { date: '2026-09-21', name: '경로의 날', country: 'JP', type: 'normal' },
  { date: '2026-09-23', name: '추분', country: 'JP', type: 'normal' },
  { date: '2026-11-03', name: '문화의 날', country: 'JP', type: 'normal' },
  { date: '2026-11-23', name: '근로감사의 날', country: 'JP', type: 'normal' },
  { date: '2026-12-23', name: '일왕 생일', country: 'JP', type: 'normal' },
  // ── 대만 ──
  { date: '2026-01-01', name: '신정', country: 'TW', type: 'normal' },
  { date: '2026-01-28', name: '춘절 시작', country: 'TW', type: 'major' },
  { date: '2026-02-02', name: '춘절 끝', country: 'TW', type: 'major' },
  { date: '2026-02-28', name: '평화기념일', country: 'TW', type: 'normal' },
  { date: '2026-04-04', name: '어린이날', country: 'TW', type: 'normal' },
  { date: '2026-04-05', name: '청명절', country: 'TW', type: 'normal' },
  { date: '2026-05-01', name: '노동절', country: 'TW', type: 'normal' },
  { date: '2026-06-19', name: '단오절', country: 'TW', type: 'normal' },
  { date: '2026-09-27', name: '중추절', country: 'TW', type: 'major' },
  { date: '2026-10-10', name: '쌍십절', country: 'TW', type: 'major' },
]
