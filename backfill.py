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
        'total_profit': total_profit,
        'profit_rate': profit_rate,
        'top_product': top_product,
        'best_hour': '-',
        'best_hour_sales': 0,
    }

async def scrape_day(page, date_str):
    print(f"  날짜 조회: {date_str}")
    try:
        await page.goto('https://scmadm.allthatpay.kr/shop/time', wait_until='domcontentloaded')
        await asyncio.sleep(2)

        # 날짜 입력 필드 설정
        date_inputs = page.locator('input[type="date"], input[type="text"][class*="date"], input[placeholder*="날짜"]')
        count = await date_inputs.count()

        if count >= 2:
            # 시작일, 종료일 모두 같은 날짜로 설정
            await date_inputs.nth(0).fill(date_str)
            await date_inputs.nth(1).fill(date_str)
        elif count == 0:
            # JS로 날짜 입력 시도
            await page.evaluate(f"""
                const inputs = document.querySelectorAll('input');
                let dateInputs = Array.from(inputs).filter(i =>
                    i.type === 'date' || (i.value && i.value.match(/\\d{{4}}/)));
                if (dateInputs.length >= 2) {{
                    dateInputs[0].value = '{date_str}';
                    dateInputs[1].value = '{date_str}';
                }}
            """)

        # 검색 버튼 클릭
        await page.click('button:has-text("검색")')
        await asyncio.sleep(3)

        text = await page.inner_text('body')
        data = parse_allthatpay(text, date_str)
        print(f"  완료: 매출 {data['total_sales']:,}원")
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
                print(f"  구글시트 저장: {response.json().get('status', '?')}")
            await asyncio.sleep(1)

        await browser.close()

    print("백필 완료!")

asyncio.run(main())
