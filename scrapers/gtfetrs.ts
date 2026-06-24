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

    // ── 1단계: 기간별 조회 (합계) ──
    await page.waitForTimeout(2000)
    await clickSearch(frame as Parameters<typeof clickSearch>[0])
    await page.waitForTimeout(4000)

    const tableData1 = await frame.evaluate(() =>
      Array.from(document.querySelectorAll('table tr')).map(tr =>
        Array.from(tr.querySelectorAll('td,th')).map(td => ({
          text: (td as HTMLElement).innerText.trim(),
          colspan: (td as HTMLTableCellElement).colSpan || 1,
        }))
      )
    ) as Cell[][]

    const dates = parseDateRow(tableData1)
    console.log(`[택스리펀:${store.name}] 기간별 날짜 (${dates.length}개):`, dates)

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
        console.log(`[택스리펀:${store.name}] 기간별 ${records.length}건 파싱`)
      }
    }

    // ── 2단계: 국적별 조회 ──
    console.log(`[택스리펀:${store.name}] 국적별 조회 시작...`)
    await frame.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*')) as HTMLElement[]
      const el = all.find(e => e.children.length === 0 && e.innerText?.trim() === '국적별')
      if (el) el.click()
    })
    await page.waitForTimeout(2000)
    await clickSearch(frame as Parameters<typeof clickSearch>[0])
    await page.waitForTimeout(4000)

    // 행 인덱스 포함해서 추출
    const tableData2 = await frame.evaluate(() =>
      Array.from(document.querySelectorAll('table tr')).map((tr, ri) => ({
        ri,
        cells: Array.from(tr.querySelectorAll('td,th')).map(td => ({
          text: (td as HTMLElement).innerText.trim(),
          colspan: (td as HTMLTableCellElement).colSpan || 1,
        }))
      }))
    ) as { ri: number; cells: Cell[] }[]

    const dates2 = parseDateRow(tableData2.map(r => r.cells))
    console.log(`[택스리펀:${store.name}] 국적별 날짜:`, dates2)

    // 국적별 섹션: '국적' 텍스트가 있는 행 이후만 처리
    const nationSectionStart = tableData2.findIndex(r => r.cells.some(c => c.text === '국적'))
    const afterNation = nationSectionStart >= 0 ? tableData2.slice(nationSectionStart) : tableData2

    // 국가명 행: 셀 2개이고 두번째 셀이 국가명 (합계·키워드 제외)
    const countryRows = afterNation.filter(r =>
      r.cells.length === 2 && isCountryName(r.cells[1]?.text ?? '')
    )

    // 금액 행: 국가명 행 이후에 나타나는 수치 행 (날짜 수 이상의 셀, 최소 1개 이상 금액)
    const lastCountryRi = countryRows.length > 0 ? countryRows[countryRows.length - 1].ri : 0
    const amountRows = tableData2.filter(r => {
      if (r.ri <= lastCountryRi) return false
      if (r.cells.length < 1 + dates2.length) return false
      const hasLargeAmt = r.cells.slice(1, 1 + dates2.length).some(c => /^[\d,]+$/.test(c.text) && parseAmount(c.text) > 10_000)
      return hasLargeAmt
    })

    // 매핑: countryRows[i] ↔ amountRows[i+1] (amountRows[0] = 합계)
    // '-' 값은 0으로 처리, 위치 기반으로 날짜별 금액 추출
    const nationRecords: typeof records = []
    countryRows.forEach((nameRow, i) => {
      const amtRow = amountRows[i + 1] // 합계 건너뜀
      if (!amtRow) return
      const country = nameRow.cells[1].text
      const dailyAmts = amtRow.cells.slice(1, 1 + dates2.length).map(c =>
        /^[\d,]+$/.test(c.text) ? parseAmount(c.text) : 0
      )
      dates2.forEach((d, di) => {
        if ((dailyAmts[di] ?? 0) > 0)
          nationRecords.push({ date: d, store: store.name, country, amount: dailyAmts[di], count: 0 })
      })
    })

    console.log(`[택스리펀:${store.name}] 국적별 ${nationRecords.length}건 파싱 (${countryRows.length}개국)`)

    const allRecords = [...records, ...nationRecords]
    if (allRecords.length > 0) {
      const { error } = await supabase.from('tax_refund_sales').upsert(allRecords, { onConflict: 'date,country,store' })
      if (error) console.error(`[택스리펀:${store.name}] DB 오류:`, error.message)
      else console.log(`[택스리펀:${store.name}] ✅ 총 ${allRecords.length}건 저장 (합계 ${records.length} + 국적별 ${nationRecords.length})`)
    } else {
      console.log(`[택스리펀:${store.name}] ⚠️ 파싱 실패`)
      await page.screenshot({ path: `logs/gtfetrs_${store.name}_debug.png` })
    }

  } finally {
    await browser.close()
  }
}
