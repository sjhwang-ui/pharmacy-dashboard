import { App } from '@slack/bolt'
import { askClaude, ConversationHistory } from './claude'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '.env') })

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
})

// 스레드별 대화 히스토리 (thread_ts → history)
const threadHistory = new Map<string, ConversationHistory>()

app.event('app_mention', async ({ event, say }) => {
  const e = event as { text: string; ts: string; thread_ts?: string }
  const question = e.text.replace(/<@[^>]+>/g, '').trim()
  const threadKey = e.thread_ts ?? e.ts  // 스레드 내 답글이면 thread_ts, 새 멘션이면 ts

  if (!question) {
    await say({ text: '질문을 입력해주세요! 예: `@PureBot 어제 명동 매출 알려줘`', thread_ts: e.ts })
    return
  }

  try {
    await say({ text: '분석 중... :hourglass_flowing_sand:', thread_ts: e.ts })
    const history = threadHistory.get(threadKey) ?? []
    const { answer, history: updatedHistory } = await askClaude(question, history)
    threadHistory.set(threadKey, updatedHistory)
    await say({ text: answer, thread_ts: e.ts })
  } catch (err) {
    console.error(err)
    await say({ text: '오류가 발생했어요. 잠시 후 다시 시도해주세요.', thread_ts: e.ts })
  }
})

;(async () => {
  await app.start()
  console.log('✅ 퓨어약국 슬랙 봇 실행 중...')
})()
