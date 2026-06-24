import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

type StoreConfig = {
  name: string
  id: string
  pw: string
}

const LOGIN_URL = 'https://merchant.gtfetrs.com/dataSearch/login?returnURL=https://merchant.gtfetrs.com/dataSearch/data_search_tab_parent'

// 국가명 판별: 숫자·키워드 제외하고 2~10자 한글/영문
const COUNTRY_KEYWORDS = ['기간', '계', '합계', '판매금액', '발행건수', '전일대비', '구분', '지점명', '조건선택', '단위선택', '발행일자', '매장명', '소계', '국적']

function parseAmount(str: string): number {
  return parseInt(str.replace(/[^0-9]/g, '') || '0')
}

function isCountryName(text: string): boolean {
  if (!text || text.length < 2 || text.length > 12) return false
  if (/^\d/.test(text)) return false
  if (COUNTRY_KEYWORDS.some(k => text.includes(k))) return false
  return true
}

type Cell = { text: string; colspan: number }

async function clickSearch(frame: { evaluate: (fn: () => string) => Promise<string> }) {
  return frame.evaluate(() => {
    const all = Array.from(document.querySelectorAll('a, button, input')) as HTMLElement[]
    const btn = all.find(el =>
      el.innerText?.trim() === '조회' ||
      (el as HTMLInputElement).value?.trim() === '조회'
    )
    if (btn) { btn.click(); return 'clicked' }
    return 'not found'
  })
}

function parseDateRow(tableData: Cell[][]): string[] {
  const dateRow = tableData.find((r) => r.some(c => /^\d{4}-\d{2}-\d{2}$/.test(c.text.trim())))
  return (dateRow
    ?.filter(c => /^\d{4}-\d{2}-\d{2}$/.test(c.text.trim()))
    .map(c => c.text.trim())
    .filter((d, i, arr) => arr.indexOf(d) === i)
  ) ?? []
}

