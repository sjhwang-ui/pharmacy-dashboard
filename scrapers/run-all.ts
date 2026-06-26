import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
import { scrapeGtfetrs } from './gtfetrs'
import { scrapeAllthatpay, scrapeHourlySales } from './allthatpay'

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

async function main() {
  console.log('=== 데이터 수집 시작 ===', new Date().toLocaleString('ko-KR'))

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

  console.log('=== 완료 ===', new Date().toLocaleString('ko-KR'))
}

main()
