/* Part 3: the local cache and the daemon */
(function () {
  const U = Deck.util, { C, canvas, dots, along, curve, seg, grow, once, play, log, clamp } = Deck.pf;

  /* ── shards arrive once, reads keep flowing ── */
  Deck.on('cache', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-ca'), 1680, 560), R = U.rng(13);
        D.cyl(120, 170, 210, 220, 'Object store');
        for (let k = 0; k < 4; k++) D.rect(70, 200 + k * 44, 100, 28, { fill: C.mid, r: 5 });
        D.rect(290, 0, 1390, 556, { fill: C.soft, stroke: C.line, r: 22 });
        D.t(318, 44, 'One machine', { w: 600, fill: C.muted, size: 24 });
        D.rect(318, 66, 660, 462, { fill: C.peach, stroke: C.orange, r: 16 });
        D.t(344, 108, 'Local disk (NVMe)', { w: 600, fill: C.deep, size: 26 });
        const SW = 142, SH = 170, slots = [];
        for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
          const x = 340 + c * (SW + 15), y = 130 + r * (SH + 15);
          const bg = D.rect(x, y, SW, SH, { fill: '#fff', stroke: '#F3D9BC', r: 10, dash: '6 6' });
          const sh = D.rect(x, y, SW, SH, { fill: C.mid, r: 10 });
          const lb = D.t(x + SW / 2, y + SH / 2 + 8, '', { a: 'middle', w: 600, fill: '#fff', size: 25 });
          slots.push({ x, y, bg, sh, lb });
        }
        const P = ['Training · GPU 0', 'Training · GPU 1', 'Training · GPU 2', 'Training · GPU 3', 'Data job', 'Notebook'].map((n, i) => {
          const y = 40 + i * 84; D.rect(1330, y, 320, 66, { stroke: C.line, r: 12 }); D.t(1352, y + 42, n, { w: 600, fill: C.ink, size: 26 });
          return [1328, y + 33];
        });
        D.t(1154, 40, 'tens of microseconds', { a: 'middle', w: 600, fill: C.green, size: 22 });
        D.t(120, 60, 'over the network:', { a: 'middle', size: 22, fill: C.red, w: 600 });
        D.t(120, 88, 'milliseconds', { a: 'middle', size: 22, fill: C.red, w: 600 });
        const ORDER = [0, 3, 5, 1, 6, 2, 7, 4], IV = 1500, FL = 1100, T0 = 400, TOTAL = T0 + IV * 8 + 3200;
        const dl = ORDER.map((s, i) => ({ s, t0: T0 + i * IV, land: T0 + i * IV + FL, n: i + 1 }));
        const fly = D.rect(0, 0, SW, SH, { fill: C.mid, r: 10, display: 'none' });
        const reads = [];
        for (let t = dl[0].land; t < TOTAL - 700; t += 70) {
          const filled = dl.filter(d => d.land <= t), s = slots[filled[Math.floor(R() * filled.length)].s], p = P[Math.floor(R() * P.length)];
          reads.push({ t0: t, dur: 650, r: 6, color: C.green, at: curve(s.x + SW / 2, s.y + SH / 2, p[0], p[1], -14) });
        }
        ctx.el.__ca = { D, slots, dl, reads, fly, draw: dots(D, reads), TOTAL, SW, SH, FL };
      });
      const { slots, dl, reads, fly, draw, TOTAL, SW, SH, FL } = ctx.el.__ca, rEl = ctx.q('#pf-ca-r'), dEl = ctx.q('#pf-ca-d');
      ctx.__pl = play(ctx, '#pf-ca-pl', {
        dur: TOTAL,
        render: t => {
          let done = 0, active = null;
          dl.forEach(d => {
            const s = slots[d.s], here = t >= d.land, flying = t >= d.t0 && !here;
            if (here) done++; if (flying) active = d;
            s.sh.setAttribute('display', here ? 'inline' : 'none'); s.lb.textContent = here ? 'shard ' + d.n : '';
            s.bg.setAttribute('stroke', flying ? C.orange : '#F3D9BC');
          });
          if (active) {
            const s = slots[active.s], e = U.ease.out(clamp((t - active.t0) / FL)), x0 = 50, y0 = 200;
            fly.setAttribute('display', 'inline'); fly.setAttribute('x', x0 + (s.x - x0) * e); fly.setAttribute('y', y0 + (s.y - y0) * e); fly.setAttribute('width', 60 + (SW - 60) * e); fly.setAttribute('height', 30 + (SH - 30) * e);
          } else fly.setAttribute('display', 'none');
          draw(t);
          let n = 0; for (const r of reads) { if (r.t0 + r.dur <= t) n++; else break; }
          rEl.textContent = n.toLocaleString('en-US'); dEl.textContent = dl.filter(d => d.t0 <= t).length;
        },
      });
    },
  });

  /* ── the daemon: processes ask through one socket (ambient) ── */
  Deck.on('daemon', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-dm'), 1100, 640);
        D.t(36, 52, 'One machine', { w: 600, fill: C.muted, size: 24 });
        ['Training', 'Data job', 'Notebook'].forEach((n, i) => {
          const x = 70 + i * 340; D.rect(x, 74, 280, 72, { fill: C.soft, stroke: C.line, r: 12 }); D.t(x + 140, 120, n, { a: 'middle', w: 600, fill: C.ink, size: 27 });
          const d = `M${x + 140} 148 L${x + 140} 204`; D.path(d, { dash: '7 8', arrow: 1 }); D.flow(d, { r: 6, dur: 1.2, begin: -i * .4, color: C.blue });
        });
        D.rect(120, 206, 860, 56, { fill: C.bpale, stroke: C.mid, r: 28 }); D.t(550, 243, 'Unix domain socket', { a: 'middle', w: 600, fill: C.blue, size: 25 });
        D.path('M550 264 L550 314', { dash: '7 8', arrow: 1 }); D.flow('M550 264 L550 314', { r: 6, dur: 1.2, color: C.blue });
        D.t(570, 298, 'ensure_shard', { f: 'mono', w: 600, fill: C.ink, size: 24 });
        D.rect(300, 316, 500, 110, { fill: C.blue, r: 16 });
        D.t(550, 362, 'Patram-FS daemon', { a: 'middle', f: 'sora', w: 700, fill: '#fff', size: 32 });
        D.t(550, 402, '"Is this shard on the local disk, and where?"', { a: 'middle', fill: '#E4ECFA', size: 23 });
        D.rect(70, 514, 430, 90, { fill: C.peach, stroke: C.orange, r: 14 }); D.t(285, 568, 'Local disk: check first', { a: 'middle', w: 600, fill: C.deep, size: 26 });
        D.rect(600, 514, 430, 90, { fill: C.bpale, stroke: C.mid, r: 14 });
        D.t(815, 555, 'Object store: download only if', { a: 'middle', w: 600, fill: C.blue, size: 24 }); D.t(815, 586, 'missing and not already downloading', { a: 'middle', fill: C.blue, size: 22 });
        D.path('M430 428 L320 510', { dash: '7 8', arrow: 1 }); D.path('M670 428 L780 510', { dash: '7 8', arrow: 1 });
      });
    },
  });

  /* ── the same moment twice: eight processes, one shard ── */
  const TL = { a: { lines: 600, firstBlock: 1100, gap: 220, fly: 800 }, b: { asks: 5000, merge: 6200, dl: 6300, block: 6700, fly: 900, read: 8200 }, dur: 11000 };
  function ddPanel(host, one) {
    const D = canvas(host, 825, 560);
    const SX = 640, SY = 104, DISK = { x: 44, y: 200, w: 350, h: 146 }, DM = { x: 468, y: 214, w: 310, h: 92 }, PX = k => 86 + k * 93, PY = 396;
    D.t(28, 44, one ? 'With the daemon' : 'Without a daemon', { f: 'sora', w: 700, fill: C.ink, size: 28 });
    D.t(28, 78, one ? 'Every process asks the daemon' : 'Each process downloads the shard itself', { size: 22 });
    D.cyl(SX, SY, 130, 34, '', null); D.t(SX - 80, SY + 30, 'Object store', { a: 'end', w: 600, fill: C.ink, size: 22 });
    D.rect(20, 168, 785, 280, { fill: C.soft, stroke: C.line, r: 16 });
    D.rect(DISK.x, DISK.y, DISK.w, DISK.h, { fill: C.peach, stroke: C.orange, r: 12 });
    D.t(DISK.x + 14, DISK.y - 10 + 34, 'Local disk', { w: 600, fill: C.deep, size: 21 });
    if (one) {
      D.rect(DM.x, DM.y, DM.w, DM.h, { fill: C.blue, r: 14 });
      D.t(DM.x + 22, DM.y + 40, 'Patram-FS daemon', { f: 'sora', w: 700, fill: '#fff', size: 24 });
      D.t(DM.x + 22, DM.y + 70, 'one per machine', { fill: '#E4ECFA', size: 21 });
    }
    const badge = one ? D.t(DM.x, DM.y - 12, '8 requests → 1 download', { w: 700, fill: C.green, size: 21 }) : null;
    const copy = D.t(DISK.x + DISK.w / 2, DISK.y + DISK.h - 13, one ? '1 copy, shared by all 8' : '8 copies of the same shard', { a: 'middle', w: 700, size: 21, fill: one ? C.green : C.red });
    const wires = D.el('g'), procs = [];
    const line = (x1, y1, x2, y2, o) => D.path(`M${x1} ${y1} L${x2} ${y2}`, o, wires);
    let dlLines = [], askLines = [], readLines = [], dlOne = null;
    for (let k = 0; k < 8; k++) {
      if (one) { askLines.push(line(PX(k), PY - 24, DM.x + 20 + k * 38, DM.y + DM.h, { stroke: C.muted, sw: 2.5 })); readLines.push(line(DISK.x + 60 + k * 18, DISK.y + DISK.h, PX(k), PY - 24, { stroke: C.green, sw: 3 })); }
      else dlLines.push(line(PX(k), PY - 24, SX - 48 + k * 13, SY + 52, { stroke: C.orange, sw: 2.5 }));
    }
    if (one) dlOne = line(DM.x + DM.w - 18, DM.y, SX + 50, SY + 50, { stroke: C.orange, sw: 3.5 });
    for (let k = 0; k < 8; k++) {
      const c = D.el('circle', { cx: PX(k), cy: PY, r: 26, fill: '#fff', stroke: C.line, 'stroke-width': 3 });
      D.t(PX(k), PY + 7, 'P' + (k + 1), { a: 'middle', w: 600, fill: C.ink, size: 20 }); procs.push(c);
    }
    const nD = D.t(28, 530, '0', { f: 'sora', w: 700, fill: C.orange, size: 44 }), lD = D.t(92, 528, 'downloads', { size: 23 });
    const nG = D.t(330, 530, '0 GiB', { f: 'sora', w: 700, fill: C.orange, size: 44 }), lG = D.t(490, 528, 'from the object store', { size: 23 });
    const blocks = []; const slot = i => [DISK.x + 16 + (i % 4) * 80, DISK.y + 34 + Math.floor(i / 4) * 34];
    for (let i = 0; i < (one ? 1 : 8); i++) blocks.push(D.rect(0, 0, 72, 28, { fill: C.mid, r: 5, display: 'none' }));
    const fx = SX - 36, fy = SY + 14;
    const setBlock = (b, i, k) => { if (k <= 0) { b.setAttribute('display', 'none'); return; } const [tx, ty] = slot(i), e = U.ease.out(k); b.setAttribute('display', 'inline'); b.setAttribute('x', fx + (tx - fx) * e); b.setAttribute('y', fy + (ty - fy) * e); };
    return t => {
      let n = 0;
      if (!one) {
        const A = TL.a, end = A.firstBlock + 7 * A.gap + A.fly;
        dlLines.forEach(l => { grow(l, t < end + 100 ? seg(t, A.lines, A.lines + 500) : 0); });
        blocks.forEach((b, i) => { const s = A.firstBlock + i * A.gap, k = seg(t, s, s + A.fly); setBlock(b, i, k); if (k >= 1) n++; });
        copy.setAttribute('opacity', t >= end + 100 ? 1 : 0);
        procs.forEach(c => c.setAttribute('stroke', t >= end + 100 ? C.red : t >= A.lines ? C.orange : C.line));
      } else {
        const B = TL.b;
        askLines.forEach(l => { grow(l, t < B.read ? seg(t, B.asks, B.asks + 600) : 0, t >= B.merge ? '4 7' : null); l.setAttribute('stroke', t >= B.merge ? C.green : C.muted); });
        grow(dlOne, t < B.read ? seg(t, B.dl, B.dl + 400) : 0);
        const k = seg(t, B.block, B.block + B.fly); setBlock(blocks[0], 0, k); if (k >= 1) n = 1;
        readLines.forEach(l => grow(l, seg(t, B.read, B.read + 500)));
        badge.setAttribute('opacity', t >= B.merge ? 1 : 0);
        copy.setAttribute('opacity', t >= B.read ? 1 : 0);
        procs.forEach(c => c.setAttribute('stroke', t >= B.read + 500 ? C.green : t >= B.asks ? C.orange : C.line));
      }
      nD.textContent = n; nG.textContent = (n * 10) + ' GiB'; lD.textContent = n === 1 ? 'download' : 'downloads';
      nD.setAttribute('fill', one ? C.green : C.orange);
      nG.setAttribute('fill', one ? C.green : C.orange);
    };
  }
  Deck.on('dedup', {
    enter(ctx) {
      const lg = log(ctx.q('#pf-dd-l'), [
        [0, 'Start', '', 'Eight processes need the same shard at the same moment.'],
        [600, 'Without a daemon', 'r', 'Each of the 8 processes downloads the same shard for itself.'],
        [TL.b.asks, 'With the daemon', 'b', 'The same 8 processes send their 8 requests to the daemon instead.'],
        [TL.b.merge, 'Merged', 'g', 'The daemon sees 8 requests for the same shard and merges them into 1 download.'],
        [TL.b.read, 'Shared', 'g', 'All 8 processes read the one copy on the local disk.'],
        [9500, 'Result', 'g', 'Same 8 processes, same shard: 8 downloads (80 GiB) without the daemon, 1 download (10 GiB) with it.'],
      ]);
      once(ctx, '__b', () => { ctx.el.__a = ddPanel(ctx.q('#pf-dd-a'), false); ctx.el.__b2 = ddPanel(ctx.q('#pf-dd-b'), true); });
      const a = ctx.q('#pf-dd-a'), b = ctx.q('#pf-dd-b');
      ctx.__pl = play(ctx, '#pf-dd-pl', {
        dur: TL.dur,
        render: t => {
          ctx.el.__a(t); ctx.el.__b2(t); lg(t);
          a.style.opacity = t >= 4700 && t < 9500 ? .5 : 1; b.style.opacity = t < 4700 ? .5 : 1;
        },
      });
    },
  });

  /* ── where the bytes go: the question hides the data path until the answer ── */
  Deck.on('ytbytes', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-ar'), 1040, 660);
        D.rect(16, 16, 790, 628, { fill: C.soft, stroke: C.line, r: 18 });
        D.t(40, 56, 'One machine', { w: 600, fill: C.muted, size: 24 });
        ['Training', 'Data job', 'Notebook'].forEach((n, i) => {
          const x = 44 + i * 256; D.rect(x, 74, 220, 66, { stroke: C.line, r: 12 }); D.t(x + 110, 116, n, { a: 'middle', w: 600, fill: C.ink, size: 25 });
          if (i) D.path(`M${x + 110} 142 L${x + 110} 186`, { dash: '6 7', arrow: 1 });
        });
        D.path('M230 142 L230 186', { dash: '6 7', arrow: 1 });
        D.rect(190, 188, 590, 46, { fill: C.bpale, stroke: C.mid, r: 23 }); D.t(485, 219, 'Unix domain socket', { a: 'middle', w: 600, fill: C.blue, size: 22 });
        D.path('M485 236 L485 296', { dash: '6 7', arrow: 1 });
        D.t(500, 274, 'ensure_shard · once per shard', { size: 21, w: 600, fill: C.ink });
        D.rect(330, 298, 310, 100, { fill: C.blue, r: 14 });
        D.t(485, 340, 'Patram-FS daemon', { a: 'middle', f: 'sora', w: 700, fill: '#fff', size: 25 });
        const never = D.t(485, 374, 'answers questions', { a: 'middle', fill: '#E4ECFA', size: 21 });
        D.cyl(920, 280, 170, 110, 'Object store', null, { size: 23 });
        D.path('M642 340 L830 340', { dash: '6 7', arrow: 1 }); D.t(736, 326, 'download', { a: 'middle', size: 20, w: 600, fill: C.ink }); D.t(736, 368, 'if missing', { a: 'middle', size: 20, w: 600, fill: C.ink });
        D.rect(44, 516, 736, 100, { fill: C.peach, stroke: C.orange, r: 14 }); D.t(412, 574, 'Local NVMe drive', { a: 'middle', w: 600, fill: C.deep, size: 27 });
        D.path('M840 450 C 830 540, 830 566, 784 566', { stroke: C.orange, sw: 4, arrow: 1 });
        D.t(830, 620, 'shard bytes, once', { size: 20, w: 600, fill: C.deep });
        const q = D.el('g', { class: 'pf-fd' });
        D.path('M100 514 L100 146', { stroke: C.faint, sw: 4, dash: '10 10' }, q); D.t(100, 340, '?', { a: 'middle', f: 'sora', w: 700, fill: C.deep, size: 54 }, q);
        const a = D.el('g', { class: 'pf-fd' });
        D.path('M100 514 L100 148', { stroke: C.green, sw: 12, arrow: 1 }, a);
        D.lines(122, 310, ['open + pread', 'every worker,', 'millions of reads'], { size: 21, w: 600, fill: C.green, lh: 28 }, a);
        ctx.el.__yb = { q, a, never };
      });
    },
    step(ctx, s) {
      const { q, a, never } = ctx.el.__yb;
      q.style.opacity = s >= 2 ? 0 : 1; a.style.opacity = s >= 2 ? 1 : 0;
      never.textContent = s >= 2 ? 'never carries the data' : 'answers questions';
    },
  });
})();
