/* app.js — loading, mode switching, the side panel, export, and samples.
   Loaded last. */

MR.App = (function () {
  const S = MR.state;
  let citeText = '';

  /* ---------- image loading ---------- */
  function loadDialog(side) { document.getElementById('file-' + side).click(); }
  function loadImage(side, source) {
    const img = new Image();
    if (source.url) img.crossOrigin = 'anonymous';
    img.onload = () => {
      S[side] = Object.assign(S[side], { img, natW: img.naturalWidth, natH: img.naturalHeight, name: source.name || '' });
      rebuild(); renderSidebar(); updateCompareAvailability();
    };
    img.onerror = () => MR.util.toast('Could not load that image.');
    img.src = source.url || source.objectUrl;
  }
  function fileSource(file) { return { objectUrl: URL.createObjectURL(file), name: file.name }; }

  /* ---------- modes ---------- */
  const SHEETS = { align: ['R-01', 'Align points'], compare: ['R-02', 'Compare'], rectify: ['R-03', 'Rectify & measure'] };
  /* mirror the visual 'on' state onto aria-pressed for every toggle button */
  function reflectPressed() {
    document.querySelectorAll('#mode-seg button, #present-seg button, #measure-btn').forEach(b => {
      b.setAttribute('aria-pressed', b.classList.contains('on') ? 'true' : 'false');
    });
  }
  function setMode(mode) {
    if (mode === 'compare' && !S.H) { MR.util.toast('Place at least four point pairs first.'); return; }
    S.mode = mode;
    document.querySelectorAll('#mode-seg button').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    reflectPressed();
    const tbS = document.getElementById('tb-sheet'), tbM = document.getElementById('tb-mode');
    if (tbS) tbS.textContent = SHEETS[mode][0];
    if (tbM) tbM.textContent = SHEETS[mode][1];
    document.getElementById('align-tools').style.display = mode === 'align' ? '' : 'none';
    document.getElementById('present-tools').style.display = mode === 'compare' ? '' : 'none';
    document.getElementById('rectify-tools').style.display = mode === 'rectify' ? '' : 'none';
    rebuild(); renderSidebar();
  }
  function rebuild() {
    if (S.mode === 'align') MR.Align.buildAlign();
    else if (S.mode === 'compare') MR.Align.buildCompare();
    else MR.Rectify.build();
  }
  function updateCompareAvailability() {
    document.getElementById('mode-compare').disabled = !(S.H && S.then.img && S.now.img);
  }

  /* ---------- sidebar ---------- */
  function qualityWord(rms) {
    if (rms == null) return ['', ''];
    if (rms < 2) return ['excellent', 'good'];
    if (rms < 6) return ['good', 'good'];
    if (rms < 14) return ['fair', 'warn'];
    return ['loose, check your points', 'warn'];
  }
  function qualityBox() {
    const [word, cls] = qualityWord(S.rms);
    if (S.rms == null) return null;
    return MR.util.h('div', { class: 'quality ' + cls },
      MR.util.h('div', { class: 'big', id: 'q-rms' }, S.rms.toFixed(1)),
      MR.util.h('div', null, MR.util.h('div', null, 'pixel fit error'), MR.util.h('div', { class: 'hint' }, word)));
  }
  function renderSidebar() {
    const sb = document.getElementById('sidebar-body'); sb.innerHTML = '';
    if (S.mode === 'align') renderAlignSidebar(sb);
    else if (S.mode === 'compare') renderCompareSidebar(sb);
    else renderRectifySidebar(sb);
  }
  function renderAlignSidebar(sb) {
    const n = Math.min(S.thenPts.length, S.nowPts.length);
    sb.append(MR.util.h('div', { class: 'sect' },
      MR.util.h('h3', null, 'Align two photographs'),
      step(1, 'Load the ', b('historical'), ' photo on the left and the ', b('current'), ' one on the right.'),
      step(2, 'Click a feature on ', b('THEN'), ', then the ', b('same feature'), ' on ', b('NOW'), '. Repeat.'),
      step(3, 'Place ', b('four or more'), ' pairs. Corners of windows and doors work well.'),
      step(4, 'Open ', b('Compare'), ' to swipe between the aligned images.')));
    const q = qualityBox(); if (q) sb.append(MR.util.h('div', { class: 'sect' }, MR.util.h('h3', null, 'Alignment'), q,
      MR.util.h('div', { class: 'hint', style: { marginTop: '8px' } }, n + ' point pair' + (n === 1 ? '' : 's') + ' in use.')));
    if (S.thenPts.length || S.nowPts.length) {
      const rows = [];
      const max = Math.max(S.thenPts.length, S.nowPts.length);
      for (let i = 0; i < max; i++) {
        rows.push(MR.util.h('tr', null,
          MR.util.h('td', null, String(i + 1)),
          MR.util.h('td', null, S.thenPts[i] ? fmt(S.thenPts[i]) : '—'),
          MR.util.h('td', null, S.nowPts[i] ? fmt(S.nowPts[i]) : '—'),
          MR.util.h('td', { class: 'del', title: 'Delete pair', onclick: () => MR.Align.deletePair(i) }, '×')));
      }
      sb.append(MR.util.h('div', { class: 'sect' }, MR.util.h('h3', null, 'Point pairs'),
        MR.util.h('table', { class: 'pairtable' },
          MR.util.h('tr', null, MR.util.h('th', null, '#'), MR.util.h('th', null, 'then'), MR.util.h('th', null, 'now'), MR.util.h('th', null, '')),
          ...rows)));
    }
  }
  function renderCompareSidebar(sb) {
    sb.append(MR.util.h('div', { class: 'sect' },
      MR.util.h('h3', null, 'Reading the overlay'),
      MR.util.h('div', { class: 'hint' }, b('Curtain'), ' drags a divider between then and now. ', b('Onion skin'), ' fades one into the other. ', b('Blink'), ' flips between them, which makes changes pop.')));
    const q = qualityBox(); if (q) sb.append(MR.util.h('div', { class: 'sect' }, MR.util.h('h3', null, 'Alignment'), q));
    sb.append(MR.util.h('div', { class: 'sect' },
      MR.util.h('button', { class: 'btn', onclick: () => setMode('align') }, 'Adjust points'),
      MR.util.h('div', { class: 'hint', style: { marginTop: '8px' } }, 'Export the overlay from the Export menu.')));
  }
  function renderRectifySidebar(sb) {
    const R = S.rectify;
    sb.append(MR.util.h('div', { class: 'sect' },
      MR.util.h('h3', null, 'Square up a facade'),
      MR.util.h('div', { class: 'field' }, MR.util.h('label', null, 'Image'),
        seg2(['then', 'now'], R.side, v => MR.Rectify.setSide(v))),
      MR.util.h('div', { class: 'hint' }, 'Click the four corners of something truly rectangular (a window, a door, a sign), clockwise from the top-left. The image is warped so that rectangle becomes square to the camera.')));
    sb.append(MR.util.h('div', { class: 'sect' },
      MR.util.h('h3', null, 'True proportion'),
      MR.util.h('div', { class: 'row2' },
        field('Width', numInput(R.aspectW, v => MR.Rectify.setAspect(v, 0))),
        field('Height', numInput(R.aspectH, v => MR.Rectify.setAspect(0, v)))),
      MR.util.h('div', { class: 'hint' }, 'The real width-to-height ratio of that rectangle.')));
    sb.append(MR.util.h('div', { class: 'sect' },
      MR.util.h('h3', null, 'Measure'),
      MR.util.h('div', { class: 'row2' },
        field('Known width', numInput(R.realW || '', v => MR.Rectify.setReal(v), 'e.g. 2.4')),
        field('Unit', textInput(R.unit, v => MR.Rectify.setUnit(v)))),
      MR.util.h('div', { class: 'hint' }, 'Enter the real width of the rectangle, turn on ', b('Measure'), ', then click two points.'),
      measureReadout()));
    sb.append(MR.util.h('div', { class: 'sect' },
      R.corners.length === 4
        ? MR.util.h('button', { class: 'btn', onclick: () => MR.Rectify.setView(R.view === 'result' ? 'corners' : 'result') }, R.view === 'result' ? 'Edit corners' : 'Show squared image')
        : MR.util.h('div', { class: 'hint' }, R.corners.length + ' of 4 corners placed.')));
  }
  function measureReadout() {
    const d = MR.Rectify.measureDistance();
    if (!d) return MR.util.h('div', { class: 'hint', style: { marginTop: '8px' } }, 'No measurement yet.');
    const txt = d.real != null ? d.real.toFixed(2) + ' ' + d.unit : Math.round(d.px) + ' px (add a known width for real units)';
    return MR.util.h('div', { class: 'readout', style: { marginTop: '8px' } }, txt);
  }

  /* small sidebar builders */
  function b(t) { return MR.util.h('b', null, t); }
  function step(n, ...kids) { return MR.util.h('div', { class: 'step' }, MR.util.h('div', { class: 'n' }, String(n)), MR.util.h('div', null, ...kids)); }
  function fmt(p) { return Math.round(p[0]) + ', ' + Math.round(p[1]); }
  function field(label, input) { return MR.util.h('div', { class: 'field' }, MR.util.h('label', null, label), input); }
  function numInput(val, on, ph) { const i = MR.util.h('input', { type: 'number', step: 'any', value: val, placeholder: ph || '' }); i.addEventListener('input', () => on(parseFloat(i.value) || 0)); return i; }
  function textInput(val, on) { const i = MR.util.h('input', { type: 'text', value: val }); i.addEventListener('input', () => on(i.value)); return i; }
  function seg2(opts, cur, on) {
    const wrap = MR.util.h('div', { class: 'seg' });
    opts.forEach(o => { const btn = MR.util.h('button', { class: o === cur ? 'on' : '' }, o[0].toUpperCase() + o.slice(1)); btn.addEventListener('click', () => on(o)); wrap.append(btn); });
    return wrap;
  }
  function updateQuality() {
    const el = document.getElementById('q-rms');
    if (el && S.rms != null) { el.textContent = S.rms.toFixed(1); const box = el.closest('.quality'); if (box) { const [, cls] = qualityWord(S.rms); box.className = 'quality ' + cls; } }
  }

  /* ---------- export ---------- */
  function texTri(ctx, img, s, d) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(d[0][0], d[0][1]); ctx.lineTo(d[1][0], d[1][1]); ctx.lineTo(d[2][0], d[2][1]); ctx.closePath(); ctx.clip();
    const M = [s[0][0], s[0][1], 1, s[1][0], s[1][1], 1, s[2][0], s[2][1], 1];
    const inv = MR.Homography.mat3inv(M);
    const cx = k => inv[0] * d[0][k] + inv[1] * d[1][k] + inv[2] * d[2][k];
    const cy = k => inv[3] * d[0][k] + inv[4] * d[1][k] + inv[5] * d[2][k];
    const ce = k => inv[6] * d[0][k] + inv[7] * d[1][k] + inv[8] * d[2][k];
    ctx.setTransform(cx(0), cx(1), cy(0), cy(1), ce(0), ce(1));
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  function warp(ctx, img, H, sw, sh, grid) {
    grid = grid || 24;
    for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
      const x0 = sw * i / grid, x1 = sw * (i + 1) / grid, y0 = sh * j / grid, y1 = sh * (j + 1) / grid;
      const s00 = [x0, y0], s10 = [x1, y0], s01 = [x0, y1], s11 = [x1, y1];
      const d00 = MR.Homography.apply(H, s00), d10 = MR.Homography.apply(H, s10), d01 = MR.Homography.apply(H, s01), d11 = MR.Homography.apply(H, s11);
      texTri(ctx, img, [s00, s10, s01], [d00, d10, d01]);
      texTri(ctx, img, [s10, s11, s01], [d10, d11, d01]);
    }
  }
  function exportPNG() {
    if (S.mode === 'compare' && S.H) {
      const Wn = S.now.natW, Hn = S.now.natH;
      const cv = document.createElement('canvas'); cv.width = Wn; cv.height = Hn;
      const ctx = cv.getContext('2d');
      try {
        ctx.drawImage(S.now.img, 0, 0, Wn, Hn);
        ctx.globalAlpha = S.present.mode === 'onion' ? S.present.opacity : 1;
        if (S.present.mode === 'curtain') { ctx.save(); ctx.beginPath(); ctx.rect(S.present.split * Wn, 0, Wn, Hn); ctx.clip(); warp(ctx, S.then.img, S.H, S.then.natW, S.then.natH); ctx.restore(); }
        else warp(ctx, S.then.img, S.H, S.then.natW, S.then.natH);
        ctx.globalAlpha = 1;
        cv.toBlob(bl => bl ? MR.util.download('mirl-rephoto-overlay.png', bl) : MR.util.toast('Export blocked by image CORS.'), 'image/png');
      } catch (e) { MR.util.toast('Export blocked: an image did not allow copying (CORS).'); }
    } else if (S.mode === 'rectify' && S.rectify.view === 'result' && S.rectify.H) {
      const r = S.rectify._rect; const cv = document.createElement('canvas'); cv.width = Math.round(r.RW); cv.height = Math.round(r.RH);
      const ctx = cv.getContext('2d');
      try { warp(ctx, S[S.rectify.side].img, S.rectify.H, S[S.rectify.side].natW, S[S.rectify.side].natH); cv.toBlob(bl => bl ? MR.util.download('mirl-rephoto-elevation.png', bl) : MR.util.toast('Export blocked by image CORS.'), 'image/png'); }
      catch (e) { MR.util.toast('Export blocked: an image did not allow copying (CORS).'); }
    } else {
      MR.util.toast('Open Compare or a squared Rectify view to export an image.');
    }
  }
  function savePoints() {
    const data = {
      tool: 'mirl-rephoto', kind: 'points', savedAt: new Date().toISOString(),
      then: { name: S.then.name, width: S.then.natW, height: S.then.natH },
      now: { name: S.now.name, width: S.now.natW, height: S.now.natH },
      thenPoints: S.thenPts, nowPoints: S.nowPts, homography: S.H, rmsError: S.rms,
      rectify: S.rectify.H ? { side: S.rectify.side, corners: S.rectify.corners, aspect: [S.rectify.aspectW, S.rectify.aspectH], homography: S.rectify.H } : null,
    };
    MR.util.downloadText('mirl-rephoto-points.json', JSON.stringify(data, null, 2), 'application/json');
  }
  function projectJSON() {
    return JSON.stringify({
      tool: 'mirl-rephoto', version: 1, savedAt: new Date().toISOString(), mode: S.mode,
      then: { name: S.then.name, source: S.then._src || null },
      now: { name: S.now.name, source: S.now._src || null },
      thenPts: S.thenPts, nowPts: S.nowPts, present: { mode: S.present.mode, split: S.present.split, opacity: S.present.opacity, blinkMs: S.present.blinkMs },
      rectify: { side: S.rectify.side, corners: S.rectify.corners, aspectW: S.rectify.aspectW, aspectH: S.rectify.aspectH, realW: S.rectify.realW, unit: S.rectify.unit, view: S.rectify.view, measure: S.rectify.measure, mPts: S.rectify.mPts },
    }, null, 2);
  }
  function saveProject() { MR.util.downloadText('mirl-rephoto-project.json', projectJSON(), 'application/json'); }
  function loadProjectObj(obj) {
    if (!obj || obj.tool !== 'mirl-rephoto') { MR.util.toast('Not a MIRL Rephoto project.'); return; }
    S.thenPts = obj.thenPts || []; S.nowPts = obj.nowPts || [];
    S.nextSide = S.thenPts.length <= S.nowPts.length ? 'then' : 'now';
    Object.assign(S.present, obj.present || {});
    Object.assign(S.rectify, obj.rectify || {});
    MR.Align.computeH();
    let need = [];
    ['then', 'now'].forEach(side => { const m = obj[side]; S[side].name = m && m.name || ''; if (m && m.source && m.source.url) { S[side]._src = m.source; loadImage(side, { url: m.source.url, name: m.name }); } else if (m && m.name) need.push(side); });
    updateCompareAvailability(); setMode(obj.mode && obj.mode !== 'compare' ? obj.mode : 'align'); renderSidebar();
    if (need.length) MR.util.toast('Project loaded. Re-load the ' + need.join(' and ') + ' image (points are kept).');
  }
  function openProjectFile(file) { const r = new FileReader(); r.onload = () => { try { loadProjectObj(JSON.parse(r.result)); } catch (e) { MR.util.toast('Could not read that project file.'); } }; r.readAsText(file); }

  /* ---------- wiring ---------- */
  function wire() {
    document.querySelectorAll('#mode-seg button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    document.getElementById('swap-btn').addEventListener('click', () => {
      [S.then, S.now] = [S.now, S.then]; [S.thenPts, S.nowPts] = [S.nowPts, S.thenPts];
      S.nextSide = S.thenPts.length <= S.nowPts.length ? 'then' : 'now';
      MR.Align.computeH(); rebuild(); renderSidebar(); updateCompareAvailability();
    });
    document.getElementById('clear-pts').addEventListener('click', () => MR.Align.clearPoints());
    document.querySelectorAll('#present-seg button').forEach(b => b.addEventListener('click', () => {
      document.querySelectorAll('#present-seg button').forEach(x => x.classList.toggle('on', x === b));
      reflectPressed();
      document.getElementById('present-opacity-wrap').style.display = b.dataset.present === 'onion' ? '' : 'none';
      document.getElementById('present-blink-wrap').style.display = b.dataset.present === 'blink' ? '' : 'none';
      MR.Align.setPresent(b.dataset.present);
    }));
    document.getElementById('present-opacity').addEventListener('input', e => MR.Align.setOpacity(e.target.value / 100));
    document.getElementById('present-blink').addEventListener('input', e => MR.Align.setBlinkMs(+e.target.value));
    document.getElementById('measure-btn').addEventListener('click', () => {
      const on = MR.Rectify.toggleMeasure(); document.getElementById('measure-btn').classList.toggle('on', on); reflectPressed();
    });
    document.getElementById('clear-rect').addEventListener('click', () => MR.Rectify.clearCorners());
    document.getElementById('panel-btn').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('collapsed'));

    const menu = document.getElementById('export-menu');
    document.getElementById('export-btn').addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
    document.addEventListener('click', () => menu.classList.add('hidden'));
    menu.addEventListener('click', e => e.stopPropagation());
    menu.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
      menu.classList.add('hidden'); const a = btn.dataset.act;
      if (a === 'png') exportPNG(); else if (a === 'points') savePoints();
      else if (a === 'project') saveProject(); else if (a === 'load') document.getElementById('project-input').click();
    }));

    ['then', 'now'].forEach(side => document.getElementById('file-' + side).addEventListener('change', e => {
      const f = e.target.files && e.target.files[0]; if (f) { S[side]._src = null; loadImage(side, fileSource(f)); } e.target.value = '';
    }));
    document.getElementById('project-input').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) openProjectFile(f); e.target.value = ''; });

    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (S.mode === 'rectify') MR.Rectify.refit(); else MR.Align.refit(); }, 120); });
  }

  function loadSamplesIfEmpty() {
    if (S.then.img || S.now.img) return;
    S.then._src = { url: 'samples/then.png' }; S.now._src = { url: 'samples/now.png' };
    loadImage('then', { url: 'samples/then.png', name: 'then.png' });
    loadImage('now', { url: 'samples/now.png', name: 'now.png' });
  }

  /* keep the working state across a refresh: the points, the rectify corners, and
     the image sources (url images reload; local files ask to be re-picked) */
  const AUTOSAVE_KEY = 'mirl-rephoto-autosave';
  function autosave() { try { localStorage.setItem(AUTOSAVE_KEY, projectJSON()); } catch (e) {} }
  function restoreOrSample() {
    let saved = null;
    try { saved = localStorage.getItem(AUTOSAVE_KEY); } catch (e) {}
    if (saved) { try { loadProjectObj(JSON.parse(saved)); return; } catch (e) {} }
    loadSamplesIfEmpty();
  }
  function init() {
    wire(); setMode('align'); restoreOrSample();
    setInterval(autosave, 4000);
    window.addEventListener('beforeunload', autosave);
  }

  return { init, loadDialog, loadImage, setMode, rebuild, renderSidebar, updateCompareAvailability, updateQuality, exportPNG };
})();

document.addEventListener('DOMContentLoaded', MR.App.init);
