import os
import asyncio
import datetime
import requests
from playwright.async_api import async_playwright

APPS_SCRIPT_URL = os.environ['APPS_SCRIPT_URL']
ALLTHATPAY_ID = os.environ['ALLTHATPAY_ID']
ALLTHATPAY_PW = os.environ['ALLTHATPAY_PW']
GTFETRS_ID = os.environ['GTFETRS_ID']
GTFETRS_PW = os.environ['GTFETRS_PW']

today = datetime.date.today().strftime('%Y-%m-%d')

async def scrape_allthatpay(page):
    print("allthatpay 로그인 시도...")
    try:
        await page.goto('https://scmadm.allthatpay.kr', wait_until='domcontentloaded')
        await asyncio.sleep(2)
        await page.screenshot(path='screenshots/01_allthatpay_login.png', full_page=True)

        await page.fill('input[type="text"]', ALLTHATPAY_ID)
        await page.fill('input[type="password"]', ALLTHATPAY_PW)
        await page.screenshot(path='screenshots/02_allthatpay_filled.png', full_page=True)

        await page.keyboard.press('Enter')
        await asyncio.sleep(4)
        await page.screenshot(path='screenshots/03_allthatpay_after_login.png', full_page=True)
        print(f"로그인 후 URL: {page.url}")

        await asyncio.sleep(2)
        await page.screenshot(path='screenshots/04_allthatpay_main.png', full_page=True)

    except Exception as e:
        print(f"allthatpay 에러: {e}")
        await page.screenshot(path='screenshots/allthatpay_error.png', full_page=True)

async def scrape_gtfetrs(page):
    print("gtfetrs 로그인 시도...")
    try:
        await page.goto('https://merchant.gtfetrs.com', wait_until='domcontentloaded')
        await asyncio.sleep(2)
        await page.screenshot(path='screenshots/05_gtfetrs_login.png', full_page=True)

        await page.fill('input[type="text"]', GTFETRS_ID)
        await page.fill('input[type="password"]', GTFETRS_PW)
        await page.screenshot(path='screenshots/06_gtfetrs_filled.png', full_page=True)

        await page.keyboard.press('Enter')
        await asyncio.sleep(4)
        await page.screenshot(path='screenshots/07_gtfetrs_after_login.png', full_page=True)
        print(f"로그인 후 URL: {page.url}")

        await asyncio.sleep(2)
        await page.screenshot(path='screenshots/08_gtfetrs_main.png', full_page=True)

    except Exception as e:
        print(f"gtfetrs 에러: {e}")
        await page.screenshot(path='screenshots/gtfetrs_error.png', full_page=True)

async def main():
    os.makedirs('screenshots', exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})

        await scrape_allthatpay(page)
        await scrape_gtfetrs(page)

        await browser.close()

    print("스크린샷 완료. 구글시트 연결 테스트...")
    test_data = {
        'type': 'sales',
        'date': today,
        'total_sales': 999,
        'transaction_count': 1,
        'top_product': '연결테스트',
        'top_product_sales': 999
    }
    response = requests.post(APPS_SCRIPT_URL, json=test_data)
    print(f"구글시트 연결: {response.text}")

asyncio.run(main())
