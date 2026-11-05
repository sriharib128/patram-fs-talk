"""Screenshot every slide at its last step and tile them into contact sheets (2x2) for review.

usage: python3 tools/allshots.py OUTDIR [WAIT_MS] [first] [last]
"""
import pathlib, re, sys
from playwright.sync_api import sync_playwright
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
wait = int(sys.argv[2]) if len(sys.argv) > 2 else 2500
first = int(sys.argv[3]) if len(sys.argv) > 3 else 1
last = int(sys.argv[4]) if len(sys.argv) > 4 else 999
files = sorted((root / 'src/slides').glob('*.html'))
steps = []
for f in files:
    s = f.read_text()
    m = re.search(r'data-steps="(\d+)"', s)
    nums = [int(x) for x in re.findall(r'data-s="(\d+)"', s)]
    steps.append(int(m.group(1)) if m else (max(nums) if nums else 0))
paths = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    errs = []; cur = [0]
    pg.on('console', lambda m: errs.append(f'[slide {cur[0]}][{m.type}] {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(f'[slide {cur[0]}][pageerror] {e}'))
    for i, st in enumerate(steps, 1):
        if i < first or i > last: continue
        cur[0] = i
        pg.goto(f'file://{root}/index.html#{i}'); pg.reload(); pg.wait_for_timeout(400)
        for _ in range(st):
            pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(50)
        pg.wait_for_timeout(wait)
        f = out / f'a{i:02d}.png'; pg.screenshot(path=str(f)); paths.append(f)
    b.close()
for k in range(0, len(paths), 4):
    sheet = Image.new('RGB', (1920, 1080))
    for j, f in enumerate(paths[k:k + 4]):
        im = Image.open(f).resize((960, 540), Image.LANCZOS); sheet.paste(im, ((j % 2) * 960, (j // 2) * 540))
    sf = out / f'sheet_{k // 4 + 1:02d}.png'; sheet.save(sf); print(sf, [x.name for x in paths[k:k + 4]])
for e in errs: print(e)
