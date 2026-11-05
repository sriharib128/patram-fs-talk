"""Screenshot slides for visual QA.

usage: python3 tools/shot.py OUTDIR SPEC [SPEC ...]
  SPEC = <slide#>[:<step>][@<ms,ms,...>]     e.g.  6:1@500,3000   → slide 6 at step 1, shots 500 ms and 3000 ms after the step was set
Prints console errors. The deck is loaded from ../index.html.
"""
import pathlib, sys, time
from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
specs = sys.argv[2:]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    errs = []
    pg.on('console', lambda m: errs.append(f'[{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(f'[pageerror] {e}'))
    for spec in specs:
        waits = [600]
        if '@' in spec:
            spec, w = spec.split('@'); waits = [int(x) for x in w.split(',')]
        n, _, st = spec.partition(':'); st = int(st or 0)
        pg.goto(f'file://{root}/index.html#{n}'); pg.reload(); pg.wait_for_timeout(500)
        for _ in range(st):
            pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(60)
        t0 = time.time()
        for w in waits:
            pg.wait_for_timeout(max(0, w - int((time.time() - t0) * 1000)))
            f = out / f'{int(n):02d}_s{st}_{w}.png'
            pg.screenshot(path=str(f)); print(f)
    b.close()
for e in errs: print(e)
