import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

type StoreConfig = {
  name: string
  id: string
  pw: string
}

function parseAmount(str: string): number {
  return parseInt(str.replace(/[^0-9]/g, '') || '0')
}

export async function scrapeAllthatpay(store: StoreConfig) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()

  try {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    const todayStr = today.toISOString().split('T')[0]
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // 로그인
    console.log(`[올댓페이:${store.name}] 로그인 중...`)
    await page.goto('https://scmadm.allthatpay.kr/', { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('#id', { timeout: 10000 })
    await page.locator('#id').fill(store.id)
    await page.locator('#pwd').fill(store.pw)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      page.locator('button:has-text("로그인")').click(),
    ])
    await page.waitForTimeout(1500)

    if (page.url().includes('login')) {
      console.error(`[올댓페이:${store.name}] 로그인 실패`)
      return
    }
    console.log(`[올댓페이:${store.name}] 로그인 성공 →`, page.url())

    // ── 1단계: 메인 페이지에서 오늘/어제 매출 파싱 ──
    const mainText = await page.innerText('body')
    console.log(`[올댓페이:${store.name}] 메인 본문:\n`, mainText.slice(0, 800))

    const records: { date: string; store: string; amount: number; count: number; avg_order_value: number }[] = []

    // 오늘 매출 (패턴: "오늘의 전체 매출은\n9,216,000원")
    const todayAmountMatch = mainText.match(/오늘의 전체 매출은[\s\n]*([\d,]+)원/)
    const todayCountMatch = mainText.match(/오늘 판매 상품[\s\n]*([\d,]+)건/)
    if (todayAmountMatch) {
      const amount = parseAmount(todayAmountMatch[1])
      const count = todayCountMatch ? parseAmount(todayCountMatch[1]) : 0
      records.push({ date: todayStr, store: store.name, amount, count, avg_order_value: count > 0 ? Math.round(amount / count) : 0 })
      console.log(`[올댓페이:${store.name}] 오늘(${todayStr}): ${amount}원, ${count}건`)
    }

    // 어제 매출 (패턴: "어제 매출\n26,143,300원")
    const yestAmountMatch = mainText.match(/어제 매출[\s\n]*([\d,]+)원/)
    if (yestAmountMatch) {
      const amount = parseAmount(yestAmountMatch[1])
      records.push({ date: yesterdayStr, store: store.name, amount, count: 0, avg_order_value: 0 })
      console.log(`[올댓페이:${store.name}] 어제(${yesterdayStr}): ${amount}원`)
    }

    // ── 2단계: 매출내역(/shop/hist)에서 일별 상세 데이터 ──
    await page.goto('https://scmadm.allthatpay.kr/shop/hist', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    console.log(`[올댓페이:${store.name}] hist URL:`, page.url())

    if (!page.url().includes('login')) {
      // hist 페이지는 hidden input만 있음 → 기본 로드된 테이블 파싱만
      console.log(`[올댓페이:${store.name}] hist 페이지 기본 데이터 파싱`)

      // 테이블 파싱
      const rows = await page.$$eval('table tr', trs =>
        trs.map(tr => Array.from(tr.querySelectorAll('td,th')).map(td => (td as HTMLElement).innerText.trim()))
      )
      console.log(`[올댓페이:${store.name}] hist 테이블 행:`, rows.length)
      rows.slice(0, 20).forEach((r, i) => {
        if (r.some(c => c.trim())) console.log(`  행${i}:`, r.join(' | '))
      })

      // YYYYMMDD 패턴 행에서 금액/건수 추출
      for (const row of rows) {
        const cells = row.filter(c => c.trim())
        const dateCell = cells.find(c => /^\d{8}$/.test(c) || /^\d{4}-\d{2}-\d{2}$/.test(c))
        if (!dateCell) continue
        const date = dateCell.length === 8
          ? `${dateCell.slice(0, 4)}-${dateCell.slice(4, 6)}-${dateCell.slice(6, 8)}`
          : dateCell
        const nums = cells.filter(c => c !== dateCell && /^[\d,]+$/.test(c)).map(c => parseAmount(c))
        if (nums.length >= 2) {
          const amount = Math.max(...nums)
          const count = nums.find(n => n < 10000 && n > 0) ?? 0
          const avg = count > 0 ? Math.round(amount / count) : 0
          // 메인페이지에서 이미 넣은 날짜면 덮어쓰기
          const existing = records.findIndex(r => r.date === date && r.store === store.name)
          if (existing >= 0) {
            records[existing] = { date, store: store.name, amount, count, avg_order_value: avg }
          } else {
            records.push({ date, store: store.name, amount, count, avg_order_value: avg })
          }
        }
      }
    }

    // ── 3단계: 매출캘린더(/shop/calen)에서 해당 월 전체 일별 데이터 ──
    await page.goto('https://scmadm.allthatpay.kr/shop/calen', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    if (!page.url().includes('login')) {
      const calenText = await page.innerText('body')

      // 년/월 추출: "2026년 06월"
      const yearMonthMatch = calenText.match(/(\d{4})년\s*(\d{2})월/)
      if (yearMonthMatch) {
        const year = yearMonthMatch[1]
        const month = yearMonthMatch[2]

        // 패턴: 일(1~31) → 합계 → 금액원 (건수건)
        const dayPattern = /(?:^|\n)(\d{1,2})\n합계\n([\d,]+)원 \((\d+)건\)/g
        let m: RegExpExecArray | null
        while ((m = dayPattern.exec(calenText)) !== null) {
          const day = String(parseInt(m[1])).padStart(2, '0')
          const date = `${year}-${month}-${day}`
          const amount = parseAmount(m[2])
          const count = parseInt(m[3])
          if (amount > 0) {
            const existing = records.findIndex(r => r.date === date && r.store === store.name)
            if (existing >= 0) {
              records[existing] = { date, store: store.name, amount, count, avg_order_value: count > 0 ? Math.round(amount / count) : 0 }
            } else {
              records.push({ date, store: store.name, amount, count, avg_order_value: count > 0 ? Math.round(amount / count) : 0 })
            }
          }
        }
        console.log(`[올댓페이:${store.name}] 캘린더 ${year}-${month} 파싱 완료`)
      }
    }

    console.log(`[올댓페이:${store.name}] 최종 records:`, records)

    if (records.length > 0) {
      const { error } = await supabase.from('store_sales').upsert(records, { onConflict: 'date,store' })
      if (error) console.error(`[올댓페이:${store.name}] DB 오류:`, error.message)
      else console.log(`[올댓페이:${store.name}] ✅ ${records.length}건 저장 완료`)
    } else {
      console.log(`[올댓페이:${store.name}] ⚠️ 저장할 데이터 없음`)
    }

  } finally {
    await browser.close()
  }
}
