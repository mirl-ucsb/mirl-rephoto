/* rectify.js — square a slanted facade to a flat elevation, then measure from
   it. Mark the four corners of something you know is rectangular (a window, a
   door, a signboard); the image is warped to a true rectangle. Give one real
   dimension and you can read distances off the squared image. */

MR.Rectify = (function () {
  const S = MR.state;
  const NS = 'http://www.w3.org/2000/svg';
  const R = () => S.rectify;

  function build() {
    const stage = document.getElementById('stage');
    MR.Align.stageClear();
    stage.classList.remove('curtain-on');
    const st = S[R().side];
    if (!st.img) {
      stage.classList.remove('measure');
      stage.insertBefore(MR.util.h('div', { class: 'empty', style: { position: 'absolute', inset: '0' } },
        MR.util.h('div', { class: 'big' }, '▱'),
        MR.util.h('div', null, 'Load an image to square up'),
        MR.util.h('button', { class: 'btn', onclick: () => MR.App.loadDialog(R().side) }, 'Load image'),
        MR.util.h('div', { class: 'hint' }, 'Choose Then or Now in the panel')), document.getElementById('rcurtain'));
      return;
    }
    if (R().view === 'result' && R().corners.length === 4) buildResult();
    else { R().view = 'corners'; buildCorners(); }
  }

  /* ---------- placing the four corners ---------- */
  function buildCorners() {
    const stage = document.getElementById('stage'); stage.classList.remove('measure');
    const st = S[R().side];
    const img = MR.util.h('img', { id: 'img-rect', draggable: 'false', src: st.img.src });
    const svg = document.createElementNS(NS, 'svg');
    svg.id = 'rect-svg'; Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    const dots = MR.util.h('div', { id: 'dots-rect', style: { position: 'absolute', inset: '0' } });
    const head = MR.util.h('div', { class: 'panel-head' },
      MR.util.h('span', { class: 'swatch', style: { background: 'var(--accent)' } }),
      MR.util.h('span', null, R().side.toUpperCase() + '  ·  click the four corners, clockwise from top-left'));
    const p = MR.util.h('div', { class: 'imgpanel', id: 'panel-rect' }, head, img, svg, dots);
    p.addEventListener('click', e => onCornerClick(e, p));
    p.addEventListener('dragover', e => { e.preventDefault(); p.classList.add('drop'); });
    p.addEventListener('dragleave', () => p.classList.remove('drop'));
    p.addEventListener('drop', e => { e.preventDefault(); p.classList.remove('drop'); const f = e.dataTransfer.files[0]; if (f) MR.App.loadImage(R().side, { file: f }); });
    stage.insertBefore(p, document.getElementById('rcurtain'));
    refit();
  }
  function onCornerClick(e, p) {
    if (e.target.closest('.dot')) return;
    if (R().corners.length >= 4) { MR.util.toast('Four corners already set. Clear corners to start over.'); return; }
    const fit = R()._cfit, r = p.getBoundingClientRect();
    const x = (e.clientX - r.left - fit.ox) / fit.s, y = (e.clientY - r.top - fit.oy) / fit.s;
    const st = S[R().side];
    if (x < 0 || y < 0 || x > st.natW || y > st.natH) return;
    R().corners.push([x, y]);
    if (R().corners.length === 4) { R().view = 'result'; build(); MR.App.renderSidebar(); return; }
    renderCorners(); MR.App.renderSidebar();
  }
  function dragCorner(i, d) {
    const p = document.getElementById('panel-rect'); const st = S[R().side];
    function mv(e) {
      const fit = R()._cfit, r = p.getBoundingClientRect();
      let x = (e.clientX - r.left - fit.ox) / fit.s, y = (e.clientY - r.top - fit.oy) / fit.s;
      x = Math.max(0, Math.min(st.natW, x)); y = Math.max(0, Math.min(st.natH, y));
      R().corners[i] = [x, y]; d.style.left = (fit.ox + x * fit.s) + 'px'; d.style.top = (fit.oy + y * fit.s) + 'px';
      renderOutline();
    }
    function up() { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  }
  function renderOutline() {
    const svg = document.getElementById('rect-svg'); const fit = R()._cfit; if (!svg || !fit) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const pts = R().corners.map(c => [fit.ox + c[0] * fit.s, fit.oy + c[1] * fit.s]);
    if (pts.length >= 2) {
      const poly = document.createElementNS(NS, pts.length >= 3 ? 'polygon' : 'polyline');
      poly.setAttribute('points', pts.map(p => p.join(',')).join(' '));
      poly.setAttribute('fill', pts.length >= 3 ? 'rgba(169,50,33,0.10)' : 'none');
      poly.setAttribute('stroke', '#a93221'); poly.setAttribute('stroke-width', '1.5');
      svg.appendChild(poly);
    }
  }
  function renderCorners() {
    const dots = document.getElementById('dots-rect'); const fit = R()._cfit; if (!dots || !fit) return;
    dots.innerHTML = '';
    R().corners.forEach((c, i) => {
      const d = MR.util.h('div', { class: 'dot', style: { background: 'var(--accent)', left: (fit.ox + c[0] * fit.s) + 'px', top: (fit.oy + c[1] * fit.s) + 'px' } }, MR.util.h('span', null, String(i + 1)));
      d.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); dragCorner(i, d); });
      dots.append(d);
    });
    renderOutline();
  }

  /* ---------- the squared result + measuring ---------- */
  function computeRect() {
    const RH = 1000, RW = 1000 * (R().aspectW / R().aspectH);
    R()._rect = { RW, RH };
    R().H = MR.Homography.compute(R().corners, [[0, 0], [RW, 0], [RW, RH], [0, RH]]);
  }
  function buildResult() {
    computeRect();
    const stage = document.getElementById('stage'); const st = S[R().side];
    const layer = MR.util.h('div', { class: 'layer', id: 'layer-rect' });
    const ns = MR.util.h('div', { class: 'nowspace', id: 'ns-rect' });
    const img = MR.util.h('img', { src: st.img.src, draggable: 'false', style: { width: st.natW + 'px', height: st.natH + 'px', transform: MR.Homography.toMatrix3d(R().H) } });
    ns.append(img); layer.append(ns);
    layer.addEventListener('click', onResultClick);
    const mlayer = MR.util.h('div', { id: 'mlayer', style: { position: 'absolute', inset: '0', pointerEvents: 'none' } });
    stage.insertBefore(layer, document.getElementById('rcurtain'));
    stage.insertBefore(mlayer, document.getElementById('rcurtain'));
    stage.classList.toggle('measure', R().measure);
    refitResult();
  }
  function refitResult() {
    const stage = document.getElementById('stage'); const rect = R()._rect; if (!rect) return;
    const fit = MR.util.fitRect(rect.RW, rect.RH, stage.clientWidth, stage.clientHeight);
    R()._rfit = fit;
    const ns = document.getElementById('ns-rect');
    if (ns) ns.style.transform = 'translate(' + fit.ox + 'px,' + fit.oy + 'px) scale(' + fit.s + ')';
    renderMeasure();
  }
  function onResultClick(e) {
    if (!R().measure) return;
    const fit = R()._rfit, r = document.getElementById('stage').getBoundingClientRect();
    const x = (e.clientX - r.left - fit.ox) / fit.s, y = (e.clientY - r.top - fit.oy) / fit.s;
    if (R().mPts.length >= 2) R().mPts = [];
    R().mPts.push([x, y]);
    renderMeasure(); MR.App.renderSidebar();
  }
  function measureDistance() {
    if (R().mPts.length < 2) return null;
    const a = R().mPts[0], b = R().mPts[1];
    const px = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (R().realW > 0 && R()._rect) return { px, real: px * R().realW / R()._rect.RW, unit: R().unit };
    return { px, real: null, unit: null };
  }
  function renderMeasure() {
    const m = document.getElementById('mlayer'); const fit = R()._rfit; if (!m || !fit) return;
    m.innerHTML = '';
    const scr = p => [fit.ox + p[0] * fit.s, fit.oy + p[1] * fit.s];
    R().mPts.forEach(p => { const s = scr(p); m.append(MR.util.h('div', { class: 'mdot', style: { left: s[0] + 'px', top: s[1] + 'px' } })); });
    if (R().mPts.length === 2) {
      const a = scr(R().mPts[0]), b = scr(R().mPts[1]);
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
      m.append(MR.util.h('div', { class: 'mline', style: { left: a[0] + 'px', top: a[1] + 'px', width: len + 'px', transform: 'rotate(' + ang + 'deg)' } }));
      const d = measureDistance();
      const label = d.real != null ? d.real.toFixed(2) + ' ' + d.unit : Math.round(d.px) + ' px';
      m.append(MR.util.h('div', { class: 'mlabel', style: { left: (a[0] + b[0]) / 2 + 'px', top: (a[1] + b[1]) / 2 + 'px' } }, label));
    }
  }

  function refit() { if (R().view === 'result') refitResult(); else { const st = S[R().side], img = document.getElementById('img-rect'), p = document.getElementById('panel-rect'); if (!img || !p) return; const fit = MR.util.fitRect(st.natW, st.natH, p.clientWidth, p.clientHeight); R()._cfit = fit; Object.assign(img.style, { position: 'absolute', left: fit.ox + 'px', top: fit.oy + 'px', width: fit.w + 'px', height: fit.h + 'px' }); renderCorners(); } }

  function setSide(side) { R().side = side; R().corners = []; R().mPts = []; R().view = 'corners'; build(); MR.App.renderSidebar(); }
  function setAspect(w, h) { R().aspectW = w || R().aspectW; R().aspectH = h || R().aspectH; if (R().view === 'result') build(); }
  function setReal(v) { R().realW = v; renderMeasure(); MR.App.renderSidebar(); }
  function setUnit(u) { R().unit = u; renderMeasure(); MR.App.renderSidebar(); }
  function toggleMeasure() { R().measure = !R().measure; document.getElementById('stage').classList.toggle('measure', R().measure && R().view === 'result'); return R().measure; }
  function clearCorners() { R().corners = []; R().mPts = []; R().view = 'corners'; build(); MR.App.renderSidebar(); }
  function setView(v) { if (v === 'result' && R().corners.length < 4) return; R().view = v; build(); MR.App.renderSidebar(); }

  return { build, refit, measureDistance, setSide, setAspect, setReal, setUnit, toggleMeasure, clearCorners, setView };
})();
