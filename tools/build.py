"""Assemble the deck.

  index.html                        dev build, references fonts/ and assets/ next to it
  dist/patram-fs-talk.html  one self-contained file (fonts + images inlined) — copy this to the laptop you present from
  SPEAKER_NOTES.md                  talk script generated from the <aside class="notes"> blocks

usage: python3 tools/build.py   (run from anywhere)
"""
import base64, html, mimetypes, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'

def read(p): return pathlib.Path(p).read_text(encoding='utf-8')

slides = [read(p) for p in sorted((SRC / 'slides').glob('*.html'))]
css = read(SRC / 'css/deck.css') + '\n' + '\n'.join(read(p) for p in sorted((SRC / 'css').glob('slides-*.css')))
js = read(SRC / 'js/engine.js') + '\n' + '\n'.join(read(p) for p in sorted((SRC / 'js').glob('anim-*.js'))) + '\nDeck.start();\n'
fonts_css = read(ROOT / 'fonts/fonts.local.css')

PANEL = '''<div id="presenter-panel">
  <div class="top"><div class="clock">0:00</div><div class="pace"></div></div>
  <div class="meta"></div>
  <div class="btns"><button data-act="prev">◀ Prev</button><button data-act="next">Next ▶</button><button data-act="skip"></button><button data-act="reset">Reset clock (R)</button><button data-act="audience">Open audience view</button></div>
  <div class="next"></div>
  <div class="notes-box"></div>
</div>'''

def page(inline):
    font_tag = f'<style>{fonts_css}</style>' if inline else '<link rel="stylesheet" href="fonts/fonts.local.css">'
    body = '\n'.join(slides)
    out = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Patram-FS: serving training data from local disks</title>
{font_tag}
<style>{css}</style></head>
<body>
<div id="stage-wrap"><div id="stage">
{body}
<div id="acts"></div><div id="brandtl"><img src="assets/bharatgen_emblem.png" alt="BharatGen"></div><div id="bar"></div><div id="counter"></div><div id="hud"></div>
</div></div>
<div id="overview"></div>
{PANEL}
<script>{js}</script>
</body></html>'''
    if inline:
        def data_uri(path):
            p = ROOT / path
            mime = mimetypes.guess_type(p.name)[0] or ('font/woff2' if p.suffix == '.woff2' else 'application/octet-stream')
            return f'data:{mime};base64,' + base64.b64encode(p.read_bytes()).decode()
        out = re.sub(r"url\('([A-Za-z0-9_\-]+\.woff2)'\)", lambda m: f"url('{data_uri('fonts/' + m.group(1))}')", out)
        out = re.sub(r'''(["'(])assets/([A-Za-z0-9_\-./]+)''', lambda m: m.group(1) + (data_uri('assets/' + m.group(2)) if (ROOT / 'assets' / m.group(2)).exists() else 'assets/' + m.group(2)), out)
    return out

(ROOT / 'index.html').write_text(page(False), encoding='utf-8')
(ROOT / 'dist').mkdir(exist_ok=True)
(ROOT / 'dist/patram-fs-talk.html').write_text(page(True), encoding='utf-8')

# ── speaker notes ──
def md(s):
    s = re.sub(r'<b>(.*?)</b>', r'**\1**', s, flags=re.S)
    s = re.sub(r'<i>(.*?)</i>', r'*\1*', s, flags=re.S)
    s = re.sub(r'<code>(.*?)</code>', r'`\1`', s, flags=re.S)
    s = re.sub(r'<[^>]+>', '', s)
    return html.unescape(s).strip()

lines = ['# Patram-FS talk: speaker notes\n',
         'Generated from the deck. Keys: → next · ← back · F fullscreen · O overview · P presenter window · K skip optional slides · T clock · B blackout.\n',
         '| # | Slide | min | cumulative (core path) |\n|---|---|---|---|']
rows, bodies, cum = [], [], 0.0
for n, s in enumerate(slides, 1):
    sec = re.search(r'<section\b([^>]*)>', s).group(1)
    attr = lambda k: (re.search(k + r'="([^"]*)"', sec) or [None, ''])[1]
    sid, t, tm, sect = attr('id'), attr('data-title'), float(attr('data-time') or 0), attr('data-section')
    opt = 'data-optional' in sec or 'data-deep' in sec
    if not t:
        m = re.search(r'<(?:h1|h2|div class="dv-h")[^>]*>(.*?)</', s, re.S)
        t = md(m.group(1)) if m else sid
    if not opt: cum += tm
    rows.append(f'| {n} | {t}{" *(deep dive)*" if opt else ""} | {tm:g} | {"-" if opt else f"{cum:.1f}"} |')
    note = re.search(r'<aside class="notes">(.*?)</aside>', s, re.S)
    paras = re.findall(r'<p([^>]*)>(.*?)</p>', note.group(1), re.S) if note else []
    body = []
    for a, p in paras:
        st = re.search(r'data-step="(\d+)"', a)
        body.append((f'**[step {st.group(1)}]** ' if st else '') + md(p))
    steps = [int(x) for x in re.findall(r'data-s="(\d+)"', s)]
    stepinfo = f'reveal steps: {max(steps)}' if steps else 'no steps'
    bodies.append(f'\n## {n}. {t}{" (deep dive)" if opt else ""}\n*{sect} · ~{tm:g} min · {stepinfo}*\n\n' + '\n\n'.join(body))
lines += rows + ['']
total = sum(float(re.search(r'data-time="([\d.]+)"', re.search(r'<section\b[^>]*>', s).group(0)).group(1)) for s in slides if not re.search(r'data-optional|data-deep', re.search(r'<section\b[^>]*>', s).group(0)))
lines.append(f'\n**Core path ≈ {total:.1f} min.**\n')
(ROOT / 'SPEAKER_NOTES.md').write_text('\n'.join(lines) + '\n'.join(bodies) + '\n', encoding='utf-8')
print(f'{len(slides)} slides · core path {total:.1f} min · index.html {len(page(False))//1024} KB · standalone {len(page(True))//1024} KB')
