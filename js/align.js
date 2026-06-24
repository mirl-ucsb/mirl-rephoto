/* align.js — shared state + helpers, the two-panel control-point interface,
   and the layered compare view (curtain / onion skin / blink). */

/* ---------- helpers ---------- */
MR.util = {
  h(tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k]; if (v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
    for (const c of kids) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(c)); }
    return e;
  },
  toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(MR._tt); MR._tt = setTimeout(() => t.classList.remove('show'), 2200); },
  download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1500); },
  downloadText(name, text, type = 'text/plain') { this.download(name, new Blob([text], { type })); },
  fitRect(natW, natH, boxW, boxH) {
    const s = Math.min(boxW / natW, boxH / natH);
    return { s, w: natW * s, h: natH * s, ox: (boxW - natW * s) / 2, oy: (boxH - natH * s) / 2 };
  },
};

MR.state = {
  mode: 'align',
  then: { img: null, name: '', natW: 0, natH: 0, _fit: null },
  now: { img: null, name: '', natW: 0, natH: 0, _fit: null },
  thenPts: [], nowPts: [], nextSide: 'then',
  H: null, rms: null,
  present: { mode: 'curtain', split: 0.5, opacity: 0.5, blinkMs: 900, _blink: null },
  rectify: { side: 'now', corners: [], aspectW: 3, aspectH: 2, realW: null, unit: 'm', H: null, view: 'corners', measure: false, mPts: [], _fit: null },
};

