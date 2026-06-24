import os
import re
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

def clean_number(text):
    return int(re.sub(r'[^0-9]', '', text)) if re.search(r'[0-9]', text) else 0

async def scrape_allthatpay(page):
    print("allthatpay 로그인 시도...")
    try:
        await page.goto('https://scmadm.allthatpay.kr', wait_until='domcontentloaded')
        await asyncio.sleep(2)
        await page.fill('input[type="text"]', ALLTHATPAY_ID)
        await page.fill('input[type="password"]', ALLTHATPAY_PW)
        await page.click('button:has-text("로그인")')
        await asyncio.sleep(4)
        await page.screenshot(path='screenshots/01_allthatpay_home.png', full_page=True)
        print(f"allthatpay 로그인 후 URL: {page.url}")

        # 페이지 텍스트 저장 (데이터 파싱용)
        with open('screenshots/allthatpay_text.txt', 'w', encoding='utf-8') as f:
            f.write(await page.inner_text('body'))

        # 일별 매출 페이지로 이동
        await page.goto('https://scmadm.allthatpay.kr/shop/time', wait_until='domcontentloaded')
        await asyncio.sleep(3)
        await page.screenshot(path='screenshots/02_allthatpay_sales.png', full_page=True)
        with open('screenshots/allthatpay_sales_text.txt', 'w', encoding='utf-8') as f:
            f.write(await page.inner_text('body'))
        print("allthatpay 데이터 페이지 완료")

    except Exception as e:
        print(f"allthatpay 에러: {e}")
        await page.screenshot(path='screenshots/allthatpay_error.png', full_page=True)

async def scrape_gtfetrs(page):
    print("gtfetrs 로그인 시도...")
    try:
        # 직접 로그인 URL로 접근
        await page.goto('https://merchant.gtfetrs.com/login', wait_until='domcontentloaded')
        await asyncio.sleep(2)
        await page.screenshot(path='screenshots/03_gtfetrs_login.png', full_page=True)

        # 팝업 닫기 시도
        try:
            await page.keyboard.press('Escape')
            await asyncio.sleep(1)
        except:
            pass

        # 로그인 폼 찾기
        await page.fill('input[type="text"], input[name*="id"], input[placeholder*="아이디"]', GTFETRS_ID)
        await page.fill('input[type="password"]', GTFETRS_PW)
        await page.screenshot(path='screenshots/04_gtfetrs_filled.png', full_page=True)

        await page.keyboard.press('Enter')
        await asyncio.sleep(4)
        await page.screenshot(path='screenshots/05_gtfetrs_after_login.png', full_page=True)
        print(f"gtfetrs 로그인 후 URL: {page.url}")

        # 국적별 데이터 페이지로 이동
        await page.goto('https://merchant.gtfetrs.com/dataSearch/data_search_tab_parent', wait_until='domcontentloaded')
        await asyncio.sleep(3)
        await page.screenshot(path='screenshots/06_gtfetrs_data.png', full_page=True)
        with open('screenshots/gtfetrs_text.txt', 'w', encoding='utf-8') as f:
            f.write(await page.inner_text('body'))
        print("gtfetrs 데이터 페이지 완료")

    except Exception as e:
        print(f"gtfetrs 에러: {e}")
        await page.screenshot(path='screenshots/gtfetrs_error.png', full_page=True)
        with open('screenshots/gtfetrs_error.txt', 'w', encoding='utf-8') as f:
            f.write(str(e))

async def main():
    os.makedirs('screenshots', exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 900})

        await scrape_allthatpay(page)
        await scrape_gtfetrs(page)

        await browser.close()

    # 구글시트 연결 테스트
    print("구글시트 연결 테스트...")
    test_data = {
        'type': 'sales',
        'date': today,
        'total_sales': 999,
        'transaction_count': 1,
        'top_product': '연결테스트',
        'top_product_sales': 999
    }
    response = requests.post(APPS_SCRIPT_URL, json=test_data)
    print(f"구글시트 응답: {response.text}")

asyncio.run(main())
