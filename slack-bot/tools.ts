import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '.env') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const tools: Anthropic.Tool[] = [
  {
    name: 'query_sales',
    description: '매장 일별 매출과 건수를 조회합니다. 명동/성수 각각 또는 합산 조회 가능.',
    input_schema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD 시작일' },
        to: { type: 'string', description: 'YYYY-MM-DD 종료일' },
        store: { type: 'string', description: '명동 또는 성수 (생략 시 전체)' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'query_tax_refund',
    description: '국가별 택스리펀 금액과 건수를 조회합니다. country=합계 행이 일별 총계.',
    input_schema: {
      type: 'object' as const,
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD 시작일' },
        to: { type: 'string', description: 'YYYY-MM-DD 종료일' },
        country: { type: 'string', description: '국가명 (생략 시 전체). 합계=일별 총합' },
        store: { type: 'string', description: '명동 또는 성수 (생략 시 전체)' },
      },
      required: ['from', 'to'],
    },
  },
  {
    name: 'query_hourly',
    description: '특정 날짜의 시간대별(0~23시) 매출과 건수를 조회합니다.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'YYYY-MM-DD 날짜' },
        store: { type: 'string', description: '명동 또는 성수 (생략 시 전체)' },
      },
      required: ['date'],
    },
  },
]

type ToolInput = Record<string, string>

export async function executeTool(name: string, input: ToolInput): Promise<unknown> {
  if (name === 'query_sales') {
    let query = supabase
      .from('store_sales')
      .select('date, store, amount, count, avg_order_value')
      .gte('date', input.from)
      .lte('date', input.to)
      .order('date', { ascending: true })
    if (input.store) query = query.eq('store', input.store)
    const { data, error } = await query
    if (error) return { error: error.message }
    return data
  }

  if (name === 'query_tax_refund') {
    let query = supabase
      .from('tax_refund_sales')
      .select('date, store, country, amount, count')
      .gte('date', input.from)
      .lte('date', input.to)
      .order('date', { ascending: true })
    if (input.country) query = query.eq('country', input.country)
    if (input.store) query = query.eq('store', input.store)
    const { data, error } = await query
    if (error) return { error: error.message }
    return data
  }

  if (name === 'query_hourly') {
    let query = supabase
      .from('hourly_sales')
      .select('hour, store, amount, count')
      .eq('date', input.date)
      .order('hour', { ascending: true })
    if (input.store) query = query.eq('store', input.store)
    const { data, error } = await query
    if (error) return { error: error.message }
    return data
  }

  return { error: '알 수 없는 도구' }
}