export async function scrapeGtfetrs(store: StoreConfig) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  try {
    // ── 로그인 ──
    console.log(`[택스리펀:${store.name}] 로그인 중...`)
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle' })
    await page.locator('#inp_id').fill(store.id)
    await page.evaluate((pw: string) => {
      const el = document.querySelector('#inp_pwd') as HTMLInputElement
      if (!el) return
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
      setter ? setter.call(el, pw) : (el.value = pw)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, store.pw)

    const loginBtn = page.locator('button:has-text("로그인"), button[type="submit"], input[type="submit"], a:has-text("로그인")')
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
      loginBtn.first().click(),
    ])
    await page.waitForTimeout(1000)

    if (page.url().includes('login')) {
      await page.goto(LOGIN_URL, { waitUntil: 'networkidle' })
      await page.locator('#inp_id').fill(store.id)
      await page.locator('#inp_pwd').click()
      await page.keyboard.type(store.pw, { delay: 30 })
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {}),
        loginBtn.first().click(),
      ])
      await page.waitForTimeout(1000)
    }

    if (page.url().includes('login')) {
      console.error(`[택스리펀:${store.name}] 로그인 실패`)
      return
    }
    console.log(`[택스리펀:${store.name}] 로그인 성공`)

    // ── 일별 발행내역 이동 ──
    await page.locator('a:has-text("일별 발행내역")').click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    let frame = page.frames().find(f => f.url().includes('data_search_day'))
    if (!frame) {
      await page.waitForTimeout(2000)
      frame = page.frames().find(f => f.url().includes('data_search_day'))
    }
    if (!frame) {
      console.error(`[택스리펀:${store.name}] 프레임 없음`)
      return
    }

    const records: { date: string; store: string; country: string; amount: number; count: number }[] = []

    // 날짜 범위를 설정하고 조회하는 헬퍼 (30일씩 분할)
    const setDateRange = async (startStr: string, endStr: string) => {
      await frame!.evaluate((s) => {
        const el = document.getElementById('startDay') as HTMLInputElement
        if (el) { el.value = s; el.dispatchEvent(new Event('change', { bubbles: true })) }
      }, startStr)
      await frame!.evaluate((e) => {
        const el = document.getElementById('endDay') as HTMLInputElement
        if (el) { el.value = e; el.dispatchEvent(new Event('change', { bubbles: true })) }
      }, endStr)
      await page.waitForTimeout(300)
    }

    // 30일씩 최대 2개 구간 조회 (최근 30일 + 이전 30일)
    const periods: { startOffset: number; endOffset: number }[] = [
      { startOffset: 30, endOffset: 1 },
      { startOffset: 60, endOffset: 31 },
    ]

    for (const { startOffset, endOffset } of periods) {
      const endDate = new Date(); endDate.setDate(endDate.getDate() - endOffset)
      const startDate = new Date(); startDate.setDate(startDate.getDate() - startOffset)
      const startStr = startDate.toISOString().split('T')[0]
      const endStr = endDate.toISOString().split('T')[0]

      await setDateRange(startStr, endStr)

      // ── 1단계: 기간별 조회 (합계) ──
      // 기간별 탭으로 전환
      await frame!.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*')) as HTMLElement[]
        const el = all.find(e => e.children.length === 0 && e.innerText?.trim() === '기간별')
        if (el) el.click()
      })
      await page.waitForTimeout(500)
      await clickSearch(frame as Parameters<typeof clickSearch>[0])
      await page.waitForTimeout(5000)

      const tableData1 = await frame!.evaluate(() =>
        Array.from(document.querySelectorAll('table tr')).map(tr =>
          Array.from(tr.querySelectorAll('td,th')).map(td => ({
            text: (td as HTMLElement).innerText.trim(),
            colspan: (td as HTMLTableCellElement).colSpan || 1,
          }))
        )
      ) as Cell[][]

      const dates = parseDateRow(tableData1)
      console.log(`[택스리펀:${store.name}] 기간별 날짜 (${dates.length}개) ${startStr}~${endStr}`)

      if (dates.length > 0) {
        const amountRow = tableData1.find(r =>
          r.filter(c => /^[\d,]+$/.test(c.text) && parseAmount(c.text) > 1_000_000).length >= 3
        )
        if (amountRow) {
          const allNums = amountRow.map(c => c.text).filter(t => /^[\d,]+$/.test(t)).map(parseAmount)
          const dailyAmounts = allNums.filter(n => n > 100_000).slice(0, dates.length)
          const dailyCounts = allNums.filter(n => n >= 10 && n <= 9999).slice(0, dates.length)
          dates.forEach((d, i) => {
            if ((dailyAmounts[i] ?? 0) > 0)
              records.push({ date: d, store: store.name, country: '합계', amount: dailyAmounts[i], count: dailyCounts[i] ?? 0 })
          })
          console.log(`[택스리펀:${store.name}] 기간별 ${records.filter(r => r.country === '합계').length}건 누적`)
        }
      }

      // ── 2단계: 국적별 조회 ──
      await frame!.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*')) as HTMLElement[]
        const el = all.find(e => e.children.length === 0 && e.innerText?.trim() === '국적별')
        if (el) el.click()
      })
      await page.waitForTimeout(2000)
      await clickSearch(frame as Parameters<typeof clickSearch>[0])
      await page.waitForTimeout(4000)

      const tableData2 = await frame!.evaluate(() =>
        Array.from(document.querySelectorAll('table tr')).map((tr, ri) => ({
          ri,
          cells: Array.from(tr.querySelectorAll('td,th')).map(td => ({
            text: (td as HTMLElement).innerText.trim(),
            colspan: (td as HTMLTableCellElement).colSpan || 1,
          }))
        }))
      ) as { ri: number; cells: Cell[] }[]

      const dates2 = parseDateRow(tableData2.map(r => r.cells))
      console.log(`[택스리펀:${store.name}] 국적별 날짜:`, dates2.length, '개')

      const nationSectionStart = tableData2.findIndex(r => r.cells.some(c => c.text === '국적'))
      const afterNation = nationSectionStart >= 0 ? tableData2.slice(nationSectionStart) : tableData2
      const countryRows = afterNation.filter(r =>
        r.cells.length === 2 && isCountryName(r.cells[1]?.text ?? '')
      )
      const lastCountryRi = countryRows.length > 0 ? countryRows[countryRows.length - 1].ri : 0
      const amountRows = tableData2.filter(r => {
        if (r.ri <= lastCountryRi) return false
        if (r.cells.length < 1 + dates2.length) return false
        const hasLargeAmt = r.cells.slice(1, 1 + dates2.length).some(c => /^[\d,]+$/.test(c.text) && parseAmount(c.text) > 10_000)
        return hasLargeAmt
      })

      const nationRecordsBatch: typeof records = []
      countryRows.forEach((nameRow, i) => {
        const amtRow = amountRows[i + 1]
        if (!amtRow) return
        const country = nameRow.cells[1].text
        const dailyAmts = amtRow.cells.slice(1, 1 + dates2.length).map(c =>
          /^[\d,]+$/.test(c.text) ? parseAmount(c.text) : 0
        )
        dates2.forEach((d, di) => {
          if ((dailyAmts[di] ?? 0) > 0)
            nationRecordsBatch.push({ date: d, store: store.name, country, amount: dailyAmts[di], count: 0 })
        })
      })
      records.push(...nationRecordsBatch)
      console.log(`[택스리펀:${store.name}] 국적별 ${nationRecordsBatch.length}건 추가 (${countryRows.length}개국)`)
    }

    // 중복 제거 (date+country+store 기준 마지막 값 유지)
    const dedupMap = new Map<string, typeof records[0]>()
    for (const r of records) {
      dedupMap.set(`${r.date}|${r.country}|${r.store}`, r)
    }
    const allRecords = Array.from(dedupMap.values())
    console.log(`[택스리펀:${store.name}] 중복 제거 후 ${allRecords.length}건`)

    if (allRecords.length > 0) {
      // 500건씩 나눠서 저장 (upsert 한 번에 너무 많으면 오류)
      const chunkSize = 500
      let saved = 0
      for (let i = 0; i < allRecords.length; i += chunkSize) {
        const chunk = allRecords.slice(i, i + chunkSize)
        const { error } = await supabase.from('tax_refund_sales').upsert(chunk, { onConflict: 'date,country,store' })
        if (error) { console.error(`[택스리펀:${store.name}] DB 오류:`, error.message); break }
        saved += chunk.length
      }
      console.log(`[택스리펀:${store.name}] ✅ 총 ${saved}건 저장`)
    } else {
      console.log(`[택스리펀:${store.name}] ⚠️ 파싱 실패`)
      await page.screenshot({ path: `logs/gtfetrs_${store.name}_debug.png` })
    }

  } finally {
    await browser.close()
  }
}
