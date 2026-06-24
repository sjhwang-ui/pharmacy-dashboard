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
    await page.goto('https://scmadm.allthatpay.kr')
    await page.wait_for_load_state('networkidle')
    await page.screenshot(path='screenshots/01_allthatpay_login.png', full_page=True)

    await page.fill('input[type="text"]', ALLTHATPAY_ID)
    await page.fill('input[type="password"]', ALLTHATPAY_PW)
    await page.screenshot(path='screenshots/02_allthatpay_filled.png', full_page=True)

    await page.keyboard.press('Enter')
    await page.wait_for_load_state('networkidle')
    await page.screenshot(path='screenshots/03_allthatpay_after_login.png', full_page=True)

    await page.goto('https://scmadm.allthatpay.kr/shop/time')
    await page.wait_for_load_state('networkidle')
    await page.screenshot(path='screenshots/04_allthatpay_sales.png', full_page=True)
    print("allthatpay 스크린샷 완료")

async def scrape_gtfetrs(page):
    print("gtfetrs 로그인 시도...")
    await page.goto('https://merchant.gtfetrs.com')
    await page.wait_for_load_state('networkidle')
    await page.screenshot(path='screenshots/05_gtfetrs_login.png', full_page=True)

    await page.fill('input[type="text"]', GTFETRS_ID)
    await page.fill('input[type="password"]', GTFETRS_PW)
    await page.screenshot(path='screenshots/06_gtfetrs_filled.png', full_page=True)

    await page.keyboard.press('Enter')
    await page.wait_for_load_state('networkidle')
    await page.screenshot(path='screenshots/07_gtfetrs_after_login.png', full_page=True)

    await page.goto('https://merchant.gtfetrs.com/dataSearch/data_search_tab_parent')
    await page.wait_for_load_state('networkidle')
    await page.screenshot(path='screenshots/08_gtfetrs_data.png', full_page=True)
    print("gtfetrs 스크린샷 완료")

async def main():
    os.makedirs('screenshots', exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 800})

        await scrape_allthatpay(page)
        await scrape_gtfetrs(page)

        await browser.close()

    # 연결 테스트
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
