/* ───────────── Deck engine ─────────────
   Slides are <section class="slide">. Elements with data-s="n" appear when the step reaches n; data-h="n" hides at n.
   Per-slide animation code registers with Deck.on('slide-id', {enter, step, leave}).
   Keys: → space ↓ next · ← ↑ prev · F fullscreen · O overview · P presenter window · T clock · K skip optional · B blackout · R reset clock */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const stage = $('#stage');
  const slides = $$('.slide');
  const N = slides.length;
  const mods = {};
  const state = { i: -1, step: 0, skipOpt: false, startTs: null };
  const isPresenter = /[?&]presenter/.test(location.search);
  const chan = 'BroadcastChannel' in window ? new BroadcastChannel('patram-fs-talk') : null;
  if (isPresenter) document.body.classList.add('presenter');

  slides.forEach((el, i) => {
    el.dataset.idx = i;
    const nums = $$('[data-s]', el).map(e => +e.dataset.s);
    el.__steps = el.dataset.steps ? +el.dataset.steps : (nums.length ? Math.max(...nums) : 0);
  });
  const title = el => el.dataset.title || ($('h1,h2,.dv-h', el) || {}).textContent || el.id;

  /* ── per-slide context: everything scheduled through it dies when the slide is left ── */
  function makeCtx(el) {
    const timers = new Set(), rafs = new Set();
    const ctx = {
      el, step: 0,
      q: s => el.querySelector(s), qa: s => [...el.querySelectorAll(s)],
      after(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; },
      every(fn, ms) { const id = setInterval(fn, ms); timers.add(id); return id; },
      raf(fn) {
        let alive = true, last = performance.now(), t0 = last;
        const loop = now => { if (!alive) return; fn(now - t0, now - last); last = now; id = requestAnimationFrame(loop); };
        let id = requestAnimationFrame(loop);
        const stop = () => { alive = false; cancelAnimationFrame(id); rafs.delete(stop); };
        rafs.add(stop); return stop;
      },
      cancel() { timers.forEach(t => { clearTimeout(t); clearInterval(t); }); timers.clear(); [...rafs].forEach(s => s()); },
    };
    return ctx;
  }

  function applySteps(el, step) {
    el.dataset.st = step;                               // lets CSS key states off the current step
    $$('[data-s]', el).forEach(e => e.classList.toggle('on', step >= +e.dataset.s));
    $$('[data-h]', el).forEach(e => e.classList.toggle('off', step >= +e.dataset.h));
  }

  function leave(el) {
    const m = mods[el.id];
    if (m && m.leave && el.__ctx) { try { m.leave(el.__ctx); } catch (e) { console.error(e); } }
    if (el.__ctx) el.__ctx.cancel();
    el.__ctx = null;
    el.classList.remove('active'); el.classList.add('leaving');
    setTimeout(() => el.classList.remove('leaving'), 520);
  }

  function enter(el, step) {
    el.classList.add('instant'); applySteps(el, step); void el.offsetWidth; el.classList.remove('instant');
    el.classList.remove('leaving'); el.classList.add('active');
    const ctx = el.__ctx = makeCtx(el); ctx.step = step;
    const m = mods[el.id];
    if (m) {
      try { m.enter && m.enter(ctx); } catch (e) { console.error(e); }
      try { m.step && m.step(ctx, step, -1); } catch (e) { console.error(e); }
    }
  }

  function setStep(st, silent) {
    const el = slides[state.i];
    st = clamp(st, 0, el.__steps);
    const prev = state.step;
    if (st === prev) return;
    state.step = st;
    applySteps(el, st);
    const m = mods[el.id];
    if (el.__ctx) el.__ctx.step = st;
    if (m && m.step && el.__ctx) { try { m.step(el.__ctx, st, prev); } catch (e) { console.error(e); } }
    chrome(); if (!silent) broadcast();
  }

  function go(i, st, silent) {
    i = clamp(i, 0, N - 1);
    if (i === state.i) { setStep(st || 0, silent); return; }
    if (state.i >= 0) leave(slides[state.i]);
    state.i = i; state.step = clamp(st || 0, 0, slides[i].__steps);
    enter(slides[i], state.step);
    chrome(); if (!silent) broadcast();
    try { history.replaceState(null, '', location.pathname + location.search + '#' + (i + 1)); } catch (e) {}
  }

  const deep = i => slides[i].hasAttribute('data-deep');
  /* data-deep slides are a side trip: skipped by next/prev, reached only from a [data-goto] button, left by next from their last slide */
  const visible = i => !(state.skipOpt && slides[i].hasAttribute('data-optional')) && !(deep(i) && !(state.i >= 0 && deep(state.i)));
  function next() {
    if (state.startTs === null) state.startTs = Date.now();
    const el = slides[state.i];
    if (state.step < el.__steps) return setStep(state.step + 1);
    let j = state.i + 1; while (j < N && !visible(j)) j++;
    if (j < N) go(j, 0);
  }
  function prev() {
    if (state.step > 0) return setStep(state.step - 1);
    let j = state.i - 1; while (j >= 0 && !visible(j)) j--;
    if (j >= 0) go(j, slides[j].__steps);
  }

  /* ── chrome: counter, progress, step dots, presenter panel ── */
  const counter = $('#counter'), bar = $('#bar'), hud = $('#hud');
  /* slide number with < > buttons; double-click the number to type a slide to jump to */
  counter.innerHTML = '<button type="button" class="ctr-b" data-d="-1" aria-label="Previous slide">&lt;</button><span class="ctr-n" title="Double-click to jump to a slide"></span><button type="button" class="ctr-b" data-d="1" aria-label="Next slide">&gt;</button>';
  const ctrN = counter.querySelector('.ctr-n');
  counter.addEventListener('click', e => {
    const b = e.target.closest('.ctr-b'); if (!b) return;
    e.stopPropagation(); go(Math.max(0, Math.min(N - 1, state.i + +b.dataset.d)), 0); b.blur();
  });
  ctrN.addEventListener('dblclick', e => {
    e.stopPropagation(); if (ctrN.querySelector('input')) return;
    ctrN.innerHTML = '<input class="ctr-in" type="text" inputmode="numeric" aria-label="Go to slide"> / ' + N;
    const inp = ctrN.querySelector('input'); inp.value = state.i + 1; inp.focus(); inp.select();
    let done = false;
    const close = jump => {
      if (done) return; done = true; counter.__closed = Date.now();
      const n = parseInt(inp.value, 10);
      if (jump && n >= 1 && n <= N) go(n - 1, 0);
      chrome();
    };
    inp.addEventListener('keydown', k => { if (k.key === 'Enter') { k.preventDefault(); close(true); } else if (k.key === 'Escape') { k.preventDefault(); close(false); } });
    inp.addEventListener('blur', () => close(false));
  });
  function chrome() {
    const el = slides[state.i];
    ctrN.textContent = (state.i + 1) + ' / ' + N;
    bar.style.width = ((state.i + 1) / N * 100) + '%';
    stage.classList.toggle('dark-ui', el.classList.contains('dark'));
    for (const b of [$('#brandtl')]) if (b) b.classList.toggle('hide', el.hasAttribute('data-nobrand'));   // the title and thank-you slides carry the logo themselves
    const acts = $('#acts');
    if (acts) {
      if (!acts.children.length) { const sp = document.createElement('span'); sp.dataset.part = 'title'; sp.className = 'ttl'; sp.title = 'Go to the title slide'; sp.innerHTML = '<b>Title</b>'; acts.appendChild(sp); } if (acts.children.length === 1) ['The problem', 'Shards', 'The daemon', 'Reads and memory', 'In production'].forEach((n, k) => { const sp = document.createElement('span'); sp.dataset.part = k + 1; sp.title = 'Go to part ' + (k + 1) + ': ' + n; sp.innerHTML = '<b>' + (k + 1) + '</b><u>' + n + '</u>'; acts.appendChild(sp); });
      const m = /^(\d) ·/.exec(el.dataset.section || ''), n = m ? +m[1] : -1;   // the number in data-section picks the part
      acts.classList.toggle('hide', state.i === 0); [...acts.children].forEach(c => c.classList.toggle('on', c.dataset.part === String(n)));
    }
    renderPanel();
  }

  /* ── timing ── */
  const mins = el => +el.dataset.time || 0;
  function targetEnd(i) { let t = 0; for (let k = 0; k <= i; k++) if (visible(k)) t += mins(slides[k]); return t; }
  const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function elapsed() { return state.startTs ? (Date.now() - state.startTs) / 1000 : 0; }

  /* ── presenter panel ── */
  const panel = $('#presenter-panel');
  function renderPanel() {
    if (!isPresenter || !panel) return;
    const el = slides[state.i];
    let j = state.i + 1; while (j < N && !visible(j)) j++;
    const nxt = j < N ? slides[j] : null;
    const notes = $('aside.notes', el);
    const body = notes ? notes.innerHTML : '<p><i>No notes for this slide.</i></p>';
    $('.notes-box', panel).innerHTML = body;
    $$('.notes-box p[data-step]', panel).forEach(p => {
      const s = +p.dataset.step; p.style.opacity = s === state.step ? 1 : (s < state.step ? .5 : .35);
      if (s === state.step) p.style.borderLeft = '3px solid #F28C28'; p.style.paddingLeft = '10px';
    });
    $('.meta', panel).innerHTML = `slide ${state.i + 1}/${N} · step ${state.step}/${el.__steps}${el.hasAttribute('data-optional') ? ' · <span style="color:#FFC078">OPTIONAL</span>' : ''}<br>this slide: ~${mins(el)} min · target at end: ${fmt(targetEnd(state.i) * 60)}`;
    $('.next', panel).innerHTML = nxt ? 'Next: <b>' + title(nxt).replace(/\s+/g, ' ').trim() + '</b>' : 'Last slide';
    $('[data-act=skip]', panel).textContent = state.skipOpt ? 'Optional slides: SKIPPED (K)' : 'Optional slides: shown (K)';
  }
  function tickClock() {
    const e = elapsed();
    if (hud) { hud.textContent = fmt(e) + ' / ' + fmt(targetEnd(N - 1) * 60); }
    if (isPresenter && panel) {
      const c = $('.clock', panel); c.textContent = fmt(e);
      const slack = targetEnd(state.i) * 60 - e;   // positive = ahead of the plan at the end of this slide
      c.className = 'clock ' + (slack > 20 ? 'ok' : slack > -45 ? 'warn' : 'bad');
      $('.pace', panel).textContent = state.startTs ? (slack >= 0 ? `${fmt(slack)} ahead of plan` : `${fmt(-slack)} behind plan`) : 'clock starts on slide 2';
    }
  }
  setInterval(tickClock, 500);

  /* ── sync between audience and presenter windows ── */
  function broadcast() { chan && chan.postMessage({ t: 'nav', i: state.i, step: state.step, skip: state.skipOpt, start: state.startTs }); }
  if (chan) chan.onmessage = e => {
    const m = e.data; if (!m || m.t !== 'nav') return;
    state.skipOpt = m.skip; state.startTs = m.start;
    go(m.i, m.step, true);
    if (m.i === state.i) { setStep(m.step, true); }
  };

  /* ── input ── */
  function fullscreen() { const d = document; if (!d.fullscreenElement) d.documentElement.requestFullscreen && d.documentElement.requestFullscreen(); else d.exitFullscreen(); }
  function overview(show) {
    const o = $('#overview');
    if (show === undefined) show = !o.classList.contains('show');
    if (show) {
      let h = '', sec = null;
      slides.forEach((el, i) => {
        const s = el.dataset.section || '';
        if (s !== sec) { sec = s; h += (h ? '</div>' : '') + `<h4>${s}</h4><div class="grid">`; }
        h += `<div class="cell${i === state.i ? ' cur' : ''}${el.hasAttribute('data-optional') ? ' opt' : ''}" data-i="${i}"><small>${String(i + 1).padStart(2, '0')} · ~${mins(el)} min</small>${title(el).replace(/\s+/g, ' ').trim()}</div>`;
      });
      o.innerHTML = h + '</div>';
    }
    o.classList.toggle('show', show);
  }
  $('#overview').addEventListener('click', e => { const c = e.target.closest('.cell'); if (c) { go(+c.dataset.i, 0); overview(false); } else overview(false); });

  let black = null;
  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input,textarea')) return;
    const k = e.key;
    if (['ArrowRight', 'ArrowDown', ' ', 'PageDown', 'Enter'].includes(k)) { e.preventDefault(); next(); }
    else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'].includes(k)) { e.preventDefault(); prev(); }
    else if (k === 'Home') go(0, 0);
    else if (k === 'End') go(N - 1, slides[N - 1].__steps);
    else if (k === 'f' || k === 'F') fullscreen();
    else if (k === 'o' || k === 'O' || k === 'Escape') overview(k === 'Escape' ? false : undefined);
    else if (k === 't' || k === 'T') hud.classList.toggle('show');
    else if (k === 'k' || k === 'K') { state.skipOpt = !state.skipOpt; chrome(); broadcast(); }
    else if (k === 'r' || k === 'R') { state.startTs = Date.now(); broadcast(); }
    else if (k === 'p' || k === 'P') window.open(location.pathname + '?presenter#' + (state.i + 1), 'patram-fs-presenter', 'width=1500,height=900');
    else if (k === 'b' || k === 'B') {
      if (!black) { black = document.createElement('div'); black.style.cssText = 'position:fixed;inset:0;background:#000;z-index:999'; document.body.appendChild(black); }
      else { black.remove(); black = null; }
    }
  });
  /* the part tracker, top right: click a part to jump to its first slide */
  $('#acts') && $('#acts').addEventListener('click', e => {
    const sp = e.target.closest('[data-part]'); if (!sp) return;
    e.stopPropagation();
    if (sp.dataset.part === 'title') { go(0, 0); return; }
    const i = slides.findIndex(el => (el.dataset.section || '').startsWith(sp.dataset.part + ' ·'));
    if (i >= 0) go(i, 0);
  });
  stage.addEventListener('click', e => {
    const gt = e.target.closest('[data-goto]');
    if (gt) { e.stopPropagation(); const i = slides.findIndex(x => x.id === gt.dataset.goto); if (i >= 0) go(i, 0); gt.blur(); return; }
    if (e.target.closest('input,button,a,[data-noclick],#acts,#counter')) return;
    if (Date.now() - (counter.__closed || 0) < 400) return;   // the click that dismissed the jump box is not a navigation
    const r = stage.getBoundingClientRect();
    (e.clientX - r.left) < r.width * 0.28 ? prev() : next();
  });
  let tx = null;
  document.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', e => { if (tx === null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 60) dx < 0 ? next() : prev(); });
  if (panel) panel.addEventListener('click', e => {
    const a = e.target.closest('[data-act]'); if (!a) return;
    ({ prev, next, skip() { state.skipOpt = !state.skipOpt; chrome(); broadcast(); }, reset() { state.startTs = Date.now(); broadcast(); }, audience() { window.open(location.pathname + '#' + (state.i + 1), 'patram-fs-audience'); } })[a.dataset.act]();
  });

  function fit() {
    const w = isPresenter ? innerWidth * 0.62 : innerWidth, h = isPresenter ? innerHeight - 20 : innerHeight;
    stage.style.transform = 'scale(' + Math.min(w / 1920, h / 1080) + ')';
  }
  addEventListener('resize', fit); fit();

  /* ── helpers for slide modules ── */
  const ease = { out: t => 1 - Math.pow(1 - t, 3), inout: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 };
  const util = {
    ease, clamp,
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    /** count a number up inside el; fmt(v) → string */
    countUp(ctx, el, to, ms = 1600, fmtFn) {
      fmtFn = fmtFn || (v => Math.round(v).toLocaleString('en-US'));
      const t0 = performance.now(); el.textContent = fmtFn(0);
      const stop = ctx.raf(() => { const t = clamp((performance.now() - t0) / ms, 0, 1); el.textContent = fmtFn(to * ease.out(t)); if (t >= 1) stop(); });
      return stop;
    },
    /** type text char by char; html allowed via array of [text,className] tokens */
    type(ctx, el, text, cps = 40, done) {
      el.textContent = ''; let i = 0;
      const id = ctx.every(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) { clearInterval(id); done && done(); } }, 1000 / cps);
    },
    svg(tag, attrs = {}, parent) {
      const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      parent && parent.appendChild(e); return e;
    },
    html(tag, attrs = {}, parent) {
      const e = document.createElement(tag);
      for (const k in attrs) k === 'text' ? (e.textContent = attrs[k]) : k === 'html' ? (e.innerHTML = attrs[k]) : e.setAttribute(k, attrs[k]);
      parent && parent.appendChild(e); return e;
    },
  };

  window.Deck = {
    on(id, mod) { mods[id] = mod; },
    go, next, prev, util, slides, state,
    start() {
      const h = parseInt((location.hash || '').slice(1), 10);
      go(isNaN(h) ? 0 : clamp(h - 1, 0, N - 1), 0, true);
      tickClock();
    },
  };
})();
