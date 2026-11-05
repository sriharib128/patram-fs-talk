/* Deck.player: the pause / replay / scrub bar for anything that plays by itself. render(t) must be a pure function of time. */
(function () {
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  /* ───────── player: ▶/❚❚, replay and a scrubber, for anything that runs on its own ─────────
     o = { dur (ms), label, fmt(t, dur), render(t), auto }.  render(t) must draw the whole state for time t,
     so the slider can jump anywhere. Mounted into `host`; everything dies with the slide. */
  Deck.player = function (ctx, host, o) {
    let dur = o.dur; const fmt = o.fmt || (t => (t / 1000).toFixed(1) + ' s');
    host.classList.add('pl', 'mini');                 // always the quiet bar: it should never compete with the slide
    host.innerHTML = '<button type="button" class="pl-b main" tabindex="-1"></button><button type="button" class="pl-b" tabindex="-1">↻ Replay</button><span class="pl-l"></span><input class="pl-s" type="range" min="0" max="1000" step="1" value="0" tabindex="-1"><output class="pl-o"></output>';
    const [bp, br] = host.querySelectorAll('button'), sl = host.querySelector('input'), out = host.querySelector('output');
    host.querySelector('.pl-l').textContent = o.label || 'Time';
    let t = 0, playing = false;
    const draw = () => {
      sl.value = Math.round(t / dur * 1000); out.textContent = fmt(t, dur);
      bp.textContent = playing ? '❚❚  Pause' : (t >= dur ? '▶  Play again' : '▶  Play');
      o.render(t);
    };
    const ctl = {
      get t() { return t; }, get playing() { return playing; },
      play() { if (t >= dur) t = 0; playing = true; draw(); },
      pause() { playing = false; draw(); },
      replay() { t = 0; playing = true; draw(); },
      seek(v) { t = clamp(v, 0, dur); draw(); },
      restart(d) { dur = d; t = 0; playing = true; draw(); },   // same bar, a new animation of length d
    };
    bp.onclick = () => { playing ? ctl.pause() : ctl.play(); bp.blur(); };
    br.onclick = () => { ctl.replay(); br.blur(); };
    sl.oninput = () => { playing = false; t = sl.value / 1000 * dur; draw(); };
    sl.onchange = () => sl.blur();                      // hand the arrow keys back to the deck
    ctx.raf((_, dt) => { if (!playing) return; t = clamp(t + Math.max(0, dt), 0, dur); if (t >= dur) playing = false; draw(); });
    draw(); if (o.auto !== false) ctl.play();
    return ctl;
  };
})();
