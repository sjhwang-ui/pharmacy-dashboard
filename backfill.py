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

async def set_date_input(page, index, date_str):
    await page.evaluate(f"""
        (function() {{
            const allInputs = Array.from(document.querySelectorAll('input')).filter(i =>
                i.offsetParent !== null &&
                i.type !== 'hidden' && i.type !== 'checkbox' && i.type !== 'radio'
            );
            const input = allInputs[{index}];
            if (!input) return;
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(input, '{date_str}');
            ['input', 'change', 'blur'].forEach(evt =>
                input.dispatchEvent(new Event(evt, {{bubbles: true}}))
            );
        }})();
    """)
    await asyncio.sleep(0.3)

async def scrape_day(page, date_str):
    print(f"  날짜 조회: {date_str}")
    try:
        await page.goto('https://scmadm.allthatpay.kr/shop/time', wait_until='domcontentloaded')
        await asyncio.sleep(2)

        # 현재 날짜 확인
        current = await page.evaluate("""
            Array.from(document.querySelectorAll('input')).filter(i =>
                i.offsetParent !== null && i.type !== 'hidden' &&
                i.type !== 'checkbox' && i.type !== 'radio'
            ).map(i => i.value)
        """)
        print(f"    현재 입력값: {current[:3]}")

        # 시작일/종료일 같은 날짜로 설정
        await set_date_input(page, 0, date_str)
        await set_date_input(page, 1, date_str)

        # 검색 클릭
        await page.click('button:has-text("검색")')
        await asyncio.sleep(3)

        # 날짜 변경됐는지 확인
        after = await page.evaluate("""
            Array.from(document.querySelectorAll('input')).filter(i =>
                i.offsetParent !== null && i.type !== 'hidden' &&
                i.type !== 'checkbox' && i.type !== 'radio'
            ).map(i => i.value)
        """)
        print(f"    검색 후 입력값: {after[:3]}")

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
