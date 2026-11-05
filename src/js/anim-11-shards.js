/* Part 2: shards and addresses */
(function () {
  const U = Deck.util, { C, canvas, once, play, clamp, seg } = Deck.pf;

  /* ── small files flying into a few large shards ── */
  Deck.on('pack', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-pk'), 1680, 430), R = U.rng(21);
        D.rect(0, 0, 620, 430, { fill: '#fff', stroke: C.line, r: 20 });
        D.t(30, 50, 'One file per sample', { f: 'sora', w: 700, fill: C.ink, size: 30 });
        D.rect(980, 0, 700, 430, { fill: '#fff', stroke: C.line, r: 20 });
        D.t(1010, 50, 'Packed into shards', { f: 'sora', w: 700, fill: C.ink, size: 30 });
        D.t(800, 214, 'pack', { a: 'middle', w: 600, size: 26, fill: C.muted });
        D.path('M660 232 L940 232', { sw: 4, arrow: 1 });
        D.t(1010, 96, 'Images: TAR, about 10 GiB each', { size: 24, w: 500 });
        D.t(1010, 296, 'Annotations: JSONL, about 1 GiB each', { size: 24, w: 500 });
        const bars = [];
        for (let i = 0; i < 6; i++) {
          const x = 1010 + (i % 2) * 325, y = 112 + Math.floor(i / 2) * 54, w = 315, h = 44;
          D.rect(x, y, w, h, { fill: C.free, r: 8 });
          const f = D.rect(x, y, 0, h, { fill: C.mid, r: 8 });
          bars.push({ x, y, w, h, f, kind: 0, n: 0, k: 0 });
        }
        for (let i = 0; i < 8; i++) {
          const x = 1010 + i * 40, y = 312, w = 32, h = 44;
          D.rect(x, y, w, h, { fill: C.free, r: 6 });
          const f = D.rect(x, y, 0, h, { fill: C.orange, r: 6 });
          bars.push({ x, y, w, h, f, kind: 1, n: 0, k: 0 });
        }
        const imgs = bars.filter(b => !b.kind), anns = bars.filter(b => b.kind), tiles = [], cols = 32, rows = 18, sz = 13, gap = 5;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          const ann = (r + c * 3) % 2 === 1, x = 30 + c * (sz + gap), y = 78 + r * (sz + 5);
          const tgt = ann ? anns[Math.floor(R() * anns.length)] : imgs[Math.floor(R() * imgs.length)]; tgt.n++;
          tiles.push({ x, y, tgt, ann, t0: 300 + R() * 3700, e: D.rect(x, y, sz, sz, { fill: ann ? C.orange : C.mid, r: 2 }), tx: tgt.x + 10 + R() * (tgt.w - 20), ty: tgt.y + R() * (tgt.h - sz) });
        }
        ctx.el.__pk = { tiles, bars };
      });
      const { tiles, bars } = ctx.el.__pk;
      ctx.__pl = play(ctx, '#pf-pk-pl', {
        dur: 5800,
        render: t => {
          bars.forEach(b => { b.k = 0; });
          tiles.forEach(o => {
            const k = clamp((t - o.t0) / 1000), e = U.ease.inout(k);
            if (k >= 1) { o.tgt.k++; o.e.setAttribute('display', 'none'); return; }
            o.e.setAttribute('display', 'inline'); o.e.setAttribute('x', o.x + (o.tx - o.x) * e); o.e.setAttribute('y', o.y + (o.ty - o.y) * e);
          });
          bars.forEach(b => b.f.setAttribute('width', b.w * (b.n ? b.k / b.n : 0)));
        },
      });
    },
  });

  /* ── the address: a selection moves along one shard ── */
  const KB = [182, 61, 344, 127, 230, 96, 410, 158, 275, 73];
  let off = 88129536;
  const MEM = KB.map((kb, i) => { const len = kb * 1024 + 133 * (i % 5), m = { id: 120 + i, off: off + 512, len, kb }; off += 512 + Math.ceil(len / 512) * 512; return m; });
  const TOTAL = KB.reduce((a, b) => a + b, 0);
  Deck.on('addr', {
    enter(ctx) {
      const strip = ctx.q('#pf-ad-s'), head = ctx.q('#pf-ad-h'), o = ctx.q('#pf-ad-o'), l = ctx.q('#pf-ad-len'), u = ctx.q('#pf-ad-u');
      once(ctx, '__b', () => {
        MEM.forEach((m, i) => { const c = document.createElement('i'); c.style.flex = m.kb + ' 1 0'; c.onclick = () => { const p = ctx.el.__pl; if (p) { p.pause(); p.seek(i * 950 + 20); } }; strip.appendChild(c); });
      });
      const cells = [...strip.children], STEP = 950, W = 1616;
      let cur = -1;
      ctx.el.__pl = play(ctx, '#pf-ad-pl', {
        dur: STEP * MEM.length,
        render: t => {
          const k = Math.min(MEM.length - 1, Math.floor(t / STEP));
          if (k === cur) return; cur = k;
          const m = MEM[k];
          cells.forEach((c, j) => c.classList.toggle('pf-sel', j === k));
          let before = 0; for (let j = 0; j < k; j++) before += KB[j];
          head.style.left = (32 + before / TOTAL * W) + 'px';
          o.textContent = m.off.toLocaleString('en-US'); l.textContent = m.len.toLocaleString('en-US') + ' bytes';
          u.innerHTML = `patram://img/${String(m.id).padStart(6, '0')}?shard=shard_0042.tar&amp;offset=<span class="o">${m.off}</span>&amp;length=<span class="l">${m.len}</span>`;
        },
      });
    },
  });
})();
