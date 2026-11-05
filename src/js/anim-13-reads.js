/* Part 4: reads and memory */
(function () {
  const U = Deck.util, { C, canvas, dots, along, poly, seg, once, play, log, clamp } = Deck.pf;

  /* ── the daemon is asked only on a miss ── */
  const T = { asks: 300, dl: 1500, bytes: 2100, have: 3000, reads: 3300, warm: 6500, end: 11000 };
  Deck.on('miss', {
    enter(ctx) {
      once(ctx, '__b', () => {
        const D = canvas(ctx.q('#pf-ms'), 1680, 530), R = U.rng(17);
        const P = [0, 1, 2, 3].map(k => ({ x: 0, y: 14 + k * 118, w: 270, h: 88 }));
        const DM = { x: 650, y: 14, w: 400, h: 124 }, K = { x: 650, y: 310, w: 400, h: 186 }, S = { cx: 1470, y: 170, w: 230, h: 180 };
        const ask = [], read = [];
        P.forEach((p, k) => {
          const cy = p.y + p.h / 2;
          ask.push(D.path(`M${p.x + p.w} ${cy} C 450 ${cy}, 500 ${DM.y + 30 + k * 22}, ${DM.x} ${DM.y + 30 + k * 22}`, { dash: '7 8', stroke: C.muted, sw: 2.5 }));
          read.push(D.path(`M${K.x} ${K.y + 50 + k * 28} C 500 ${K.y + 50 + k * 28}, 450 ${cy}, ${p.x + p.w} ${cy}`, { stroke: C.green, sw: 3, }));
        });
        P.forEach((p, k) => { D.rect(p.x, p.y, p.w, p.h, { stroke: C.line, r: 14 }); D.t(p.x + 30, p.y + 54, 'Process ' + (k + 1), { w: 600, fill: C.ink, size: 28 }); });
        const q = D.el('g');
        const dlp = D.path(`M${DM.x + DM.w} ${DM.y + 62} C 1220 ${DM.y + 62}, 1260 ${S.y + 20}, ${S.cx - S.w / 2} ${S.y + 20}`, { dash: '7 8', stroke: C.muted, sw: 2.5 }, q);
        const bytes = D.path(`M${S.cx - S.w / 2} ${S.y + 140} C 1240 ${S.y + 140}, 1240 ${K.y + 100}, ${K.x + K.w} ${K.y + 100}`, { stroke: C.orange, sw: 4 }, q);
        D.rect(DM.x, DM.y, DM.w, DM.h, { fill: C.blue, r: 16 }, q);
        D.t(DM.x + 30, DM.y + 54, 'Patram-FS daemon', { f: 'sora', w: 700, fill: '#fff', size: 30 }, q);
        D.t(DM.x + 30, DM.y + 94, 'ensure_shard, only on a miss', { fill: '#E4ECFA', size: 24 }, q);
        D.cyl(S.cx, S.y, S.w, S.h, 'Object store', q);
        D.t(1200, 86, 'download if missing', { size: 22, w: 600, fill: C.ink }, q);
        D.t(1110, 470, 'shard bytes, once', { size: 22, w: 600, fill: C.deep }, q);
        D.rect(K.x, K.y, K.w, K.h, { fill: C.peach, stroke: C.orange, r: 16 });
        D.t(K.x + 30, K.y + 46, 'Local disk', { w: 600, fill: C.deep, size: 26 });
        const shard = D.rect(K.x + 30, K.y + 74, 340, 84, { fill: C.mid, r: 10 }), sT = D.t(K.x + 200, K.y + 127, 'shard 42', { a: 'middle', w: 600, fill: '#fff', size: 28 });
        D.t(290, 524, 'Dashed: ensure_shard after FileNotFoundError', { size: 21, fill: C.muted });
        D.t(830, 524, 'Solid: open + pread, straight from the local disk', { size: 21, fill: C.green, w: 500 });
        const evs = [], asks = [];
        ask.forEach((p, k) => { const e = { t0: T.asks + k * 150, dur: 700, r: 8, color: C.ink, at: along(p) }; evs.push(e); asks.push(e); });
        evs.push({ t0: T.dl, dur: 600, r: 8, color: C.orange, at: along(dlp) }, { t0: T.bytes, dur: 900, r: 13, color: C.orange, at: along(bytes) });
        const reads = [], rAt = read.map(along);
        for (let t = T.reads; t < T.end - 700; t += t < T.warm ? 140 : 60) reads.push({ t0: t, dur: 700, r: 7, color: C.green, at: rAt[Math.floor(R() * 4)] });
        const draw = dots(D, evs.concat(reads));
        ctx.el.__ms = { draw, q, shard, sT, asks, reads };
      });
      const { draw, q, shard, sT, asks, reads } = ctx.el.__ms, aEl = ctx.q('#pf-ms-a'), rEl = ctx.q('#pf-ms-r');
      const lg = log(ctx.q('#pf-ms-l'), [
        [0, 'First read', 'o', 'The shard is not on this machine yet. Each process gets <code>FileNotFoundError</code> and asks the daemon.'],
        [T.have, 'Downloaded once', 'b', 'The daemon downloads the shard once. Every process retries the open and reads it.'],
        [T.warm, 'Every read after', 'g', 'The shard is on the disk. Processes open it and read directly, and the daemon is not involved.'],
      ]);
      ctx.__pl = play(ctx, '#pf-ms-pl', {
        dur: T.end,
        render: t => {
          draw(t); lg(t);
          const have = t >= T.have; shard.setAttribute('opacity', have ? 1 : 0); sT.setAttribute('opacity', have ? 1 : 0);
          q.setAttribute('opacity', t >= T.warm ? .28 : 1);
          aEl.textContent = asks.filter(e => e.t0 + e.dur <= t).length;
          let n = 0; for (const r of reads) { if (r.t0 + r.dur <= t) n++; else break; }
          rEl.textContent = n.toLocaleString('en-US');
        },
      });
    },
  });

  /* ── three ways to serve the same reads: one memory, three outcomes (blog demo, as a pure function of time) ── */
  const COLS = 24, CW = 24, CG = 4, X0 = 430, R0 = 72, RH = 60;
  function warmDemo(host, modes) {
    const D = canvas(host, 1160, 600), R = U.rng(31);
    const W = [0, 1, 2, 3].map(k => ({ x: 0, y: 30 + k * 124, w: 190, h: 92 }));
    W.forEach((w, k) => { D.rect(w.x, w.y, w.w, w.h, { stroke: C.line, r: 12 }); D.t(w.x + 24, w.y + 55, 'Worker ' + (k + 1), { w: 600, fill: C.ink, size: 26 }); });
    D.rect(260, 6, 880, 322, { fill: C.soft, stroke: C.line, r: 16 });
    D.t(284, 44, "The machine's memory", { w: 600, fill: C.muted, size: 23 });
    const mem = D.t(1118, 44, '', { a: 'end', w: 700, f: 'mono', fill: C.ink, size: 25 });
    const rows = [], rl = [];
    for (let r = 0; r < 4; r++) {
      const y = R0 + r * RH, row = [];
      rl.push(D.t(284, y + 32, '', { size: 21, w: 600, fill: C.body }));
      for (let c = 0; c < COLS; c++) { const x = X0 + c * (CW + CG); row.push({ x: x + CW / 2, y: y + 24, e: D.rect(x, y, CW, 48, { fill: C.free, r: 4 }) }); }
      rows.push(row);
    }
    const drive = D.rect(260, 372, 880, 166, { fill: C.peach, stroke: C.orange, r: 16 });
    D.t(284, 408, 'Local NVMe drive', { w: 600, fill: C.deep, size: 23 });
    D.rect(X0, 424, COLS * (CW + CG) - CG, 92, { fill: C.mid, r: 10 });
    D.t(X0 + (COLS * (CW + CG)) / 2, 480, 'data.jsonl · 1 GiB', { a: 'middle', w: 600, fill: '#fff', size: 28 });
    const wl = D.t(700, 358, 'warm_shard: the whole file, loaded once', { a: 'middle', w: 700, fill: C.green, size: 22 });
    const cnt = D.t(0, 582, '', { w: 600, size: 22, fill: C.ink });
    [[C.rpale, C.red, "a worker's own copy"], [C.peach, C.orange, 'a piece of the file'], [C.gpale, C.green, 'one shared copy']].forEach(([f, st, s], i) => { const x = 300 + i * 290; D.rect(x, 564, 22, 24, { fill: f, stroke: st, r: 4 }); D.t(x + 32, 584, s, { size: 21 }); });
    const fw = wi => [W[wi].x + W[wi].w, W[wi].y + W[wi].h / 2];
    const CELL = { copy: [C.rpale, C.red], part: [C.peach, C.orange], in: [C.gpale, C.green] };
    const setCell = (c, kind) => { if (c.kind === kind) return; c.kind = kind; const v = CELL[kind]; c.e.setAttribute('fill', v ? v[0] : C.free); c.e.setAttribute('stroke', v ? v[1] : 'none'); };
    const S = {};
    if (modes.includes(1)) {
      const evs = []; for (let t = 2500; t < 8600; t += 60) { const wi = Math.floor(R() * 4), c = rows[wi][Math.floor(R() * COLS)], f = fw(wi); evs.push({ t0: t, dur: 420, r: 6, color: C.green, at: poly([[c.x, c.y], [230, f[1]], f]) }); }
      S[1] = { dur: 9000, evs, draw: dots(D, evs) };
    }
    if (modes.includes(2)) {
      const evs = []; for (let t = 200; t < 8400; t += 420) { const wi = Math.floor(R() * 4), col = Math.floor(R() * COLS), c = rows[0][col], f = fw(wi); evs.push({ t0: t, dur: 1500, r: 8, color: C.orange, col, at: poly([[c.x, 470], [c.x, c.y], [230, f[1]], f]) }); }
      S[2] = { dur: 9400, evs, draw: dots(D, evs) };
    }
    if (modes.includes(3)) {
      const evs = []; for (let t = 1000; t < 7000; t += 60) { const wi = Math.floor(R() * 4), c = rows[0][Math.floor(R() * COLS)], f = fw(wi); evs.push({ t0: t, dur: 420, r: 6, color: C.green, at: poly([[c.x, c.y], [230, f[1]], f]) }); }
      S[3] = { dur: 7400, evs, draw: dots(D, evs) };
    }
    return {
      dur: m => S[m].dur,
      render(m, t) {
        Object.keys(S).forEach(k => { if (+k !== m) S[k].draw(-1); });
        const s = S[m]; s.draw(t);
        let filled = 0;
        rows.forEach((row, r) => row.forEach((c, i) => {
          let kind = '';
          if (m === 1) { if (t >= (r + i / COLS) * 600) kind = 'copy'; }
          else if (m === 3) { if (r === 0 && t >= 100 + i / COLS * 800) kind = 'in'; }
          else if (r === 0 && s.evs.some(e => e.col === i && t >= e.t0 + e.dur * .34)) kind = 'part';
          setCell(c, kind); if (kind) filled++;
        }));
        const gib = filled / COLS;
        mem.textContent = 'memory used: ' + (gib < 1 && gib > 0 ? gib.toFixed(1) : Math.round(gib * 10) / 10) + ' GiB';
        mem.setAttribute('fill', m === 1 ? C.red : C.green);
        rl.forEach((l, r) => { l.textContent = m === 1 ? (t >= r * 600 ? 'worker ' + (r + 1) : '') : r ? '' : m === 2 ? 'pieces read' : 'shared copy'; });
        wl.setAttribute('opacity', m === 3 ? 1 : 0);
        drive.setAttribute('stroke-width', m === 2 ? 5 : 2);
        let n = 0; for (const e of s.evs) { if (e.t0 + e.dur <= t) n++; else break; }
        cnt.textContent = 'records: ' + n.toLocaleString('en-US');
      },
    };
  }
  Deck.on('ann', {
    enter(ctx) { once(ctx, '__b', () => { ctx.el.__wd = warmDemo(ctx.q('#pf-an'), [1, 2]); }); ctx.__mode = 1; },
    step(ctx, s, p) {
      const wd = ctx.el.__wd; ctx.__mode = s >= 1 ? 2 : 1;
      if (!ctx.__pl) ctx.__pl = play(ctx, '#pf-an-pl', { dur: wd.dur(ctx.__mode), render: t => wd.render(ctx.__mode, t) });
      else if (s !== p) ctx.__pl.restart(wd.dur(ctx.__mode));
    },
  });
  Deck.on('warm', {
    enter(ctx) {
      once(ctx, '__b', () => { ctx.el.__wd = warmDemo(ctx.q('#pf-wm'), [3]); });
      const wd = ctx.el.__wd;
      ctx.__pl = play(ctx, '#pf-wm-pl', { dur: wd.dur(3), render: t => wd.render(3, t) });
    },
  });
})();
