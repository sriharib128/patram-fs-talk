/* Introduction and Part 1 */
(function () {
  const U = Deck.util, { C, canvas, once, play, clamp, seg } = Deck.pf;

  /* ── title: small files drift across and collect into a few long shards (ambient) ── */
  Deck.on('title', {
    enter(ctx) {
      const cv = ctx.q('#pf-tc'), g = cv.getContext('2d'), R = U.rng(7), BARS = [];
      for (let i = 0; i < 6; i++) BARS.push({ x: 1330, y: 160 + i * 88, w: 470, h: 54 });
      const P = Array.from({ length: 170 }, () => { const b = BARS[Math.floor(R() * 6)]; return { x0: 40 + R() * 1250, y0: R() * 1080, b, off: R(), tx: b.x + R() * b.w, ty: b.y + R() * b.h, s: 5 + R() * 7 }; });
      ctx.raf(ms => {
        g.clearRect(0, 0, 1920, 1080);
        const T = ms / 11000;
        BARS.forEach(b => { g.strokeStyle = 'rgba(255,192,120,.42)'; g.lineWidth = 2; g.fillStyle = 'rgba(242,140,40,.1)'; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 10); g.fill(); g.stroke(); });
        P.forEach(p => {
          const u = (T + p.off) % 1, e = U.ease.inout(clamp(u * 1.25)), a = u < .1 ? u / .1 : u > .8 ? Math.max(0, (1 - u) / .2) : 1;
          g.fillStyle = `rgba(157,179,220,${.34 * a})`;
          g.fillRect(p.x0 + (p.tx - p.x0) * e, p.y0 + (p.ty - p.y0) * e, p.s, p.s);
        });
      });
    },
  });

  /* ── one GPU, twice: same model, samples arriving on time and arriving late ── */
  Deck.on('gpuwait', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-gw'), 1680, 540), T = 13000, BUSY = 1000;
        const lane = (y, name, period, travel) => {
          D.rect(0, y, 1680, 256, { stroke: C.line, r: 20 });
          D.t(30, y + 46, name, { f: 'sora', w: 700, fill: C.ink, size: 30 });
          D.rect(30, y + 80, 170, 130, { fill: C.peach, stroke: C.orange, r: 12 }); D.t(115, y + 153, 'Storage', { a: 'middle', w: 600, fill: C.deep, size: 26 });
          const X0 = 214, X1 = 610, Y = y + 145;
          D.path(`M${X0} ${Y} L${X1 + 24} ${Y}`, { stroke: C.line, sw: 4, arrow: 1 });
          const gpu = D.rect(650, y + 80, 190, 130, { fill: C.bpale, stroke: C.mid, r: 12 });
          D.t(745, y + 134, 'GPU', { a: 'middle', f: 'sora', w: 700, fill: C.blue, size: 30 });
          const st = D.t(745, y + 174, 'waiting', { a: 'middle', w: 600, fill: C.muted, size: 25 });
          const TX = 890, TW = 520;
          D.t(TX, y + 106, 'What the GPU did over time', { size: 23, w: 500 });
          D.rect(TX, y + 122, TW, 62, { fill: C.free, r: 10 });
          const N = Math.floor((T - travel) / period) + 1, ev = [];
          for (let i = 0; i < N; i++) {
            const a = travel + i * period;
            ev.push({ a, seg: D.rect(TX + TW * a / T, y + 122, 0, 62, { fill: C.green, r: 3 }), pg: D.rect(0, Y - 20, 30, 40, { fill: '#fff', stroke: C.blue, sw: 2.5, r: 4, display: 'none' }) });
          }
          const n = D.t(1560, y + 150, '0', { a: 'middle', f: 'sora', w: 700, fill: C.green, size: 64 });
          D.t(1560, y + 186, 'samples', { a: 'middle', size: 24 });
          return t => {
            let busy = false, done = 0;
            ev.forEach(e => {
              const s = e.a - travel, vis = t >= s && t < e.a;
              e.pg.setAttribute('display', vis ? 'inline' : 'none');
              if (vis) e.pg.setAttribute('x', X0 + (X1 - X0) * (t - s) / travel);
              e.seg.setAttribute('width', Math.max(0, Math.min(t, e.a + BUSY) - e.a) / T * TW);
              if (t >= e.a && t < e.a + BUSY) busy = true;
              if (t >= e.a + BUSY) done++;
            });
            gpu.setAttribute('fill', busy ? C.gpale : C.bpale); gpu.setAttribute('stroke', busy ? C.green : C.mid);
            st.textContent = busy ? 'learning' : 'waiting'; st.setAttribute('fill', busy ? C.green : C.muted);
            n.textContent = done;
          };
        };
        const a = lane(0, 'Data arrives on time', 1000, 800), b = lane(278, 'Data arrives late', 3000, 2800);
        ctx.el.__gw = { draw: t => { a(t); b(t); }, T };
        const key = D.el('g');
        D.rect(1228, 8, 26, 26, { fill: C.green, r: 4 }, key); D.t(1262, 30, 'learning', { size: 23 }, key);
        D.rect(1380, 8, 26, 26, { fill: C.free, stroke: C.line, r: 4 }, key); D.t(1414, 30, 'waiting', { size: 23 }, key);
      });
      const { draw, T } = ctx.el.__gw;
      ctx.__pl = play(ctx, '#pf-gw-pl', { dur: T, render: draw });
    },
  });

  /* ── the wall of files ── */
  Deck.on('nfiles', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-nf-w'), 948, 450), cols = 79, rows = 37, sz = 9, gap = 3, tiles = [], R = U.rng(9), order = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { tiles.push(D.rect(c * (sz + gap), r * (sz + gap), sz, sz, { fill: (r + c) % 2 ? C.orange : C.mid, r: 1.5, display: 'none' })); order.push(R()); }
        const idx = tiles.map((_, i) => i).sort((a, b) => order[a] - order[b]);
        ctx.el.__nf = { tiles, idx, shown: 0 };
      });
      const st = ctx.el.__nf, out = ctx.q('#pf-nf-n'), DUR = 5000;
      ctx.__pl = play(ctx, '#pf-nf-pl', {
        dur: DUR,
        render: t => {
          const k = U.ease.inout(clamp(t / (DUR - 400))), want = Math.round(k * st.idx.length);
          while (st.shown < want) st.tiles[st.idx[st.shown++]].setAttribute('display', 'inline');
          while (st.shown > want) st.tiles[st.idx[--st.shown]].setAttribute('display', 'none');
          out.textContent = (Math.round(k * 10000000 / 1000) * 1000).toLocaleString('en-US');
        },
      });
    },
  });

  /* ── one machine: GPUs, readers, a wall of small files (ambient) ── */
  Deck.on('simple', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-fan'), 820, 620), R = U.rng(5), rx = [];
        for (let g = 0; g < 8; g++) {
          const x = 40 + g * 94; D.rect(x, 68, 80, 50, { fill: C.bpale, stroke: C.mid, r: 8 }); D.t(x + 40, 100, 'GPU', { a: 'middle', fill: C.blue, size: 19, w: 600 });
          for (let r = 0; r < 3; r++) { const cx = x + 12 + r * 28, cy = 176; D.path(`M${x + 40} 118 L${cx} ${cy - 10}`, { stroke: C.line, sw: 2 }); D.el('circle', { cx, cy, r: 10, fill: '#fff', stroke: C.orange, 'stroke-width': 3 }); rx.push([cx, cy + 10]); }
        }
        const tx = [], cols = 40, rows = 12, sz = 15, gap = 4, x0 = 40, y0 = 340;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = x0 + c * (sz + gap), y = y0 + r * (sz + gap - 4); D.rect(x, y, sz, sz - 4, { fill: (r + c * 3) % 5 === 0 ? C.peach : C.free, r: 2 }); tx.push([x + sz / 2, y]); }
        for (let k = 0; k < 26; k++) { const a = tx[Math.floor(R() * tx.length)], b = rx[Math.floor(R() * rx.length)]; D.flow(`M${a[0]} ${a[1]} L${b[0]} ${b[1]}`, { r: 4, dur: 1.5 + R(), begin: -R() * 2, color: C.green }); }
        const halo = e => { e.setAttribute('paint-order', 'stroke'); e.setAttribute('stroke', '#FDFDFE'); e.setAttribute('stroke-width', 7); };
        [[50, '8 GPUs'], [226, 'Several reader processes for each GPU'], [324, 'Different small files']].forEach(([y, s]) => halo(D.t(40, y, s, { w: 600, fill: C.ink, size: 24 })));
        D.t(780, 600, '× 30 machines', { a: 'end', w: 600, fill: C.deep, size: 26, f: 'sora' });
      });
    },
  });

  /* ── three places, three small drawings ── */
  Deck.on('places', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const M = (D, x, y, w = 92, h = 44) => { D.rect(x, y, w, h, { fill: C.bpale, stroke: C.mid, r: 8 }); D.t(x + w / 2, y + 29, 'Machine', { a: 'middle', fill: C.blue, w: 600, size: 17 }); };
        { const D = canvas(ctx.q('#pf-pl1'), 484, 170);
          D.rect(70, 8, 344, 154, { fill: C.soft, stroke: C.line, r: 14 });
          M(D, 196, 18);
          D.rect(110, 104, 264, 46, { fill: C.peach, stroke: C.orange, r: 8 }); D.t(242, 134, 'Local drive', { a: 'middle', fill: C.deep, w: 600, size: 21 });
          D.path('M242 102 L242 66', { stroke: C.green, sw: 3, arrow: 1 }); D.flow('M242 102 L242 66', { r: 5, dur: .6, color: C.green }); }
        { const D = canvas(ctx.q('#pf-pl2'), 484, 170);
          for (let i = 0; i < 4; i++) { const x = 16 + i * 116; M(D, x, 6); const d = `M${x + 46} 52 L242 110`; D.path(d, { stroke: C.line, sw: 2.5 }); D.flow(d, { r: 5, dur: 1.8, begin: -i * .45, color: C.red }); }
          D.rect(100, 110, 284, 54, { fill: '#fff', stroke: C.muted, r: 10 }); D.t(242, 144, 'Shared filesystem', { a: 'middle', fill: C.ink, w: 600, size: 22 }); }
        { const D = canvas(ctx.q('#pf-pl3'), 484, 170);
          M(D, 10, 26); M(D, 10, 96);
          D.cyl(394, 36, 130, 84, '', null); D.t(394, 94, 'S3', { a: 'middle', f: 'sora', w: 700, fill: C.blue, size: 28 });
          ['M104 48 L322 72', 'M104 118 L322 96'].forEach((d, i) => { D.path(d, { stroke: C.line, sw: 2.5, dash: '8 7' }); D.flow(d, { r: 5, dur: 2.2, begin: -i, color: C.red }); });
          D.t(214, 48, 'network', { a: 'middle', size: 20, w: 600, fill: C.red }); }
      });
    },
  });

  /* ── the same data as one file and as many: lookups are per file ── */
  function fsPanel(D, x, title, sub, n, slot) {
    D.rect(x, 0, 820, 470, { stroke: C.line, r: 20 });
    D.t(x + 30, 46, title, { f: 'sora', w: 700, fill: C.ink, size: 30 });
    D.t(x + 30, 82, sub, { size: 24 });
    const W = 760, tiles = [], g = n > 1 ? 3 : 0, w = (W - g * (n - 1)) / n;
    for (let i = 0; i < n; i++) tiles.push(D.rect(x + 30 + i * (w + g), 104, w, 52, { fill: C.free, stroke: n > 1 ? 'none' : C.line, r: n > 1 ? 2 : 8 }));
    const desk = D.rect(x + 200, 182, 420, 96, { fill: C.soft, stroke: C.line, r: 14 });
    D.t(x + 410, 222, 'Lookup', { a: 'middle', f: 'sora', w: 700, fill: C.ink, size: 28 });
    D.t(x + 410, 256, 'name, size, where the bytes are', { a: 'middle', size: 22 });
    const c = D.t(x + 30, 372, '0', { f: 'sora', w: 700, fill: C.orange, size: 64 }), cl = D.t(x + 130, 368, 'lookups', { size: 27, fill: C.ink, w: 500 });
    D.t(x + 30, 412, 'Data delivered', { size: 23 });
    D.rect(x + 30, 424, 760, 26, { fill: C.free, r: 6 });
    const bar = D.rect(x + 30, 424, 0, 26, { fill: C.green, r: 6 });
    return t => {
      const { looking, looked, frac, lit } = slot(t);
      desk.setAttribute('fill', looking ? C.peach : C.soft); desk.setAttribute('stroke', looking ? C.orange : C.line);
      c.textContent = looked; cl.textContent = looked === 1 ? 'lookup' : 'lookups';
      cl.setAttribute('x', x + (looked >= 10 ? 130 : 90));
      bar.setAttribute('width', 760 * frac);
      tiles.forEach((e, i) => e.setAttribute('fill', i < lit ? C.mid : C.free));
    };
  }
  Deck.on('tryfs', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-fs'), 1680, 470), N = 40, S0 = 300, SL = 250;
        const a = fsPanel(D, 0, 'One large file', 'One lookup, then the bytes flow', 1, t => ({ looking: t >= S0 && t < 1000, looked: t >= S0 ? 1 : 0, frac: seg(t, 1000, 3200), lit: t >= 1000 ? 1 : 0 }));
        const b = fsPanel(D, 860, 'The same data, as many small files', 'One lookup for every file', N, t => { const k = (t - S0) / SL, i = Math.floor(k); return { looking: k >= 0 && i < N && k - i < .62, looked: t < S0 ? 0 : Math.min(N, i + 1), frac: clamp(k / N), lit: clamp(i, 0, N) }; });
        ctx.el.__fs = t => { a(t); b(t); };
      });
      ctx.__pl = play(ctx, '#pf-fs-pl', { dur: 10900, render: ctx.el.__fs });
    },
  });

  /* ── requests queue at a gate that lets through a fixed number per second ── */
  Deck.on('trys3', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-s3'), 1000, 620), N = 60, IV = 200, FLY = 900, GX = 560, CX = 850;
        D.t(36, 56, 'One request for each small file', { f: 'sora', w: 700, fill: C.ink, size: 28 });
        D.rect(GX - 8, 130, 16, 320, { fill: C.red, r: 8 });
        D.t(GX, 100, 'The limit', { a: 'middle', w: 700, fill: C.red, size: 26 });
        D.lines(GX, 490, ['about 5,500 requests', 'per second, per prefix'], { a: 'middle', size: 24, w: 600, fill: C.red });
        D.cyl(CX, 190, 170, 200, '', null); D.t(CX, 300, 'S3', { a: 'middle', f: 'sora', w: 700, fill: C.blue, size: 36 });
        const ds = Array.from({ length: N }, () => D.el('circle', { r: 11, fill: C.orange }));
        const nW = D.t(36, 580, '', { w: 600, fill: C.deep, size: 27 }), nS = D.t(964, 580, '', { a: 'end', w: 600, fill: C.green, size: 27 });
        ctx.el.__s3 = { dur: N * IV + FLY, draw: t => {
          const gone = Math.floor(t / IV); let arrived = 0;
          ds.forEach((c, j) => {
            const q = j - gone;
            if (q >= 0) { const col = Math.floor(q / 6), row = q % 6; c.setAttribute('cx', GX - 44 - col * 42); c.setAttribute('cy', 180 + row * 44); c.setAttribute('display', GX - 44 - col * 42 < 20 ? 'none' : 'inline'); c.setAttribute('opacity', 1); return; }
            const k = (t - j * IV) / FLY;
            if (k >= 1) { arrived++; c.setAttribute('display', 'none'); return; }
            c.setAttribute('display', 'inline'); c.setAttribute('cx', GX + (CX - 90 - GX) * k); c.setAttribute('cy', 290);
          });
          nW.textContent = Math.max(0, N - gone) + ' waiting'; nS.textContent = arrived + ' served';
        } };
      });
      const s = ctx.el.__s3;
      ctx.__pl = play(ctx, '#pf-s3-pl', { dur: s.dur, render: s.draw });
    },
  });

  /* ── three processes, each fetching the same data for itself ── */
  Deck.on('repeat', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-rp'), 1680, 560), names = ['Training', 'Data job', 'Notebook'], FLY = 1500, GAP = 2700, T0 = 300;
        D.cyl(130, 170, 210, 220, 'Object store');
        D.rect(300, 0, 1380, 556, { fill: C.soft, stroke: C.line, r: 22 });
        D.t(328, 44, 'One machine', { w: 600, fill: C.muted, size: 24 });
        D.rect(560, 76, 420, 450, { fill: C.peach, stroke: C.orange, r: 16 }); D.t(770, 116, 'Local disk', { a: 'middle', w: 600, fill: C.deep, size: 26 });
        const rows = names.map((n, i) => {
          const y = 140 + i * 126;
          D.rect(600, y, 340, 100, { fill: '#fff', stroke: '#F3D9BC', r: 10, dash: '6 6' });
          const sh = D.rect(600, y, 340, 100, { fill: C.mid, r: 10, display: 'none' }), lb = D.t(770, y + 60, 'the same data', { a: 'middle', w: 600, fill: '#fff', size: 26 }); lb.setAttribute('display', 'none');
          D.rect(1270, y, 360, 100, { stroke: C.line, r: 12 }); D.t(1450, y + 60, n, { a: 'middle', w: 600, fill: C.ink, size: 30 });
          const ln = D.path(`M1268 ${y + 50} L944 ${y + 50}`, { stroke: C.orange, sw: 3, dash: '8 7', arrow: 1 });
          const back = D.path(`M942 ${y + 50} L1266 ${y + 50}`, { stroke: C.green, sw: 4, arrow: 1 });
          return { y, sh, lb, ln, back };
        });
        const fly = D.rect(0, 0, 80, 40, { fill: C.mid, r: 6, display: 'none' });
        ctx.el.__rp = { T: T0 + GAP * 3 + 500, draw: (t, fE, cE) => {
          let done = 0, active = null;
          rows.forEach((r, i) => {
            const s = T0 + i * GAP, here = t >= s + FLY;
            if (here) done++; if (t >= s && !here) active = { r, k: (t - s) / FLY };
            r.sh.setAttribute('display', here ? 'inline' : 'none'); r.lb.setAttribute('display', here ? 'inline' : 'none');
            r.ln.setAttribute('opacity', t >= s - 100 && !here ? 1 : 0); r.back.setAttribute('opacity', here ? 1 : 0);
          });
          if (active) { const e = U.ease.inout(active.k), x0 = 170, y0 = 250, x1 = 730, y1 = active.r.y + 30; fly.setAttribute('display', 'inline'); fly.setAttribute('x', x0 + (x1 - x0) * e); fly.setAttribute('y', y0 + (y1 - y0) * e); } else fly.setAttribute('display', 'none');
          const nf = rows.filter((_, i) => t >= T0 + i * GAP).length; fE.textContent = nf; cE.textContent = done; fE.nextElementSibling.textContent = (nf === 1 ? 'fetch' : 'fetches') + ' of the same data'; cE.nextElementSibling.textContent = (done === 1 ? 'copy' : 'copies') + ' on this machine';
        } };
      });
      const s = ctx.el.__rp, f = ctx.q('#pf-rp-f'), c = ctx.q('#pf-rp-c');
      ctx.__pl = play(ctx, '#pf-rp-pl', { dur: s.T, render: t => s.draw(t, f, c) });
    },
  });

  /* ── the final picture, once every piece has been explained ── */
  Deck.on('recap', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-agd'), 584, 530), g = C.green;
        D.cyl(500, 26, 150, 38, '', null); D.t(410, 60, 'Object store', { a: 'end', w: 600, fill: C.ink, size: 24 });
        D.rect(10, 136, 564, 386, { fill: C.soft, stroke: C.line, r: 16 });
        D.t(30, 170, 'One machine', { w: 600, fill: C.muted, size: 21 });
        ['Training', 'Data job', 'Notebook'].forEach((n, i) => { D.rect(30 + i * 148, 188, 136, 56, { stroke: C.line, r: 10 }); D.t(98 + i * 148, 224, n, { a: 'middle', w: 600, fill: C.ink, size: 21 }); });
        D.rect(140, 308, 204, 66, { fill: C.bpale, stroke: C.mid, r: 12 }); D.t(242, 349, 'Daemon', { a: 'middle', w: 600, fill: C.blue, size: 25, f: 'sora' });
        D.rect(30, 432, 524, 70, { fill: C.peach, stroke: C.orange, r: 12 }); D.t(292, 475, 'Local disk: shards', { a: 'middle', w: 600, fill: C.deep, size: 24 });
        D.path('M246 246 L242 306', { dash: '6 7', arrow: 1 }); D.path('M394 246 L330 306', { dash: '6 7', arrow: 1 }); D.path('M110 246 L170 306', { dash: '6 7', arrow: 1 });
        D.path('M242 374 V430', { dash: '6 7', arrow: 1 });
        D.path('M515 112 V430', { stroke: C.orange, sw: 4, arrow: 1 });
        D.path('M70 432 V248', { stroke: g, sw: 7, arrow: 1 });
      });
    },
  });

})();
