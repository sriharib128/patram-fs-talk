/* Introduction and Part 1 */
(function () {
  const U = Deck.util, { C, canvas, once, clamp } = Deck.pf;

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

  /* ── the cluster as a lattice of GPUs, a few of them reading at any moment (ambient) ── */
  Deck.on('whyit', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const h = ctx.q('#pf-lat'), R = U.rng(11);
        for (let k = 0; k < 240; k++) { const i = document.createElement('i'); i.style.animationDelay = (-R() * 4).toFixed(2) + 's'; h.appendChild(i); }
      });
    },
  });

  /* ── a small version of the final picture ── */
  Deck.on('agenda', {
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

  /* ── the five terms in one picture ── */
  Deck.on('cluster', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-cl'), 1680, 690);
        [[24, 24], [12, 12]].forEach(([dx, dy]) => D.rect(dx, dy, 950, 650, { fill: '#F7F9FC', stroke: C.line, r: 20 }));
        D.rect(0, 0, 950, 650, { fill: '#fff', stroke: C.blue, sw: 2.5, r: 20 });
        D.t(32, 52, 'Machine', { f: 'sora', w: 700, fill: C.ink, size: 32 });
        D.t(200, 52, 'one server in the cluster, also called a node', { size: 25 });
        D.t(920, 52, '× 30', { a: 'end', f: 'sora', w: 700, fill: C.deep, size: 32 });
        for (let g = 0; g < 8; g++) { D.rect(32 + g * 111, 80, 99, 60, { fill: C.bpale, stroke: C.mid, r: 10 }); D.t(81 + g * 111, 118, 'H100', { a: 'middle', fill: C.blue, w: 600, size: 22 }); }
        D.t(32, 200, 'Workers', { f: 'sora', w: 700, fill: C.ink, size: 28 });
        D.t(170, 200, 'Python processes that read samples, uncoordinated', { size: 25 });
        const wy = 248;
        for (let w = 0; w < 24; w++) D.el('circle', { cx: 50 + w * 37, cy: wy, r: 14, fill: '#fff', stroke: C.orange, 'stroke-width': 3 });
        D.rect(32, 410, 886, 200, { fill: C.peach, stroke: C.orange, sw: 2.5, r: 16 });
        D.t(60, 462, 'NVMe', { f: 'sora', w: 700, fill: C.deep, size: 34 });
        D.t(60, 508, 'A 30 TB drive attached directly to the machine', { size: 26, fill: C.ink });
        D.t(60, 570, 'tens of microseconds', { f: 'mono', w: 600, fill: C.green, size: 34 });
        D.t(474, 570, 'per read', { size: 26, fill: C.green });
        for (let k = 0; k < 6; k++) { const x = 90 + k * 152; D.path(`M${x} 408 L${x} ${wy + 18}`, { stroke: C.green, sw: 3, arrow: 1 }); D.flow(`M${x} 408 L${x} ${wy + 18}`, { r: 6, dur: .9, begin: -k * .23, color: C.green }); }

        D.rect(1140, 10, 540, 300, { fill: '#fff', stroke: C.line, r: 20 });
        D.t(1170, 62, 'Shared filesystem', { f: 'sora', w: 700, fill: C.ink, size: 30 });
        D.lines(1170, 108, ['A network filesystem every machine mounts,', 'so every machine sees the same files.'], { size: 24 });
        for (let r = 0; r < 4; r++) for (let c = 0; c < 30; c++) D.rect(1170 + c * 16, 180 + r * 14, 12, 8, { fill: C.line, r: 1 });
        D.t(1170, 268, 'One metadata entry (an inode) per file', { size: 24, fill: C.ink, w: 500 });

        D.rect(1140, 340, 540, 340, { fill: '#fff', stroke: C.line, r: 20 });
        D.cyl(1600, 382, 110, 44, '', null);
        D.t(1170, 392, 'Object store', { f: 'sora', w: 700, fill: C.ink, size: 30 });
        D.lines(1170, 480, ['Where datasets live long term, such as', 'Amazon S3. Whole objects, over the network.'], { size: 24 });
        D.t(1170, 590, 'Charged and limited by request', { size: 24, fill: C.ink, w: 500 });

        const L = [[160, 1136], [510, 1136]];
        L.forEach(([y, x]) => { D.path(`M978 ${y} L${x} ${y}`, { stroke: C.red, sw: 3, arrow: 1, dash: '8 7' }); D.flow(`M978 ${y} L${x} ${y}`, { r: 6, dur: 2.2, color: C.red }); });
        D.t(1062, 322, 'network', { a: 'middle', size: 24, fill: C.red, w: 600 });
        D.t(1062, 352, 'milliseconds', { a: 'middle', size: 24, fill: C.red, w: 600 });
      });
    },
  });

  /* ── the three problems, each with a small looping picture ── */
  Deck.on('three', {
    enter(ctx) {
      once(ctx, '__b', () => {
        { /* metadata load */
          const D = canvas(ctx.q('#pf-tr1'), 484, 290);
          for (let m = 0; m < 5; m++) { const x = 8 + m * 96; D.rect(x, 6, 80, 44, { fill: C.bpale, stroke: C.mid, r: 8 }); D.path(`M${x + 40} 52 L${x + 40} 128`, { stroke: C.line, sw: 3 }); D.flow(`M${x + 40} 52 L${x + 40} 128`, { r: 6, dur: 3.2, begin: -m * .7, color: C.red }); }
          D.rect(8, 130, 468, 150, { fill: C.soft, stroke: C.line, r: 14 });
          D.t(26, 164, 'One metadata entry per file', { size: 21, w: 600, fill: C.ink });
          for (let r = 0; r < 6; r++) for (let c = 0; c < 40; c++) D.rect(26 + c * 11, 180 + r * 15, 8, 9, { fill: (r * 7 + c * 3) % 11 === 0 ? C.red : '#C9D3E5', r: 1 });
        }
        { /* the request limit */
          const D = canvas(ctx.q('#pf-tr2'), 484, 290), R = U.rng(3);
          for (let r = 0; r < 12; r++) for (let c = 0; c < 15; c++) { D.el('circle', { cx: 16 + c * 16 + (r % 2) * 7, cy: 34 + r * 16, r: 5.5, fill: C.orange, opacity: .35 + R() * .55 }); }
          D.t(10, 262, 'about 10 million requests', { size: 21, w: 600, fill: C.deep });
          D.rect(268, 14, 12, 210, { fill: C.red, r: 6 });
          D.t(286, 262, 'the limit', { size: 21, w: 600, fill: C.red });
          D.cyl(410, 76, 104, 90, '', null);
          [0, .6, 1.2].forEach(b => D.flow('M250 120 L356 120', { r: 6, dur: 1.8, begin: -b, color: C.orange }));
        }
        { /* repeated work */
          const D = canvas(ctx.q('#pf-tr3'), 484, 290);
          const names = ['Training', 'Data job', 'Notebook'];
          D.cyl(420, 78, 96, 110, '', null);
          D.rect(170, 14, 148, 262, { fill: C.peach, stroke: C.orange, r: 12 });
          D.t(244, 42, 'Local disk', { a: 'middle', size: 20, w: 600, fill: C.deep });
          names.forEach((n, i) => {
            const y = 64 + i * 72;
            D.rect(0, y, 134, 52, { stroke: C.line, r: 9 }); D.t(67, y + 33, n, { a: 'middle', size: 20, w: 600, fill: C.ink });
            D.rect(190, y + 6, 108, 40, { fill: C.orange, r: 6 }); D.t(244, y + 33, 'same shard', { a: 'middle', size: 17, w: 600, fill: '#fff' });
            D.path(`M372 ${100 + i * 34} L300 ${y + 26}`, { stroke: C.orange, sw: 2.5, arrow: 1, dash: '6 6' });
            D.flow(`M372 ${100 + i * 34} L300 ${y + 26}`, { r: 5, dur: 1.5, begin: -i * .5, color: C.orange });
            D.path(`M188 ${y + 26} L136 ${y + 26}`, { stroke: C.green, sw: 3, arrow: 1 });
          });
        }
      });
    },
  });
})();
