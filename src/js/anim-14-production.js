/* Part 5: disk space, the pattern, trade-offs */
(function () {
  const U = Deck.util, { C, canvas, once, play, log, clamp, seg } = Deck.pf;

  /* ── eviction, as a list of states over time ── */
  const EV = (() => {
    const F = [
      { t: 0, order: [1, 2, 3, 4, 5, 6] },
      { t: 1500, order: [1, 2, 3, 4, 5, 6, 7] },
      { t: 2200, order: [1, 2, 3, 4, 5, 6, 7, 8] },
      { t: 4000, order: [1, 3, 4, 5, 6, 7, 8, 2], hot: 2 },
      { t: 6200, order: [1, 3, 4, 5, 6, 7, 8, 2, 9], over: 1 },
      { t: 8000, order: [1, 3, 4, 5, 6, 7, 8, 2, 9], over: 1, gone: 1 },
      { t: 9500, order: [6, 7, 8, 2, 9] },
    ];
    return { F, dur: 12500, victims: [1, 3, 4, 5] };
  })();
  Deck.on('evict', {
    enter(ctx) {
      const bar = ctx.q('#pf-ev-i'), ann = ctx.q('#pf-ev-a'), B = {};
      once(ctx, '__b', () => {
        for (let n = 1; n <= 9; n++) { const d = document.createElement('div'); d.className = 'pf-ev-s'; d.textContent = n; d.dataset.n = n; bar.appendChild(d); }
        for (let k = 0; k < 3; k++) { const d = document.createElement('div'); d.className = 'pf-ev-s a'; d.textContent = 'A' + (k + 1); d.style.left = (k * 10 + .4) + '%'; ann.appendChild(d); }
      });
      bar.querySelectorAll('.pf-ev-s').forEach(d => { B[d.dataset.n] = d; });
      const lg = log(ctx.q('#pf-ev-l'), [
        [0, 'Start', '', 'Six image shards are on the disk.'],
        [1500, 'Download', 'b', 'Shards 7 and 8 arrive, and the budget reaches its upper mark.'],
        [4000, 'Asked again', 'o', 'Shard 2 is asked for again, so it moves to the newest end.'],
        [6200, 'Over', 'r', 'Shard 9 pushes the image shards over the upper mark.'],
        [8000, 'Clean up', 'g', 'The least recently asked for shards are deleted, down to the lower mark.'],
        [10300, 'Done', 'g', 'There is room for more downloads, and the annotation shards were not touched.'],
      ]);
      const { F, dur, victims } = EV;
      ctx.__pl = play(ctx, '#pf-ev-pl', {
        dur,
        render: t => {
          let f = 0; for (let i = 0; i < F.length; i++) if (t >= F[i].t) f = i;
          const cur = F[f], prev = F[Math.max(0, f - 1)], k = U.ease.out(seg(t, cur.t, cur.t + 360));
          bar.classList.toggle('pf-over', !!cur.over);
          for (let n = 1; n <= 9; n++) {
            const d = B[n], i = cur.order.indexOf(n), j = prev.order.indexOf(n);
            if (i < 0) { d.style.display = 'none'; continue; }
            d.style.display = 'flex';
            const from = j < 0 ? i : j, x = from + (i - from) * k;
            d.style.left = (x * 10 + .4) + '%';
            let op = j < 0 ? seg(t, cur.t, cur.t + 300) : 1;
            if (cur.gone) { const vi = victims.indexOf(n); if (vi >= 0) op = 1 - seg(t, cur.t + vi * 350, cur.t + vi * 350 + 300); }
            d.style.opacity = op;
            d.classList.toggle('hot', cur.hot === n);
            d.classList.toggle('fresh', j < 0);
          }
          lg(t);
        },
      });
    },
  });

  /* ── a name, its data, and who is holding it open ── */
  Deck.on('ytdel', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-dl'), 1000, 650);
        D.t(36, 58, 'A folder on the local disk', { w: 600, fill: C.muted, size: 24 });
        const nm = D.el('g', { class: 'pf-fd' });
        D.rect(36, 76, 420, 72, { fill: C.bpale, stroke: C.mid, r: 12 }, nm);
        D.t(246, 122, 'shard_0003.tar', { a: 'middle', f: 'mono', w: 600, fill: C.blue, size: 28 }, nm);
        D.path('M246 150 L246 244', { stroke: C.mid, sw: 4, arrow: 1 }, nm);
        D.t(262, 204, 'the name points to the data', { size: 22, fill: C.body }, nm);
        const gone = D.el('g', { class: 'pf-fd' });
        D.rect(36, 76, 420, 72, { fill: '#fff', stroke: C.red, r: 12, dash: '8 8' }, gone);
        D.t(246, 122, 'name removed', { a: 'middle', f: 'mono', w: 600, fill: C.red, size: 26 }, gone);
        D.t(964, 236, 'The data on the drive', { a: 'end', w: 600, fill: C.muted, size: 24 });
        D.rect(36, 250, 928, 110, { fill: C.mid, r: 14 });
        D.t(740, 318, 'shard data', { a: 'middle', w: 600, fill: '#fff', size: 30 });
        D.rect(36, 250, 480, 110, { fill: 'rgba(14,26,58,.26)', r: 14 });
        D.rect(36, 480, 340, 110, { fill: '#fff', stroke: C.green, sw: 3, r: 14 });
        D.t(64, 526, 'Process A', { f: 'sora', w: 700, fill: C.ink, size: 28 });
        D.t(64, 564, 'has the file open', { size: 23 });
        D.path('M260 478 L500 366', { stroke: C.green, sw: 8, arrow: 1 });
        D.flow('M500 366 L260 478', { r: 8, dur: 1.2, color: C.green });
        D.t(420, 464, 'reading', { size: 23, w: 600, fill: C.green });
        const b = D.el('g', { class: 'pf-fd' });
        D.rect(600, 480, 364, 110, { fill: '#fff', stroke: C.orange, sw: 3, r: 14 }, b);
        D.t(626, 526, 'Process B', { f: 'sora', w: 700, fill: C.ink, size: 28 }, b);
        D.t(626, 564, 'opens it afterwards', { size: 23 }, b);
        D.path('M660 478 C 660 300, 600 150, 462 118', { stroke: C.orange, sw: 3, dash: '7 8', arrow: 1 }, b);
        D.lines(676, 404, ['FileNotFoundError:', 'asks the daemon again'], { size: 21, w: 600, fill: C.deep, lh: 28 }, b);
        ctx.el.__yd = { nm, gone, b };
      });
    },
    step(ctx, s) {
      const { nm, gone, b } = ctx.el.__yd;
      nm.style.opacity = s >= 2 ? 0 : 1; gone.style.opacity = b.style.opacity = s >= 2 ? 1 : 0;
    },
  });

  /* ── many processes, one client ── */
  Deck.on('pattern', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-pt'), 1680, 600), DM = { x: 500, y: 60, w: 400, h: 350 };
        D.rect(0, 0, 1060, 448, { fill: C.soft, stroke: C.line, r: 20 });
        D.t(28, 42, 'One machine', { w: 600, fill: C.muted, size: 24 });
        ['Training · GPU 0', 'Training · GPU 1', 'Training · GPU 2', 'Data job', 'Notebook', 'Eval script'].forEach((n, k) => {
          const y = 64 + k * 62; D.rect(28, y, 270, 50, { stroke: C.line, r: 10 }); D.t(46, y + 33, n, { w: 600, fill: C.ink, size: 23 });
          const d = `M300 ${y + 25} C 390 ${y + 25}, 400 ${DM.y + 60 + k * 44}, ${DM.x - 4} ${DM.y + 60 + k * 44}`;
          D.path(d, { dash: '6 7', arrow: 1 }); D.flow(d, { r: 6, dur: 1.5, begin: -k * .26, color: C.blue });
        });
        D.t(400, 438, 'many requests', { a: 'middle', size: 21, w: 600, fill: C.muted });
        D.rect(DM.x, DM.y, DM.w, DM.h, { fill: C.blue, r: 18 });
        D.t(DM.x + 30, DM.y + 50, 'Patram-FS daemon', { f: 'sora', w: 700, fill: '#fff', size: 30 });
        D.t(DM.x + 30, DM.y + 84, 'one per machine', { fill: '#E4ECFA', size: 23 });
        ['merges identical requests', 'batches lookups', 'keeps one cache', 'limits load'].forEach((s, k) => { const y = DM.y + 110 + k * 56; D.rect(DM.x + 30, y, DM.w - 60, 44, { fill: 'rgba(255,255,255,.14)', r: 22 }); D.t(DM.x + DM.w / 2, y + 30, s, { a: 'middle', fill: '#fff', w: 500, size: 22 }); });
        [['Any object store', 'S3 · Google Cloud · Azure · on-premises', 40], ['Database', 'record lookups, one batched query', 174], ['Local drive + page cache', 'one copy of each shard, one budget', 308]].forEach(([a, b, y]) => {
          D.rect(1160, y, 520, 100, { stroke: C.line, r: 14 }); D.t(1186, y + 42, a, { w: 700, f: 'sora', fill: C.ink, size: 26 }); D.t(1186, y + 76, b, { size: 22 });
          const d = `M${DM.x + DM.w} ${DM.y + DM.h / 2} C 1010 ${DM.y + DM.h / 2}, 1060 ${y + 50}, 1156 ${y + 50}`;
          D.path(d, { stroke: C.orange, sw: 3.5, arrow: 1 }); D.flow(d, { r: 7, dur: 1.9, begin: -y / 200, color: C.orange });
        });
        D.t(1000, 438, 'one client', { a: 'middle', size: 21, w: 600, fill: C.deep });
        D.t(0, 498, 'Shards of any type', { w: 600, fill: C.muted, size: 24 });
        let x = 230;
        ['Images (TAR)', 'JSONL records', 'Text', 'Speech audio', 'Video frames', 'Your own format'].forEach((s, i) => {
          const w = 44 + s.length * 12.2; D.rect(x, 468, w, 46, { fill: i === 5 ? C.peach : '#fff', stroke: i === 5 ? C.orange : C.line, r: 23 }); D.t(x + w / 2, 498, s, { a: 'middle', fill: i === 5 ? C.deep : C.ink, size: 22, w: 500 });
          x += w + 14;
        });
        D.t(230, 556, 'The daemon fetches, caches, warms and evicts files. A reader function per type turns bytes into samples.', { size: 23 });
      });
    },
  });

  /* ── small icons for the three trade-offs ── */
  Deck.on('trade', {
    enter(ctx) {
      once(ctx, '__b', () => {
        { const D = canvas(ctx.q('#pf-to1'), 484, 210);
          D.rect(0, 10, 484, 190, { fill: C.ink, r: 14 });
          D.t(24, 62, '$ ls dataset/', { f: 'mono', fill: '#E4ECFA', size: 26 });
          D.path('M22 54 L250 54', { stroke: C.red, sw: 3 });
          D.t(24, 114, 'read_image(uri=...)', { f: 'mono', fill: '#FFC078', size: 26 });
          D.t(24, 162, 'read_annotation(uri=...)', { f: 'mono', fill: '#FFC078', size: 26 });
        }
        { const D = canvas(ctx.q('#pf-to2'), 484, 210);
          const strip = (y, label, col, vals) => {
            D.t(0, y - 12, label, { w: 600, size: 21, fill: col });
            for (let i = 0; i < 6; i++) D.rect(i * 81, y, 76, 44, { fill: C.free, r: 6 });
            const m = D.rect(0, y - 6, 20, 56, { fill: col, r: 4 });
            D.el('animate', { attributeName: 'x', values: vals, dur: '4.8s', repeatCount: 'indefinite', calcMode: 'discrete' }, m);
          };
          strip(38, 'Shard-aware order: stays cheap', C.green, '6;20;34;48;60;18;38;50;28;44;12;54');
          strip(144, 'Uniform jumps: each can be a download', C.red, '30;420;110;300;20;460;190;350;70;250;430;150');
        }
        { const D = canvas(ctx.q('#pf-to3'), 484, 210);
          D.rect(170, 6, 150, 76, { fill: C.free, stroke: C.red, r: 12 }); D.t(245, 52, 'Daemon', { a: 'middle', f: 'sora', w: 700, fill: C.faint, size: 24 });
          D.path('M178 14 L312 74', { stroke: C.red, sw: 4 }); D.path('M312 14 L178 74', { stroke: C.red, sw: 4 });
          D.rect(0, 130, 210, 72, { fill: C.peach, stroke: C.orange, r: 12 }); D.t(105, 175, 'Local shards', { a: 'middle', w: 600, fill: C.deep, size: 23 });
          D.rect(300, 130, 184, 72, { stroke: C.line, r: 12 }); D.t(392, 175, 'Process', { a: 'middle', w: 600, fill: C.ink, size: 23 });
          D.path('M212 166 L296 166', { stroke: C.green, sw: 6, arrow: 1 }); D.flow('M212 166 L296 166', { r: 6, dur: .9, color: C.green });
          D.t(36, 60, 'still reads', { size: 20, w: 600, fill: C.green });
          D.path('M60 72 L100 128', { stroke: C.green, sw: 2.5, arrow: 1 });
        }
      });
    },
  });
})();
