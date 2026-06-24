import os
import re
import asyncio
import datetime
import requests
from playwright.async_api import async_playwright

APPS_SCRIPT_URL = os.environ['APPS_SCRIPT_URL']
ALLTHATPAY_ID = os.environ['ALLTHATPAY_ID']
ALLTHATPAY_PW = os.environ['ALLTHATPAY_PW']
GTFETRS_ID = os.environ['TAXFREE_ID']
GTFETRS_PW = os.environ['TAXFREE_PW']

today = datetime.date.today().strftime('%Y-%m-%d')

def clean_number(text):
    text = text.strip().replace(',', '').replace('원', '').replace('%', '').replace('건', '')
    return int(text) if text.isdigit() else 0

def parse_allthatpay(text):
    lines = [l.strip() for l in text.split('\n') if l.strip()]

    def extract_after(keyword):
        for i, l in enumerate(lines):
            if keyword in l:
                for j in range(i+1, min(i+4, len(lines))):
                    n = re.sub(r'[^0-9]', '', lines[j])
                    if n:
                        return int(n)
        return 0

    total_sales    = extract_after('총 판매금액')
    total_units    = extract_after('총 판매수량')
    total_profit   = extract_after('총 순이익')
    profit_rate    = extract_after('총 이익률')

    # 최고판매상품 (시간대 테이블에서 가장 많이 나온 상품)
    products = re.findall(r'\t([^\t\n]+)\t\d+\t\d+\t[\d,]+원', text)
    top_product = max(set(products), key=products.count) if products else '-'

    # 최고 판매 시간대 (판매금액 기준)
    best_hour = '-'
    best_amount = 0
    table_lines = [l for l in lines if re.match(r'^\d+$', l.split('\t')[0] if '\t' in l else '')]
    for l in lines:
        parts = l.split('\t')
        if len(parts) >= 6:
            amount_str = re.sub(r'[^0-9]', '', parts[5]) if len(parts) > 5 else ''
            if amount_str and int(amount_str) > best_amount:
                best_amount = int(amount_str)
                best_hour = parts[1] if len(parts) > 1 else '-'

    return {
        'type': 'sales',
        'date': today,
        'total_sales': total_sales,
        'total_units': total_units,
        'total_profit': total_profit,
        'profit_rate': profit_rate,
        'top_product': top_product,
        'best_hour': best_hour,
        'best_hour_sales': best_amount,
    }

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

        await page.goto('https://scmadm.allthatpay.kr/shop/time', wait_until='domcontentloaded')
        await asyncio.sleep(3)
        await page.screenshot(path='screenshots/02_allthatpay_sales.png', full_page=True)

        text = await page.inner_text('body')
        with open('screenshots/allthatpay_text.txt', 'w', encoding='utf-8') as f:
            f.write(text)

        data = parse_allthatpay(text)
        print(f"allthatpay 파싱 완료: 매출 {data['total_sales']:,}원, 최고상품: {data['top_product'][:20]}")
        return data

    except Exception as e:
        print(f"allthatpay 에러: {e}")
        await page.screenshot(path='screenshots/allthatpay_error.png', full_page=True)
        return None

async def scrape_gtfetrs(page):
    print("gtfetrs 로그인 시도...")
    try:
        await page.goto('https://merchant.gtfetrs.com/login', wait_until='domcontentloaded')
        await asyncio.sleep(2)
        await page.screenshot(path='screenshots/03_gtfetrs_login.png', full_page=True)

        # HTML 저장 (셀렉터 파악용)
        with open('screenshots/gtfetrs_html.txt', 'w', encoding='utf-8') as f:
            f.write(await page.content())

        # 첫 번째 visible input 찾아서 아이디 입력
        inputs = page.locator('input:visible')
        count = await inputs.count()
        print(f"gtfetrs 입력필드 수: {count}")

        filled = False
        for i in range(count):
            inp = inputs.nth(i)
            inp_type = await inp.get_attribute('type') or 'text'
            if inp_type not in ('password', 'hidden', 'checkbox', 'submit', 'button'):
                await inp.fill(GTFETRS_ID)
                filled = True
                print(f"아이디 입력: input #{i} (type={inp_type})")
                break

        await page.locator('input[type="password"]').fill(GTFETRS_PW)
        await page.screenshot(path='screenshots/04_gtfetrs_filled.png', full_page=True)

        await page.keyboard.press('Enter')
        await asyncio.sleep(4)
        await page.screenshot(path='screenshots/05_gtfetrs_after_login.png', full_page=True)
        print(f"gtfetrs 로그인 후 URL: {page.url}")

        await page.goto('https://merchant.gtfetrs.com/dataSearch/data_search_tab_parent', wait_until='domcontentloaded')
        await asyncio.sleep(3)
        await page.screenshot(path='screenshots/06_gtfetrs_data.png', full_page=True)

        text = await page.inner_text('body')
        with open('screenshots/gtfetrs_text.txt', 'w', encoding='utf-8') as f:
            f.write(text)
        print("gtfetrs 데이터 페이지 완료")
        return text

    except Exception as e:
        print(f"gtfetrs 에러: {e}")
        await page.screenshot(path='screenshots/gtfetrs_error.png', full_page=True)
        with open('screenshots/gtfetrs_error.txt', 'w', encoding='utf-8') as f:
            f.write(str(e))
        return None

async def main():
    os.makedirs('screenshots', exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 900})

        sales_data = await scrape_allthatpay(page)
        await scrape_gtfetrs(page)

        await browser.close()

    # 구글시트 업로드
    if sales_data:
        print("구글시트 업로드 중...")
        response = requests.post(APPS_SCRIPT_URL, json=sales_data)
        print(f"구글시트 응답: {response.text}")
    else:
        print("매출 데이터 없음 - 업로드 건너뜀")

asyncio.run(main())
