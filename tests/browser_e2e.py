"""Optional real-Chromium end-to-end checks. Run: pip install playwright; python tests/browser_e2e.py

Requires server already running: npm run dev (default http://localhost:5173)
Override BASE_URL and CHROMIUM_BIN as needed.
"""
import json
import os
import shutil
import time
from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get('BASE_URL', 'http://localhost:5173')


def eventually(predicate, message, timeout=6000):
    deadline = time.monotonic() + timeout / 1000
    while time.monotonic() < deadline:
        try:
            if predicate():
                return
        except Exception:
            pass
        time.sleep(.04)
    raise AssertionError(message)


def run():
    with sync_playwright() as p:
        opts = {'headless': True, 'args': ['--no-sandbox']}
        chromium = os.environ.get('CHROMIUM_BIN') or shutil.which('chromium') or shutil.which('google-chrome')
        if chromium:
            opts['executable_path'] = chromium
        browser = p.chromium.launch(**opts)
        context = browser.new_context(accept_downloads=True)
        a, b = context.new_page(), context.new_page()
        console_errors = []
        a.on('pageerror', lambda exc: console_errors.append(str(exc)))
        b.on('pageerror', lambda exc: console_errors.append(str(exc)))
        a.goto(BASE_URL)
        b.goto(BASE_URL)
        assert a.locator('#theme-toggle').is_checked() is False
        assert b.locator('#theme-toggle').is_checked() is False
        print('PASS: both tabs initialize with defaults')

        a.locator('#theme-toggle').check()
        eventually(lambda: b.locator('#theme-toggle').is_checked(), 'Theme failed to sync')
        assert b.evaluate('document.documentElement.dataset.theme') == 'dark'
        print('PASS: dark mode propagated without reload')

        b.locator('#language-select').select_option('es')
        eventually(lambda: a.locator('#language-select').input_value() == 'es', 'Language failed to sync')
        assert 'Un navegador' in a.locator('h1').inner_text()
        print('PASS: language synced and interface translated')

        a.locator('#font-slider').fill('20')
        eventually(lambda: b.locator('#font-slider').input_value() == '20', 'Font size failed to sync')
        print('PASS: font size synced without reload')

        a.reload()
        b.reload()
        assert a.evaluate('document.documentElement.dataset.theme') == 'dark'
        assert b.locator('#font-slider').input_value() == '20'
        assert a.locator('#language-select').input_value() == 'es'
        print('PASS: theme, font size, and language survive reload')

        # Two tabs edit two different fields, which must never clobber each other.
        a.locator('#language-select').select_option('fr')
        b.locator('#font-slider').fill('18')
        eventually(lambda: a.locator('#font-slider').input_value() == '18', 'Parallel font update lost')
        eventually(lambda: b.locator('#language-select').input_value() == 'fr', 'Parallel language update lost')
        print('PASS: simultaneous edits to different keys both survive')

        # Near-simultaneous edits to the SAME field must converge to one winner.
        a.locator('#theme-toggle').uncheck()
        b.locator('#theme-toggle').uncheck()
        eventually(lambda: not a.locator('#theme-toggle').is_checked() and not b.locator('#theme-toggle').is_checked(), 'Could not reset theme')
        a.locator('#theme-toggle').check()
        b.locator('#theme-toggle').check()
        eventually(lambda: a.locator('#theme-toggle').is_checked() and b.locator('#theme-toggle').is_checked(), 'Same-key edits did not converge')
        print('PASS: near-simultaneous same-key edits converge')

        b.locator('#reset-settings').click()
        eventually(lambda: a.locator('#language-select').input_value() == 'en', 'Reset language not propagated')
        eventually(lambda: a.locator('#font-slider').input_value() == '16', 'Reset font size not propagated')
        eventually(lambda: not a.locator('#theme-toggle').is_checked(), 'Reset theme not propagated')
        print('PASS: reset propagates to other tabs')

        data = {'theme': 'dark', 'language': 'hi', 'fontSize': 19}
        a.locator('#import-file').set_input_files({'name': 'preferences.json', 'mimeType': 'application/json', 'buffer': json.dumps(data).encode()})
        eventually(lambda: b.locator('#language-select').input_value() == 'hi', 'Import did not sync')
        eventually(lambda: b.locator('#font-slider').input_value() == '19', 'Imported font size did not sync')
        assert b.locator('#theme-toggle').is_checked()
        print('PASS: imported JSON settings propagated')

        # V2 features: live peer discovery, ping RTT and isolated conflict lab.
        eventually(lambda: a.locator('#tab-count').inner_text() == '2', 'Peer discovery failed')
        a.locator('#ping-tabs').click()
        eventually(lambda: a.locator('#rtt-value').inner_text() != '—', 'Ping RTT did not appear')
        print('PASS: peer presence and real round-trip measurement')

        before = a.locator('#theme-toggle').is_checked()
        a.locator('#run-conflict').click()
        assert 'BOTH ORDERS CONVERGE' in a.locator('#lab-result').inner_text()
        assert a.locator('#theme-toggle').is_checked() == before
        print('PASS: conflict simulation converges and does not change preferences')

        a.locator('[data-preset="calm"]').click()
        eventually(lambda: b.locator('#font-slider').input_value() == '16', 'Preset did not propagate')
        assert b.locator('#language-select').input_value() == 'en'
        print('PASS: preset applies and synchronizes each preference')

        with a.expect_download() as download_info:
            a.locator('#export-settings').click()
        assert download_info.value.suggested_filename == 'syncsphere-preferences.json'
        print('PASS: export downloads a JSON file')
        assert not console_errors, f'Browser errors: {console_errors}'
        print('PASS: no JavaScript page errors')
        context.close()
        browser.close()


if __name__ == '__main__':
    run()
