import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

export type TaxRefundSale = {
  id: string
  date: string
  store: string
  country: string
  amount: number
  count: number
  scraped_at: string
}

export type StoreSale = {
  id: string
  date: string
  store: string
  amount: number
  count: number
  avg_order_value: number
  scraped_at: string
}

export type PPLRecord = {
  id: string
  date: string
  name: string
  engagement: number
  note: string | null
  cost: number | null
  created_at: string
}
