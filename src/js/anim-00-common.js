/* shared helpers for slide animations */
(function () {
  const U = Deck.util;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /** tiny python-ish syntax colouring, applied to whatever prefix has been typed so far */
  U.hl = function (code) {
    let h = esc(code);
    h = h.replace(/(#[^\n]*)/g, '<span class="c">$1</span>');
    h = h.replace(/(&quot;[^&]*?&quot;|"[^"\n]*"?|'[^'\n]*'?)/g, m => /span/.test(m) ? m : `<span class="s">${m}</span>`);
    h = h.replace(/\b(for|in|if|def|return|class|import|from|raise|not|else|with|as|and|or|None|True|False|lambda)\b(?![^<]*<\/span>)/g, '<span class="k">$1</span>');
    h = h.replace(/\b([a-zA-Z_]\w*)(?=\()(?![^<]*<\/span>)/g, '<span class="f">$1</span>');
    return h;
  };
  /** type code into el with highlighting and a blinking cursor */
  U.typeCode = function (ctx, el, code, cps = 38, done) {
    let i = 0; el.innerHTML = '<span class="cursor"></span>';
    const id = ctx.every(() => {
      i = Math.min(code.length, i + (code[i] === ' ' ? 2 : 1));
      el.innerHTML = U.hl(code.slice(0, i)) + '<span class="cursor"></span>';
      if (i >= code.length) { clearInterval(id); done && done(); }
    }, 1000 / cps);
  };
  /** run fn(i) for each i with a stagger */
  U.stagger = (ctx, n, ms, fn, delay = 0) => { for (let i = 0; i < n; i++) ctx.after(() => fn(i), delay + i * ms); };
  /** seeded random so simulations look the same every run */
  U.rng = function (seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
})();
