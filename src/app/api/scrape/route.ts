import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import path from 'path'

export async function POST() {
  const scraperPath = path.join(process.cwd(), 'scrapers', 'run-all.ts')

  return new Promise<NextResponse>((resolve) => {
    exec(`npx tsx "${scraperPath}"`, { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) {
        console.error('Scraper error:', stderr)
        resolve(NextResponse.json({ success: false, error: stderr }, { status: 500 }))
      } else {
        console.log('Scraper output:', stdout)
        resolve(NextResponse.json({ success: true, output: stdout }))
      }
    })
  })
}
