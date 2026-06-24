import os
import re
import asyncio
import datetime
import requests
from playwright.async_api import async_playwright

APPS_SCRIPT_URL = os.environ['APPS_SCRIPT_URL']
ALLTHATPAY_ID = os.environ['ALLTHATPAY_ID']
ALLTHATPAY_PW = os.environ['ALLTHATPAY_PW']

def clean_number(text):
    n = re.sub(r'[^0-9]', '', text)
    return int(n) if n else 0

def parse_allthatpay(text, date_str):
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    def extract_after(keyword):
        for i, l in enumerate(lines):
            if keyword in l:
                for j in range(i+1, min(i+4, len(lines))):
                    n = re.sub(r'[^0-9]', '', lines[j])
                    if n:
                        return int(n)
        return 0

    total_sales  = extract_after('총 판매금액')
    total_units  = extract_after('총 판매수량')
    total_profit = extract_after('총 순이익')
    profit_rate  = extract_after('총 이익률')

    products = re.findall(r'\t([^\t\n]{5,})\t\d+\t\d+\t[\d,]+원', text)
    top_product = max(set(products), key=products.count) if products else '-'

    return {
        'type': 'sales',
        'date': date_str,
        'total_sales': total_sales,
        'total_units': total_units,
        'top_product': top_product,
    }

async def set_date_input(page, index, date_str):
    inputs = page.locator('input:visible').filter(has_not=page.locator('[type=hidden],[type=checkbox],[type=radio],[type=submit],[type=button]'))
    inp = inputs.nth(index)
    await inp.click()
    await page.keyboard.press('Control+a')
    await page.keyboard.type(date_str, delay=50)
    await page.keyboard.press('Tab')
    await asyncio.sleep(0.3)

async def scrape_day(page, date_str):
    print(f"  날짜 조회: {date_str}")
    try:
        await page.goto('https://scmadm.allthatpay.kr/shop/time', wait_until='domcontentloaded')
        await asyncio.sleep(2)

        # 시작일/종료일 키보드로 직접 입력
        await set_date_input(page, 0, date_str)
        await set_date_input(page, 1, date_str)

        # 검색 클릭
        await page.click('button:has-text("검색")')
        await asyncio.sleep(3)

        # 현재 입력값 확인
        after = await page.evaluate("""
            Array.from(document.querySelectorAll('input')).filter(i =>
                i.offsetParent !== null && i.type !== 'hidden' &&
                i.type !== 'checkbox' && i.type !== 'radio'
            ).map(i => i.value)
        """)
        print(f"    날짜 확인: {after[:2]}")

        text = await page.inner_text('body')
        data = parse_allthatpay(text, date_str)
        print(f"  완료: 매출 {data['total_sales']:,}원 / 판매수량 {data['total_units']} / 최고상품 {data['top_product'][:15]}")
        return data

    except Exception as e:
        print(f"  에러 ({date_str}): {e}")
        return None

async def main():
    # 6월 1일 ~ 어제까지
    today = datetime.date.today()
    start = datetime.date(2026, 6, 1)
    end = today - datetime.timedelta(days=1)

    dates = []
    d = start
    while d <= end:
        dates.append(d.strftime('%Y-%m-%d'))
        d += datetime.timedelta(days=1)

    print(f"백필 대상: {dates[0]} ~ {dates[-1]} ({len(dates)}일)")

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 900})

        # 로그인
        print("로그인 중...")
        await page.goto('https://scmadm.allthatpay.kr', wait_until='domcontentloaded')
        await asyncio.sleep(2)
        await page.fill('input[type="text"]', ALLTHATPAY_ID)
        await page.fill('input[type="password"]', ALLTHATPAY_PW)
        await page.click('button:has-text("로그인")')
        await asyncio.sleep(4)
        print("로그인 완료")

        for date_str in dates:
            data = await scrape_day(page, date_str)
            if data and data['total_sales'] > 0:
                response = requests.post(APPS_SCRIPT_URL, json=data)
                try:
                    print(f"  구글시트 저장: {response.json().get('status', '?')}")
                except:
                    print(f"  구글시트 저장 완료 (응답: {response.status_code})")
            await asyncio.sleep(1)

        await browser.close()

    print("백필 완료!")

asyncio.run(main())