MR.Align = (function () {
  const S = MR.state;

  function stageClear() {
    const stage = document.getElementById('stage');
    Array.from(stage.children).forEach(c => { if (c.id !== 'rcurtain') c.remove(); });
  }

  /* ---------- align: two point panels ---------- */
  function emptyBox(side) {
    return MR.util.h('div', { class: 'empty' },
      MR.util.h('div', { class: 'big' }, '⌖'),
      MR.util.h('div', null, (side === 'then' ? 'The historical photograph' : 'The current photograph')),
      MR.util.h('button', { class: 'btn', onclick: () => MR.App.loadDialog(side) }, 'Load image'),
      MR.util.h('div', { class: 'hint' }, 'or drop a file here'));
  }
  function panel(side) {
    const st = S[side];
    const img = MR.util.h('img', { id: 'img-' + side, draggable: 'false' });
    const dots = MR.util.h('div', { id: 'dots-' + side, style: { position: 'absolute', inset: '0' } });
    const head = MR.util.h('div', { class: 'panel-head' },
      MR.util.h('span', { class: 'swatch', style: { background: side === 'then' ? 'var(--then)' : 'var(--now)' } }),
      MR.util.h('span', null, (side === 'then' ? 'THEN' : 'NOW') + (st.name ? '  ·  ' + st.name : '')),
      MR.util.h('span', { style: { flex: '1' } }),
      st.img ? MR.util.h('button', { class: 'btn', style: { pointerEvents: 'auto', padding: '2px 8px', fontSize: '11px' }, onclick: () => MR.App.loadDialog(side) }, 'Replace') : null);
    const p = MR.util.h('div', { class: 'imgpanel', id: 'panel-' + side }, head, img, dots);
    if (st.img) img.src = st.img.src; else p.append(emptyBox(side));
    p.addEventListener('click', e => onPanelClick(side, e, p));
    p.addEventListener('dragover', e => { e.preventDefault(); p.classList.add('drop'); });
    p.addEventListener('dragleave', () => p.classList.remove('drop'));
    p.addEventListener('drop', e => { e.preventDefault(); p.classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) MR.App.loadImage(side, { file: f }); });
    return p;
  }
  function buildAlign() {
    const stage = document.getElementById('stage');
    stageClear();
    stage.classList.remove('curtain-on', 'measure');
    const pairs = MR.util.h('div', { class: 'pairs', id: 'pairs' }, panel('then'), panel('now'));
    stage.insertBefore(pairs, document.getElementById('rcurtain'));
    refitAlign();
  }
  function refitAlign() {
    ['then', 'now'].forEach(side => {
      const st = S[side]; const img = document.getElementById('img-' + side); const p = document.getElementById('panel-' + side);
      if (!st.img || !img || !p) return;
      const fit = MR.util.fitRect(st.natW, st.natH, p.clientWidth, p.clientHeight);
      st._fit = fit;
      Object.assign(img.style, { left: fit.ox + 'px', top: fit.oy + 'px', width: fit.w + 'px', height: fit.h + 'px' });
    });
    renderAllDots();
    updateCursor();
  }
  function dot(side, idx, x, y) {
    const fit = S[side]._fit;
    const d = MR.util.h('div', { class: 'dot ' + side, style: { left: (fit.ox + x * fit.s) + 'px', top: (fit.oy + y * fit.s) + 'px' } },
      MR.util.h('span', null, String(idx + 1)));
    d.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); startDrag(side, idx, d); });
    return d;
  }
  function renderDots(side) {
    const box = document.getElementById('dots-' + side); if (!box || !S[side]._fit) return;
    box.innerHTML = '';
    S[side + 'Pts'].forEach((pt, i) => box.append(dot(side, i, pt[0], pt[1])));
  }
  function renderAllDots() { renderDots('then'); renderDots('now'); }

  function startDrag(side, idx, d) {
    const p = document.getElementById('panel-' + side); let moved = false;
    function mv(e) {
      moved = true; const r = p.getBoundingClientRect(); const fit = S[side]._fit;
      let x = (e.clientX - r.left - fit.ox) / fit.s, y = (e.clientY - r.top - fit.oy) / fit.s;
      x = Math.max(0, Math.min(S[side].natW, x)); y = Math.max(0, Math.min(S[side].natH, y));
      S[side + 'Pts'][idx] = [x, y];
      d.style.left = (fit.ox + x * fit.s) + 'px'; d.style.top = (fit.oy + y * fit.s) + 'px';
      computeH(); MR.App.updateQuality();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); if (moved) MR.App.renderSidebar(); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }

  function onPanelClick(side, e, p) {
    if (S.mode !== 'align' || !S[side].img) return;
    if (e.target.closest('.dot')) return;            // a click that ends a drag
    if (side !== S.nextSide) { MR.util.toast('Place point ' + (Math.min(S.thenPts.length, S.nowPts.length) + 1) + ' on the ' + S.nextSide.toUpperCase() + ' image next.'); return; }
    const fit = S[side]._fit; const r = p.getBoundingClientRect();
    const x = (e.clientX - r.left - fit.ox) / fit.s, y = (e.clientY - r.top - fit.oy) / fit.s;
    if (x < 0 || y < 0 || x > S[side].natW || y > S[side].natH) return;
    S[side + 'Pts'].push([x, y]);
    S.nextSide = side === 'then' ? 'now' : 'then';
    computeH(); renderDots(side); updateCursor();
    MR.App.renderSidebar(); MR.App.updateCompareAvailability();
  }
  function updateCursor() {
    ['then', 'now'].forEach(side => {
      const p = document.getElementById('panel-' + side); if (!p) return;
      p.classList.toggle('click', S.mode === 'align' && !!S[side].img && S.nextSide === side);
    });
  }
  function deletePair(i) {
    if (i < S.thenPts.length) S.thenPts.splice(i, 1);
    if (i < S.nowPts.length) S.nowPts.splice(i, 1);
    S.nextSide = S.thenPts.length <= S.nowPts.length ? 'then' : 'now';
    computeH(); renderAllDots(); updateCursor();
    MR.App.renderSidebar(); MR.App.updateCompareAvailability();
  }
  function clearPoints() {
    S.thenPts = []; S.nowPts = []; S.nextSide = 'then'; S.H = null; S.rms = null;
    renderAllDots(); updateCursor(); MR.App.renderSidebar(); MR.App.updateCompareAvailability();
  }
  function computeH() {
    const n = Math.min(S.thenPts.length, S.nowPts.length);
    if (n >= 4) { const src = S.thenPts.slice(0, n), dst = S.nowPts.slice(0, n); S.H = MR.Homography.compute(src, dst); S.rms = S.H ? MR.Homography.residualRMS(S.H, src, dst) : null; }
    else { S.H = null; S.rms = null; }
  }

  /* ---------- compare: warped then over now ---------- */
  function buildCompare() {
    if (!S.H || !S.then.img || !S.now.img) { MR.App.setMode('align'); return; }
    const stage = document.getElementById('stage'); stageClear(); stage.classList.remove('measure');
    const mk = (side, extra) => {
      const layer = MR.util.h('div', { class: 'layer', id: 'layer-' + side });
      const ns = MR.util.h('div', { class: 'nowspace', id: 'ns-' + side });
      const img = MR.util.h('img', { src: S[side].img.src, draggable: 'false', style: Object.assign({ width: S[side].natW + 'px', height: S[side].natH + 'px' }, extra || {}) });
      ns.append(img); layer.append(ns); return layer;
    };
    const cur = document.getElementById('rcurtain');
    stage.insertBefore(mk('now'), cur);
    stage.insertBefore(mk('then', { transform: MR.Homography.toMatrix3d(S.H) }), cur);
    refitCompare(); applyPresent(); wireCurtain();
  }
  function refitCompare() {
    const stage = document.getElementById('stage'); const now = S.now;
    const fit = MR.util.fitRect(now.natW, now.natH, stage.clientWidth, stage.clientHeight);
    ['ns-now', 'ns-then'].forEach(id => { const el = document.getElementById(id); if (el) el.style.transform = 'translate(' + fit.ox + 'px,' + fit.oy + 'px) scale(' + fit.s + ')'; });
  }
  function clearBlink() { if (S.present._blink) { clearInterval(S.present._blink); S.present._blink = null; } }
  function applyPresent() {
    const layerThen = document.getElementById('layer-then'); if (!layerThen) return;
    const stage = document.getElementById('stage'); clearBlink();
    layerThen.style.opacity = '1'; layerThen.style.clipPath = 'none';
    stage.classList.toggle('curtain-on', S.mode === 'compare' && S.present.mode === 'curtain');
    if (S.present.mode === 'curtain') updateCurtainClip();
    else if (S.present.mode === 'onion') layerThen.style.opacity = String(S.present.opacity);
    else if (S.present.mode === 'blink') { let on = true; S.present._blink = setInterval(() => { on = !on; layerThen.style.opacity = on ? '1' : '0'; }, S.present.blinkMs); }
  }
  function updateCurtainClip() {
    const layerThen = document.getElementById('layer-then'); if (!layerThen) return;
    const split = S.present.split;
    layerThen.style.clipPath = 'inset(0 0 0 ' + (split * 100) + '%)';
    document.getElementById('rcurtain').style.left = (split * 100) + '%';
  }
  let curtainWired = false;
  function wireCurtain() {
    const curtain = document.getElementById('rcurtain'); const stage = document.getElementById('stage');
    if (curtainWired) return; curtainWired = true;
    let dragging = false;
    curtain.addEventListener('pointerdown', e => { dragging = true; e.preventDefault(); });
    window.addEventListener('pointermove', e => {
      if (!dragging) return; const r = stage.getBoundingClientRect();
      S.present.split = Math.max(0.02, Math.min(0.98, (e.clientX - r.left) / r.width));
      if (S.present.mode === 'curtain') updateCurtainClip(); e.preventDefault();
    });
    window.addEventListener('pointerup', () => dragging = false);
  }
  function setPresent(mode) { S.present.mode = mode; applyPresent(); }
  function setOpacity(v) { S.present.opacity = v; if (S.present.mode === 'onion') applyPresent(); }
  function setBlinkMs(ms) { S.present.blinkMs = ms; if (S.present.mode === 'blink') applyPresent(); }

  function refit() { if (S.mode === 'align') refitAlign(); else if (S.mode === 'compare') refitCompare(); }

  return { buildAlign, buildCompare, refit, refitAlign, refitCompare, clearPoints, deletePair, computeH, applyPresent, setPresent, setOpacity, setBlinkMs, stageClear, updateCurtainClip };
})();
