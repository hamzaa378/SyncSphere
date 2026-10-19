"""End-to-end V2.2 smoke test using REAL Chromium browser tabs.
Start `npm start`, then run `python tests/browser_v22.py`.
Install `pip install playwright`; `python -m playwright install chromium` if needed.
The test uses a new incognito context; user preferences are not affected.
"""
import asyncio
import json
import sys
from playwright.async_api import async_playwright

async def run():
    url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173'
    errors = []
    async with async_playwright() as pw:
        # Prefer installed Playwright Chromium. Use system Chromium as a fallback.
        try:
            browser = await pw.chromium.launch(headless=True, args=['--no-sandbox'])
        except Exception:
            browser = await pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox','--disable-dev-shm-usage'])
        context = await browser.new_context(accept_downloads=True)
        pages = [await context.new_page() for _ in range(3)]
        try:
            for page in pages:
                page.on('pageerror', lambda exception: errors.append(str(exception)))
                await page.goto(url, wait_until='domcontentloaded', timeout=25000)
            a, b, c = pages
            await a.wait_for_function("document.querySelectorAll('#peer-select option[value]:not([value=\"\"])').length === 2", timeout=15000)
            # The newest screen panels should respond without changing settings.
            assert await a.locator('#run-fanout').is_visible()
            await a.locator('#fault-mode').select_option('normal')
            await a.locator('#run-fanout').click()
            await a.wait_for_function("!document.querySelector('#run-fanout').disabled", timeout=60000)
            clean = await a.locator('#fanout-status').inner_text()
            assert '24/24 received ACKs' in clean, clean
            await a.locator('#fault-mode').select_option('drop-first')
            await a.locator('#run-fanout').click()
            await a.wait_for_function("!document.querySelector('#run-fanout').disabled", timeout=60000)
            recover = await a.locator('#fanout-status').inner_text()
            assert '24/24 received ACKs' in recover and '24 recovered' in recover, recover
            await a.locator('#font-slider').evaluate('node => { node.value = "21"; node.dispatchEvent(new Event("input", { bubbles: true })); }')
            await b.wait_for_function("document.getElementById('font-value').textContent === '21 px'", timeout=10000)
            await c.wait_for_function("document.getElementById('font-value').textContent === '21 px'", timeout=10000)
            await a.locator('#request-repair').click()
            await b.locator('#request-repair').click()
            await a.wait_for_function("document.getElementById('convergence-long').textContent.includes('All 3 reported full preference registers match')", timeout=10000)
            async with a.expect_download() as download_info:
                await a.locator('#export-report-json').click()
            report_download = await download_info.value
            assert report_download.suggested_filename == 'syncsphere-v2.2-evidence.json'
            report = json.load(open(await report_download.path(), encoding='utf-8'))
            assert report['fanout']['successful'] == 24
            assert report['fanout']['recovered'] == 24
            assert report['schema'] == 'syncsphere-lab-report/2.0'
            # Reopen a tab; saved settings must be immediately available.
            await c.close()
            d = await context.new_page()
            d.on('pageerror', lambda exception: errors.append(str(exception)))
            await d.goto(url, wait_until='domcontentloaded')
            assert await d.locator('#font-value').inner_text() == '21 px'
            assert not errors, errors
            print('PASS: 3 Chromium tabs, 24/24 clean ACKs, 24/24 induced drops recovered, preference sync + reopen + JSON evidence')
            print('normal:', clean)
            print('fault mode:', recover)
        finally:
            await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
