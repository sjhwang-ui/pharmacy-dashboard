import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  let from: string
  let to: string | undefined

  if (searchParams.get('from')) {
    from = searchParams.get('from')!
    to = searchParams.get('to') ?? undefined
  } else {
    const days = parseInt(searchParams.get('days') || '30')
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - days)
    from = fromDate.toISOString().split('T')[0]
  }

  const [taxResult, storeResult] = await Promise.all([
    supabase
      .from('tax_refund_sales')
      .select('*')
      .gte('date', from)
      .lte('date', to ?? '9999-12-31')
      .order('date', { ascending: true }),
    supabase
      .from('store_sales')
      .select('*')
      .gte('date', from)
      .lte('date', to ?? '9999-12-31')
      .order('date', { ascending: true }),
  ])

  return NextResponse.json({
    taxRefund: taxResult.data ?? [],
    storeSales: storeResult.data ?? [],
  })
}
