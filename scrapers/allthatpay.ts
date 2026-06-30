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

async function loginAllthatpay(id: string, pw: string) {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })
  const page = await context.newPage()
  await page.goto('https://scmadm.allthatpay.kr/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#id', { timeout: 10000 })
  await page.locator('#id').fill(id)
  await page.locator('#pwd').fill(pw)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
    page.locator('button:has-text("로그인")').click(),
  ])
  await page.waitForTimeout(1500)
  return { browser, page }
}

export async function scrapeHourlySales(store: StoreConfig) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { browser, page } = await loginAllthatpay(store.id, store.pw)

  try {
    if (page.url().includes('login')) {
      console.error(`[시간통계:${store.name}] 로그인 실패`)
      return
    }

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    await page.goto('https://scmadm.allthatpay.kr/shop/time', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    if (page.url().includes('login')) {
      console.error(`[시간통계:${store.name}] 세션 만료`)
      return
    }

    // "어제" 버튼 클릭
    try {
      await page.locator('button:has-text("어제"), a:has-text("어제")').first().click()
      await page.waitForTimeout(800)
    } catch {
      console.log(`[시간통계:${store.name}] 어제 버튼 없음, 기본값 사용`)
    }

    // 검색 버튼 클릭
    try {
      await page.locator('button:has-text("검색"), input[value="검색"]').first().click()
      await page.waitForTimeout(2000)
    } catch {
      console.log(`[시간통계:${store.name}] 검색 버튼 없음`)
    }

    const rows = await page.$$eval('table tr', trs =>
      trs.map(tr => Array.from(tr.querySelectorAll('td,th')).map(td => (td as HTMLElement).innerText.trim()))
    )

    const hourlyRecords: { date: string; store: string; hour: number; count: number; amount: number }[] = []

    for (const row of rows) {
      const cells = row.filter(c => c.trim())
      // 테이블 구조: [순위, 시간대, 최고판매상품, 품목수, 판매수량, 판매금액, ...]
      // 순위는 숫자 or "-", 시간대는 2자리 08~23
      if (cells.length < 4) continue
      const hourStr = cells[1]
      if (!hourStr || !/^\d{2}$/.test(hourStr) || parseInt(hourStr) > 23) continue
      const hour = parseInt(hourStr)

      // 판매금액: "원" 포함 셀 (이익률 % 제외)
      const amountCell = cells.find(c => c.includes('원') && !c.includes('%'))
      const amount = amountCell ? parseAmount(amountCell) : 0

      // 판매수량: index 4 (판매금액보다 작은 순수 숫자)
      const countStr = cells[4]
      const count = countStr && /^[\d,]+$/.test(countStr) ? parseAmount(countStr) : 0

      if (amount > 0) {
        hourlyRecords.push({ date: yesterdayStr, store: store.name, hour, count, amount })
      }
    }

    // 같은 시간대 중복 제거 (마지막 값 우선)
    const deduped = Object.values(
      hourlyRecords.reduce((acc, r) => { acc[r.hour] = r; return acc }, {} as Record<number, typeof hourlyRecords[0]>)
    )

    console.log(`[시간통계:${store.name}] ${yesterdayStr} → ${deduped.length}개 시간대 파싱`)

    if (deduped.length > 0) {
      const { error } = await supabase.from('hourly_sales').upsert(deduped, { onConflict: 'date,store,hour' })
      if (error) console.error(`[시간통계:${store.name}] DB 오류:`, error.message)
      else console.log(`[시간통계:${store.name}] ✅ ${hourlyRecords.length}건 저장`)
    }
  } finally {
    await browser.close()
  }
}

export async function scrapeAllthatpay(store: StoreConfig) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  console.log(`[올댓페이:${store.name}] 로그인 중...`)
  const { browser, page } = await loginAllthatpay(store.id, store.pw)

  try {
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    const todayStr = today.toISOString().split('T')[0]
    const yesterdayStr = yesterday.toISOString().split('T')[0]

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

    // ── 3단계: 매출캘린더(/shop/calen)에서 최근 3개월 일별 데이터 ──
    const parseCalenPage = async () => {
      await page.waitForTimeout(1500)
      const calenText = await page.innerText('body')
      const yearMonthMatch = calenText.match(/(\d{4})년\s*(\d{1,2})월/)
      if (!yearMonthMatch) return null

      const year = yearMonthMatch[1]
      const month = yearMonthMatch[2].padStart(2, '0')
      const dayPattern = /(?:^|\n)(\d{1,2})\n합계\n([\d,]+)원 \((\d+)건\)/g
      let m: RegExpExecArray | null
      let count = 0
      while ((m = dayPattern.exec(calenText)) !== null) {
        const day = String(parseInt(m[1])).padStart(2, '0')
        const date = `${year}-${month}-${day}`
        const amount = parseAmount(m[2])
        const cnt = parseInt(m[3])
        if (amount > 0) {
          const existing = records.findIndex(r => r.date === date && r.store === store.name)
          if (existing >= 0) {
            records[existing] = { date, store: store.name, amount, count: cnt, avg_order_value: cnt > 0 ? Math.round(amount / cnt) : 0 }
          } else {
            records.push({ date, store: store.name, amount, count: cnt, avg_order_value: cnt > 0 ? Math.round(amount / cnt) : 0 })
          }
          count++
        }
      }
      console.log(`[올댓페이:${store.name}] 캘린더 ${year}-${month} → ${count}일 파싱`)
      return `${year}-${month}`
    }

    await page.goto('https://scmadm.allthatpay.kr/shop/calen', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)

    if (!page.url().includes('login')) {
      // 현재 달 파싱
      await parseCalenPage()

      // 이전 달: i.btn_pre 아이콘 버튼 클릭 (최대 2개월 전까지)
      for (let i = 1; i <= 2; i++) {
        try {
          const prevBtn = page.locator('i.btn_pre').first()
          await prevBtn.click()
          await page.waitForTimeout(2000)
          if (page.url().includes('login')) break
          await parseCalenPage()
        } catch (e) {
          console.log(`[올댓페이:${store.name}] 이전 달(${i}) 이동 실패:`, e)
          break
        }
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
