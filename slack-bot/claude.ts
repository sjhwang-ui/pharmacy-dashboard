import Anthropic from '@anthropic-ai/sdk'
import { tools, executeTool } from './tools'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '.env') })

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const today = () => new Date().toISOString().split('T')[0]
const yesterday = () => {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

const SYSTEM_PROMPT = `당신은 퓨어약국의 마케팅 데이터 분석 어시스턴트입니다.
명동과 성수 두 매장의 매출, 택스리펀, 시간대별 데이터에 접근할 수 있습니다.
주요 고객은 중국, 일본, 대만 등 동아시아 외국인 관광객입니다.

규칙:
- 항상 한국어로 답변
- 금액은 ₩ 기호와 쉼표 포맷 (예: ₩3,240,000)
- 퍼센트 변화 있으면 ↑↓ 기호 사용
- "어제"는 ${yesterday()} 기준
- "오늘"은 ${today()} 기준
- "이번달"은 ${today().slice(0, 7)}-01 ~ ${today()} 기준
- 간결하게 핵심만 답변 (5줄 이내)
`

export type ConversationHistory = Anthropic.MessageParam[]

export async function askClaude(
  question: string,
  history: ConversationHistory = []
): Promise<{ answer: string; history: ConversationHistory }> {
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: question },
  ]

  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    })

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text')
      const answer = textBlock && textBlock.type === 'text'
        ? textBlock.text
        : '답변을 생성할 수 없어요.'

      // 대화 히스토리에 이번 턴 추가 (tool_use 중간 메시지 제외, user+assistant만)
      const updatedHistory: ConversationHistory = [
        ...history,
        { role: 'user', content: question },
        { role: 'assistant', content: answer },
      ]

      return { answer, history: updatedHistory }
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await executeTool(block.name, block.input as Record<string, string>)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
      }
      messages.push({ role: 'user', content: toolResults })
    }
  }

  return { answer: '처리 중 오류가 발생했어요.', history }
}
