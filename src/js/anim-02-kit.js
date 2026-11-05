/* Drawing kit for the Patram-FS slides: SVG in stage pixels, pre-scheduled moving dots, and a player shortcut.
   Everything that plays as a story goes through Deck.player, and render(t) reads only t. */
(function () {
  const U = Deck.util, clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const C = {
    ink: '#0E1A3A', body: '#42506B', muted: '#5B6785', faint: '#6B7690', line: '#DCE2EE', card: '#FDFDFE', soft: '#F1F4FA', free: '#E9EEF6',
    blue: '#1F4FA8', mid: '#2A63C9', bpale: '#E4ECFA', orange: '#F28C28', deep: '#B85C0A', peach: '#FCE6CF',
    green: '#0E7C61', gpale: '#DDF1EA', red: '#C93C3C', rpale: '#FBE6E4', violet: '#6B4BB8', vpale: '#ECE6F8',
  };
  const FONT = { sans: "'IBM Plex Sans',Arial,sans-serif", mono: "'IBM Plex Mono',monospace", sora: 'Sora,sans-serif' };
  let uid = 0;

  function canvas(host, w, h) {
    host.innerHTML = '';
    const svg = U.svg('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, class: 'pf-svg' }, host);
    const defs = U.svg('defs', {}, svg), marks = {};
    const el = (tag, a, p) => U.svg(tag, a || {}, p || svg);
    const mark = color => {
      if (!marks[color]) {
        const id = 'pfm' + (++uid), m = el('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 5.5, markerHeight: 5.5, orient: 'auto-start-reverse' }, defs);
        el('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }, m); marks[color] = `url(#${id})`;
      }
      return marks[color];
    };
    const t = (x, y, s, o = {}, p) => {
      const a = { x, y, 'font-family': FONT[o.f || 'sans'], 'font-size': o.size || 22, 'font-weight': o.w || 400, fill: o.fill || C.body, 'text-anchor': o.a || 'start' };
      if (o.ls) a['letter-spacing'] = o.ls;
      const e = el('text', a, p); e.textContent = s; return e;
    };
    const lines = (x, y, arr, o = {}, p) => arr.map((s, i) => t(x, y + i * (o.lh || (o.size || 22) * 1.3), s, o, p));
    const rect = (x, y, w, h, o = {}, p) => {
      const a = { x, y, width: w, height: h, rx: o.r === undefined ? 12 : o.r, fill: o.fill || '#fff', stroke: o.stroke || 'none', 'stroke-width': o.sw || 2 };
      if (o.dash) a['stroke-dasharray'] = o.dash;
      return el('rect', a, p);
    };
    const path = (d, o = {}, p) => {
      const a = { d, fill: 'none', stroke: o.stroke || C.muted, 'stroke-width': o.sw || 2.5, 'stroke-linecap': 'round' };
      if (o.dash) a['stroke-dasharray'] = o.dash;
      if (o.arrow) a['marker-end'] = mark(o.stroke || C.muted);
      return el('path', a, p);
    };
    const cyl = (cx, y, w, h, label, p, o = {}) => {
      const g = el('g', {}, p), ry = w * .16;
      el('path', { d: `M${cx - w / 2} ${y} V${y + h} A${w / 2} ${ry} 0 0 0 ${cx + w / 2} ${y + h} V${y}`, fill: o.fill || C.bpale, stroke: C.blue, 'stroke-width': 2.5 }, g);
      el('ellipse', { cx, cy: y, rx: w / 2, ry, fill: '#fff', stroke: C.blue, 'stroke-width': 2.5 }, g);
      if (label) t(cx, y + h + ry + 30, label, { a: 'middle', w: 600, fill: C.ink, size: o.size || 24 }, g);
      return g;
    };
    /* an ambient dot on a loop (SMIL): only for small decorative motion, stories use the player */
    const flow = (d, o = {}, p) => {
      const c = el('circle', { r: o.r || 5, fill: o.color || C.green }, p);
      el('animateMotion', { path: d, dur: (o.dur || 2) + 's', begin: (o.begin || 0) + 's', repeatCount: 'indefinite' }, c);
      return c;
    };
    return { svg, el, t, lines, rect, path, cyl, flow, mark };
  }

  /* dots whose whole life is known in advance: e = { t0, dur, at(k) -> [x, y], color, r } */
  function dots(D, evs, parent) {
    const g = D.el('g', {}, parent);
    evs.forEach(e => { e.c = D.el('circle', { r: e.r || 6, fill: e.color || C.green, display: 'none' }, g); e.vis = false; });
    return t => {
      for (const e of evs) {
        const k = (t - e.t0) / e.dur;
        if (k < 0 || k >= 1) { if (e.vis) { e.c.setAttribute('display', 'none'); e.vis = false; } continue; }
        const [x, y] = e.at(k);
        if (!e.vis) { e.c.setAttribute('display', 'inline'); e.vis = true; }
        e.c.setAttribute('cx', x.toFixed(1)); e.c.setAttribute('cy', y.toFixed(1));
      }
    };
  }
  const along = p => { const L = p.getTotalLength(); return k => { const q = p.getPointAtLength(k * L); return [q.x, q.y]; }; };
  const poly = pts => k => { const n = pts.length - 1, f = Math.min(k * n, n - 1e-6), i = Math.floor(f), u = f - i; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u]; };
  const curve = (x0, y0, x1, y1, bow = -10) => k => { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2 + bow, a = (1 - k) * (1 - k), b = 2 * (1 - k) * k, c = k * k; return [a * x0 + b * mx + c * x1, a * y0 + b * my + c * y1]; };
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  /* a line that draws itself: k in 0..1, then settles to its final dash pattern */
  const grow = (line, k, finalDash) => {
    if (k <= 0) { line.setAttribute('opacity', 0); line.setAttribute('stroke-dashoffset', 0); return; }
    line.setAttribute('opacity', 1);
    if (!line.__L) line.__L = line.getTotalLength();
    if (k >= 1) { line.setAttribute('stroke-dasharray', finalDash || 'none'); line.setAttribute('stroke-dashoffset', 0); return; }
    line.setAttribute('stroke-dasharray', line.__L); line.setAttribute('stroke-dashoffset', line.__L * (1 - k));
  };
  const once = (ctx, key, fn) => { if (!ctx.el[key]) { ctx.el[key] = 1; fn(); } };   // enter runs on every visit; build the DOM only once
  const play = (ctx, sel, o) => { const host = ctx.q(sel); host.setAttribute('data-noclick', ''); return Deck.player(ctx, host, Object.assign({ mini: true, fmt: (t, d) => t >= d ? 'finished' : '' }, o)); };
  const log = (host, items) => {
    let cur = -1;
    return t => {
      let k = 0; for (let i = 0; i < items.length; i++) if (t >= items[i][0]) k = i;
      if (k === cur) return; cur = k;
      const [, tag, cl, html] = items[k];
      host.innerHTML = `<span class="pf-log-t ${cl}">${tag}</span><span>${html}</span>`;
    };
  };
  Deck.pf = { C, canvas, dots, along, poly, curve, seg, grow, once, play, log, clamp };
})();
