import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const [storeRes, taxRes] = await Promise.all([
    supabase.from('store_sales').select('date').order('date', { ascending: true }).limit(1),
    supabase.from('tax_refund_sales').select('date').order('date', { ascending: true }).limit(1),
  ])

  const dates = [
    storeRes.data?.[0]?.date,
    taxRes.data?.[0]?.date,
  ].filter(Boolean) as string[]

  if (dates.length === 0) {
    return NextResponse.json({ date: null })
  }

  const earliest = dates.sort()[0]
  return NextResponse.json({ date: earliest })
}
