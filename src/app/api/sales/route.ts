import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

async function fetchAll<T>(table: string, from: string, to: string): Promise<T[]> {
  const PAGE = 1000
  const results: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error || !data || data.length === 0) break
    results.push(...(data as T[]))
    if (data.length < PAGE) break
    offset += PAGE
  }
  return results
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  let from: string
  let to: string

  if (searchParams.get('from')) {
    from = searchParams.get('from')!
    to = searchParams.get('to') ?? '9999-12-31'
  } else {
    const days = parseInt(searchParams.get('days') || '30')
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    from = fromDate.toISOString().split('T')[0]
    to = '9999-12-31'
  }

  const [taxRefund, storeSales] = await Promise.all([
    fetchAll('tax_refund_sales', from, to),
    fetchAll('store_sales', from, to),
  ])

  return NextResponse.json({ taxRefund, storeSales })
}
