import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { WebClient } from '@slack/web-api'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'

const slack = new WebClient(process.env.SLACK_BOT_TOKEN)
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function verifySignature(body: string, headers: Headers): boolean {
  const signature = headers.get('x-slack-signature') ?? ''
  const timestamp = headers.get('x-slack-request-timestamp') ?? ''
  const secret = process.env.SLACK_SIGNING_SECRET ?? ''
  const baseString = `v0:${timestamp}:${body}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(baseString)
  const computed = `v0=${hmac.digest('hex')}`
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed))
  } catch {
    return false
  }
}

const tools: Anthropic.Tool[] = [
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
    description: '국가별 택스리펀 금액과 건수를 조회합니다.',
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

async function executeTool(name: string, input: Record<string, string>): Promise<unknown> {
  if (name === 'query_sales') {
    let query = supabase.from('store_sales').select('date,store,amount,count,avg_order_value')
      .gte('date', input.from).lte('date', input.to).order('date', { ascending: true })
    if (input.store) query = query.eq('store', input.store)
    const { data, error } = await query
    return error ? { error: error.message } : data
  }
  if (name === 'query_tax_refund') {
    let query = supabase.from('tax_refund_sales').select('date,store,country,amount,count')
      .gte('date', input.from).lte('date', input.to).order('date', { ascending: true })
    if (input.country) query = query.eq('country', input.country)
    if (input.store) query = query.eq('store', input.store)
    const { data, error } = await query
    return error ? { error: error.message } : data
  }
  if (name === 'query_hourly') {
    let query = supabase.from('hourly_sales').select('hour,store,amount,count')
      .eq('date', input.date).order('hour', { ascending: true })
    if (input.store) query = query.eq('store', input.store)
    const { data, error } = await query
    return error ? { error: error.message } : data
  }
  return { error: '알 수 없는 도구' }
}

const today = () => new Date().toISOString().split('T')[0]
const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0] }

const SYSTEM_PROMPT = `당신은 퓨어약국의 마케팅 데이터 분석 어시스턴트입니다.
명동과 성수 두 매장의 매출, 택스리펀, 시간대별 데이터에 접근할 수 있습니다.
주요 고객은 중국, 일본, 대만 등 동아시아 외국인 관광객입니다.
항상 한국어로 답변. 금액은 ₩ 기호와 쉼표 포맷. 퍼센트 변화는 ↑↓ 기호.
"어제"는 ${yesterday()} 기준, "오늘"은 ${today()} 기준.
"이번달"은 ${today().slice(0, 7)}-01 ~ ${today()} 기준.
간결하게 핵심만 답변 (5줄 이내).`

async function askClaude(question: string, history: Anthropic.MessageParam[]): Promise<{ answer: string; history: Anthropic.MessageParam[] }> {
  const messages: Anthropic.MessageParam[] = [...history, { role: 'user', content: question }]
  for (let i = 0; i < 5; i++) {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    })
    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find(b => b.type === 'text')
      const answer = textBlock?.type === 'text' ? textBlock.text : '답변을 생성할 수 없어요.'
      return {
        answer,
        history: [...history, { role: 'user', content: question }, { role: 'assistant', content: answer }],
      }
    }
    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input as Record<string, string>)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) })
        }
      }
      messages.push({ role: 'user', content: toolResults })
    }
  }
  return { answer: '처리 중 오류가 발생했어요.', history }
}

// 스레드별 대화 히스토리 (Supabase 저장)
async function loadHistory(threadTs: string): Promise<Anthropic.MessageParam[]> {
  const { data } = await supabase.from('slack_threads').select('messages').eq('thread_ts', threadTs).single()
  return (data?.messages as Anthropic.MessageParam[]) ?? []
}

async function saveHistory(threadTs: string, history: Anthropic.MessageParam[]) {
  await supabase.from('slack_threads').upsert({ thread_ts: threadTs, messages: history, updated_at: new Date().toISOString() })
}

async function handleMention(event: { text: string; ts: string; thread_ts?: string; channel: string }) {
  const question = event.text.replace(/<@[^>]+>/g, '').trim()
  if (!question) return

  const threadKey = event.thread_ts ?? event.ts
  try {
    await slack.chat.postMessage({ channel: event.channel, text: '분석 중... ⏳', thread_ts: event.ts })
    const history = await loadHistory(threadKey)
    const { answer, history: updatedHistory } = await askClaude(question, history)
    await saveHistory(threadKey, updatedHistory)
    await slack.chat.postMessage({ channel: event.channel, text: answer, thread_ts: event.ts })
  } catch (err) {
    console.error(err)
    await slack.chat.postMessage({ channel: event.channel, text: '오류가 발생했어요. 잠시 후 다시 시도해주세요.', thread_ts: event.ts })
  }
}

export async function POST(req: NextRequest) {
  // 슬랙 재시도 요청 무시
  if (req.headers.get('x-slack-retry-num')) {
    return NextResponse.json({ ok: true })
  }

  const body = await req.text()
  const payload = JSON.parse(body)

  // URL 인증 챌린지
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge })
  }

  // 서명 검증
  if (!verifySignature(body, req.headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = payload.event
  if (event?.type === 'app_mention') {
    waitUntil(handleMention(event))
  }

  return NextResponse.json({ ok: true })
}
