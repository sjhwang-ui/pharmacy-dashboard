import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('influencer_ppl')
    .select('*')
    .order('date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { date, name, engagement, note } = body
  if (!date || !name) return NextResponse.json({ error: '필수값 누락' }, { status: 400 })
  const { data, error } = await supabase
    .from('influencer_ppl')
    .insert({ date, name, engagement: engagement ?? 0, note: note ?? null })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await supabase.from('influencer_ppl').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
