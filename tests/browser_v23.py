"""Real Chromium acceptance test. Start npm start, then:
python tests/browser_v23.py [http://localhost:5173]
Tests its own temporary browser profile, saves evidence under tests/artifacts/.
"""
import asyncio, json, csv, sys
from pathlib import Path
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv)>1 else 'http://localhost:5173'
OUT = Path(__file__).resolve().parent/'artifacts'/'v23_latest'

async def run():
    errors=[]
    async with async_playwright() as pw:
        try: browser=await pw.chromium.launch(headless=True)
        except Exception: browser=await pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
        try:
            ctx=await browser.new_context(accept_downloads=True)
            pages=[await ctx.new_page() for _ in range(3)]
            for page in pages:
                page.on('pageerror',lambda e: errors.append(str(e)))
                await page.goto(URL,wait_until='domcontentloaded',timeout=25000)
            a,b,c=pages
            await a.wait_for_function('document.querySelectorAll("#peer-select option[value]:not([value=\'\'])").length===2',timeout=16000)
            await a.locator('#run-benchmark').click()
            await a.wait_for_function('!document.querySelector("#run-benchmark").disabled',timeout=60000)
            assert '100/100 acknowledged' in await a.locator('#benchmark-status').inner_text()
            await a.locator('#run-stress').click()
            await a.wait_for_function('!document.querySelector("#run-stress").disabled',timeout=60000)
            assert '20/20 conflicts converged' in await a.locator('#stress-status').inner_text()
            for mode in ('normal','drop-first','delay-150','mixed'):
                await a.locator('#fault-mode').select_option(mode)
                await a.locator('#run-fanout').click()
                await a.wait_for_function('!document.querySelector("#run-fanout").disabled',timeout=90000)
                status=await a.locator('#fanout-status').inner_text()
                assert '24/24' in status, f'{mode}: {status}'
                print('fanout',mode,status)
            await a.locator('#font-slider').evaluate('node=>{node.value="21";node.dispatchEvent(new Event("input",{bubbles:true}))}')
            for p in (b,c):
                await p.wait_for_function('document.querySelector("#font-value").textContent==="21 px"',timeout=10000)
            await a.locator('#request-repair').click()
            await a.wait_for_function('document.querySelector("#convergence-long").textContent.includes("All 3 reported full preference registers match")',timeout=10000)
            OUT.mkdir(parents=True,exist_ok=True)
            for btn,name in [('export-report-json','syncsphere-v2.3-evidence.json'),('export-report-csv','syncsphere-v2.3-samples.csv')]:
                async with a.expect_download() as fut: await a.locator('#'+btn).click()
                dl=await fut.value
                assert dl.suggested_filename==name
                await dl.save_as(OUT/name)
            report=json.loads((OUT/'syncsphere-v2.3-evidence.json').read_text())
            assert report['schema']=='syncsphere-lab-report/2.1'
            assert report['benchmark']['achievedUnder100ms']==100
            assert report['stress']['converged']==20
            assert report['fanout']['successful']==24
            assert report['fanout']['mode']=='mixed'
            with (OUT/'syncsphere-v2.3-samples.csv').open(newline='') as f: assert len(list(csv.DictReader(f)))==144
            await c.close()
            d=await ctx.new_page()
            await d.goto(URL,wait_until='domcontentloaded',timeout=20000)
            assert await d.locator('#font-value').inner_text()=='21 px'
            assert not errors,errors
            print('PASS: 3 Chromium tabs; 100 benchmarks, 20 stress trials, 4 fanout modes, persistence, 144 evidence rows')
            print('EVIDENCE:',OUT)
        finally: await browser.close()

if __name__=='__main__': asyncio.run(run())
