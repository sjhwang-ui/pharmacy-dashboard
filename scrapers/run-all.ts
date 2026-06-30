import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
import { scrapeGtfetrs } from './gtfetrs'
import { scrapeAllthatpay, scrapeHourlySales } from './allthatpay'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const stores = {
  gtfetrs: [
    { name: '명동', id: process.env.GTFETRS_MD_ID!, pw: process.env.GTFETRS_MD_PW! },
    { name: '성수', id: process.env.GTFETRS_SS_ID!, pw: process.env.GTFETRS_SS_PW! },
  ],
  allthatpay: [
    { name: '명동', id: process.env.ALLTHATPAY_MD_ID!, pw: process.env.ALLTHATPAY_MD_PW! },
    { name: '성수', id: process.env.ALLTHATPAY_SS_ID!, pw: process.env.ALLTHATPAY_SS_PW! },
  ],
}

async function validate(yesterdayStr: string) {
  const [tax, store, hourly] = await Promise.all([
    supabase.from('tax_refund_sales').select('id', { count: 'exact' }).eq('date', yesterdayStr),
    supabase.from('store_sales').select('id', { count: 'exact' }).eq('date', yesterdayStr),
    supabase.from('hourly_sales').select('id', { count: 'exact' }).eq('date', yesterdayStr),
  ])

  const taxCount = tax.count ?? 0
  const storeCount = store.count ?? 0
  const hourlyCount = hourly.count ?? 0

  console.log(`\n=== 데이터 검증 (${yesterdayStr}) ===`)
  console.log(`택스리펀: ${taxCount}건`)
  console.log(`매장매출: ${storeCount}건`)
  console.log(`시간대별: ${hourlyCount}건`)

  const failed = []
  if (taxCount === 0) failed.push('택스리펀')
  if (storeCount === 0) failed.push('매장매출')
  if (hourlyCount === 0) failed.push('시간대별')

  if (failed.length > 0) {
    console.error(`\n❌ 데이터 누락: ${failed.join(', ')} — 어제(${yesterdayStr}) 데이터 없음`)
    process.exit(1)
  }

  console.log('✅ 모든 데이터 정상 수집 확인')
}

async function main() {
  console.log('=== 데이터 수집 시작 ===', new Date().toLocaleString('ko-KR'))

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  for (const store of stores.gtfetrs) {
    try {
      await scrapeGtfetrs(store)
    } catch (err) {
      console.error(`[택스리펀:${store.name}] 오류:`, err)
    }
  }

  for (const store of stores.allthatpay) {
    try {
      await scrapeAllthatpay(store)
    } catch (err) {
      console.error(`[올댓페이:${store.name}] 오류:`, err)
    }
  }

  for (const store of stores.allthatpay) {
    try {
      await scrapeHourlySales(store)
    } catch (err) {
      console.error(`[시간통계:${store.name}] 오류:`, err)
    }
  }

  console.log('=== 수집 완료 ===', new Date().toLocaleString('ko-KR'))

  await validate(yesterdayStr)
}

main()
