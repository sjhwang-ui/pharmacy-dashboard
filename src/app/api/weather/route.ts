import { NextRequest, NextResponse } from 'next/server'

const WMO_TO_EMOJI: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌧️', 53: '🌧️', 55: '🌧️', 56: '🌧️', 57: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️', 66: '🌧️', 67: '🌧️',
  71: '❄️', 73: '❄️', 75: '❄️', 77: '❄️',
  80: '🌦️', 81: '🌦️', 82: '🌦️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) return NextResponse.json({})

  try {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=37.5665&longitude=126.9780&start_date=${from}&end_date=${to}&daily=weather_code&timezone=Asia%2FSeoul`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return NextResponse.json({})
    const json = await res.json()
    const dates: string[] = json.daily?.time ?? []
    const codes: number[] = json.daily?.weather_code ?? []
    // 최근 3일은 관측값이 아닌 모델 예측값이라 부정확 → 제외
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 3)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    const result: Record<string, string> = {}
    dates.forEach((d, i) => {
      if (d <= cutoffStr) result[d] = WMO_TO_EMOJI[codes[i]] ?? '🌡️'
    })
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({})
  }
}
