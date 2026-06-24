import os
import re
import asyncio
import datetime
import requests as req_lib
from playwright.async_api import async_playwright

APPS_SCRIPT_URL = os.environ['APPS_SCRIPT_URL']
ALLTHATPAY_ID = os.environ['ALLTHATPAY_ID']
ALLTHATPAY_PW = os.environ['ALLTHATPAY_PW']

def parse_timelist(data, date_str):
    # API 응답에서 합계 추출
    total_sales = 0
    total_units = 0
    top_product = '-'
    product_counts = {}

    if isinstance(data, list):
        for row in data:
            sales = row.get('saleMoney', row.get('sale_money', row.get('totMoney', 0)))
            units = row.get('saleCnt', row.get('sale_cnt', row.get('totCnt', 0)))
            product = row.get('topGoodsNm', row.get('top_goods_nm', row.get('goodsNm', '')))

            if isinstance(sales, str):
                sales = int(re.sub(r'[^0-9]', '', sales) or 0)
            if isinstance(units, str):
                units = int(re.sub(r'[^0-9]', '', units) or 0)

            total_sales += int(sales)
            total_units += int(units)

            if product:
                product_counts[product] = product_counts.get(product, 0) + 1

        if product_counts:
            top_product = max(product_counts, key=product_counts.get)

    return {
        'type': 'sales',
        'date': date_str,
        'total_sales': total_sales,
        'total_units': total_units,
        'top_product': top_product,
    }

async def main():
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
        page = await browser.new_page()

        # 로그인
        print("로그인 중...")
        await page.goto('https://scmadm.allthatpay.kr', wait_until='domcontentloaded')
        await asyncio.sleep(2)
        await page.fill('input[type="text"]', ALLTHATPAY_ID)
        await page.fill('input[type="password"]', ALLTHATPAY_PW)
        await page.click('button:has-text("로그인")')
        await asyncio.sleep(4)

        # compcd 추출
        compcd = None
        api_requests = []
        def capture(request):
            if 'timelist.do' in request.url:
                api_requests.append(request.url)
        page.on('request', capture)

        await page.goto('https://scmadm.allthatpay.kr/shop/time', wait_until='domcontentloaded')
        await asyncio.sleep(3)

        for url in api_requests:
            m = re.search(r'compcd=([^&]+)', url)
            if m:
                compcd = m.group(1)
                break

        if not compcd:
            print("compcd 추출 실패!")
            await browser.close()
            return

        print(f"로그인 완료. compcd: {compcd[:6]}***")

        # 쿠키 추출
        cookies = await page.context.cookies()
        cookie_str = '; '.join([f"{c['name']}={c['value']}" for c in cookies])

        await browser.close()

    # 직접 API 호출
    session = req_lib.Session()
    session.headers.update({
        'Cookie': cookie_str,
        'Referer': 'https://scmadm.allthatpay.kr/shop/time',
        'User-Agent': 'Mozilla/5.0',
    })

    for date_str in dates:
        d = date_str.replace('-', '')
        url = f"https://scmadm.allthatpay.kr/shop/time/timelist.do?compcd={compcd}&searchDate1={d}&searchDate2={d}&check=true"

        try:
            response = session.get(url, timeout=10)
            data = response.json()
            result = parse_timelist(data, date_str)
            print(f"  {date_str}: 매출 {result['total_sales']:,}원 / {result['total_units']}건")

            if result['total_sales'] > 0:
                sheets_response = session.post(APPS_SCRIPT_URL, json=result)
                try:
                    status = sheets_response.json().get('status', '?')
                except:
                    status = sheets_response.status_code
                print(f"    구글시트: {status}")
        except Exception as e:
            print(f"  {date_str} 에러: {e}")

    print("백필 완료!")

asyncio.run(main())
