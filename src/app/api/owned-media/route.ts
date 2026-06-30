import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabase
    .from('owned_media')
    .select('*')
    .order('date', { ascending: false })
  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { platform, date, content_note, views, likes, saves, shares, comments, cost } = body
  const { data, error } = await supabase
    .from('owned_media')
    .insert({ platform, date, content_note, views, likes, saves, shares, comments, cost })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await supabase.from('owned_media').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
