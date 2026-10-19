"""Run with app already started: npm start
Install: python -m pip install playwright && python -m playwright install chromium
Usage: python tests/browser_v21.py [http://localhost:5173]
"""
import asyncio
import sys
from playwright.async_api import async_playwright

async def run():
    url = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5173'
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(accept_downloads=True)
        tab_a, tab_b = await context.new_page(), await context.new_page()
        errors = []
        for tab in (tab_a, tab_b):
            tab.on('pageerror', lambda exception: errors.append(str(exception)))
            await tab.goto(url, wait_until='domcontentloaded', timeout=15000)
        await tab_a.wait_for_function("document.querySelectorAll('#peer-select option[value]:not([value=\"\"])').length > 0", timeout=10000)
        await tab_b.wait_for_function("document.querySelectorAll('#peer-select option[value]:not([value=\"\"])').length > 0", timeout=10000)

        # The benchmark is executed in real Chromium tabs, not simulated tabs.
        await tab_a.locator('#run-benchmark').click()
        await tab_a.wait_for_function("!document.querySelector('#run-benchmark').disabled", timeout=30000)
        status = await tab_a.locator('#benchmark-status').inner_text()
        assert '100/100 acknowledged' in status, status

        await tab_a.locator('#run-stress').click()
        await tab_a.wait_for_function("!document.querySelector('#run-stress').disabled", timeout=30000)
        status2 = await tab_a.locator('#stress-status').inner_text()
        assert '20/20' in status2, status2

        # Prefs must stay untouched by lab operations.
        assert await tab_a.locator('#font-value').inner_text() == await tab_b.locator('#font-value').inner_text()
        async with tab_a.expect_download() as download_event:
            await tab_a.locator('#export-report-json').click()
        download = await download_event.value
        assert download.suggested_filename == 'syncsphere-v2.1-evidence.json'
        async with tab_a.expect_download() as download_event:
            await tab_a.locator('#export-report-csv').click()
        download = await download_event.value
        assert download.suggested_filename == 'syncsphere-v2.1-samples.csv'
        assert not errors, errors
        print('PASS: real Chromium tabs, 100/100 benchmark ACKs, 20/20 conflicts, downloads, no page errors')
        print('Benchmark:', status)
        print('Conflict:', status2)
        await browser.close()

if __name__ == '__main__':
    asyncio.run(run())
