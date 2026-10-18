/* PixelForge Studio — the main controller.
 *
 * Wires the shell together: documents and tabs, the stage view, tools,
 * panels, menus, dialogs, open/save/export, autosave, hold-to-compare,
 * keyboard shortcuts and the staging demo. Everything runs on the device;
 * nothing is uploaded and there are no network calls beyond the platform's
 * own files.
 */
'use strict';

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var t = function (k) { return PF_I18N.t(k); };

  var els = {
    menus: $('menus'), undo: $('undo-btn'), redo: $('redo-btn'), panelsToggle: $('panels-toggle'),
    exportBtn: $('export-btn'), doctabs: $('doctabs'), optsbar: $('optsbar'), toolscol: $('toolscol'),
    stagewrap: $('stagewrap'), stageInner: $('stage-inner'), canvas: $('stage-canvas'), overlay: $('overlay-canvas'),
    emptyState: $('empty-state'), chip: $('compare-chip'), cropOk: $('crop-ok'), cropApply: $('crop-apply'),
    panels: $('panels'), layerList: $('layer-list'), layerBlend: $('layer-blend'), layerOpacity: $('layer-opacity'),
    layerClip: $('layer-clip'), layerMask: $('layer-mask'), layerDup: $('layer-dup'), layerDel: $('layer-del'),
    adjList: $('adj-list'), historyList: $('history-list'), historyNote: $('history-note'),
    swatches: $('swatches'), recent: $('recent-colors'), fgSwatch: $('fg-swatch'),
    cpH: $('cp-h'), cpS: $('cp-s'), cpV: $('cp-v'), cpNative: $('cp-native'),
    histogram: $('histogram'), navigator: $('navigator'),
    statusDims: $('status-dims'), statusZoom: $('status-zoom'), statusAutosave: $('status-autosave'), statusMsg: $('status-msg'),
    menuPop: $('menu-pop'), backdrop: $('backdrop'), dialogBox: $('dialog-box'),
    fileInput: $('file-input'), pfsInput: $('pfs-input'), demoNote: $('demo-note'),
    newBtn: $('new-btn'), emptyOpenBtn: $('empty-open-btn'),
  };

  // ── App state ─────────────────────────────────────────────────────────
  var docs = [];
  var activeDocId = null;
  var state = {
    toolId: 'move',
    toolOpts: {},       // per-tool option values
    fg: '#1c1917',
    bg: '#ffffff',
    recent: [],
    maskEdit: false,    // painting targets the active layer's mask
    maskPaintWhite: false,
    holding: false,     // hold to compare
    cropDraft: null,
    overlayDraft: null,
    antsOffset: 0,
    compositeCache: null,
    autosaveOk: true,
    swatchCount: 0,
  };
  var SWATCHES = ['#000000', '#ffffff', '#c2410c', '#ea580c', '#f59e0b', '#16a34a', '#0ea5e9', '#6366f1', '#a855f7', '#e11d48'];

  function doc() { return docs.find(function (d) { return d.id === activeDocId; }) || null; }
  function view() { var d = doc(); return d ? d.view : { zoom: 1, panX: 0, panY: 0 }; }

  PF_TOOLS.init({
    doc: doc, t: t, docPt: docPt, status: status, repaint: repaint, repaintOverlay: repaintOverlay,
    toolOpts: toolOpts, get fg() { return state.fg; },
    setForeground: setForeground, docDirty: docDirty, cropImageData: cropImageData,
    rasterizeLayer: rasterizeLayer, addLayerAbove: addLayerAbove, editTextLayer: editTextLayer,
    setCropDraft: setCropDraft, afterSelectionChange: afterSelectionChange,
    compositeData: compositeData, view: view, setPan: setPan, zoomAt: zoomAt,
    healRegion: healRegion,
    get maskEdit() { return state.maskEdit; },
    get maskPaintWhite() { return state.maskPaintWhite; },
  });

  function toolOpts() {
    var tool = PF_TOOLS.byId[state.toolId];
    if (!tool.options) return {};
    var vals = state.toolOpts[state.toolId] || (state.toolOpts[state.toolId] = {});
    tool.options.forEach(function (f) { if (!(f.param in vals)) vals[f.param] = f.def; });
    return vals;
  }

  // ── Status / helpers ──────────────────────────────────────────────────
  var statusTimer = 0;
  function status(msg) {
    els.statusMsg.textContent = msg;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () { els.statusMsg.textContent = ''; }, 4000);
  }
  function cropImageData(snap, rect) {
    var x = Math.max(0, rect.x | 0), y = Math.max(0, rect.y | 0);
    var w = Math.min(snap.width - x, rect.w), h = Math.min(snap.height - y, rect.h);
    if (w <= 0 || h <= 0) return new ImageData(1, 1);
    var out = new ImageData(w, h);
    var d = snap.data, o = out.data;
    for (var yy = 0; yy < h; yy++) {
      var src = ((snap.height === h && snap.width === w) ? 0 : ((y + yy) * snap.width + x) * 4);
      var dst = (yy * w) * 4;
      for (var xx = 0; xx < w * 4; xx++) o[dst + xx] = d[src + xx];
    }
    return out;
  }

  // ── Document lifecycle ────────────────────────────────────────────────
  function addDoc(d, activate) {
    docs.push(d);
    if (activate !== false) activeDocId = d.id;
    fitView();
    renderTabs();
    renderAll();
  }
  function closeDoc(id) {
    var i = docs.findIndex(function (d) { return d.id === id; });
    if (i < 0) return;
    docs.splice(i, 1);
    if (activeDocId === id) activeDocId = docs.length ? docs[Math.max(0, i - 1)].id : null;
    renderTabs();
    renderAll();
  }
  function fitView() {
    var d = doc();
    if (!d) return;
    var pad = 48;
    var zw = (els.stagewrap.clientWidth - pad) / d.width;
    var zh = (els.stagewrap.clientHeight - pad) / d.height;
    d.view.zoom = Math.min(1, Math.max(0.01, Math.min(zw, zh)));
    d.view.panX = 0; d.view.panY = 0;
  }

  function docDirty() {
    var d = doc();
    if (!d) return;
    d.dirty = true;
    state.compositeCache = null;
    scheduleAutosave();
  }
  function renderAll() {
    renderTools();
    renderOpts();
    renderPanels();
    renderTabs();
    renderBlendOptions();
    updateMenuState();
    layoutCanvases();
    repaint();
    repaintOverlay();
    updateStatus();
    updateMenuState();
    els.emptyState.hidden = !!doc();
    els.stageInner.style.display = doc() ? 'block' : 'none';
    els.exportBtn.disabled = !doc();
    els.demoNote.hidden = !(doc() && doc().demo);
  }

  function openNew() {
    dialog(t('newDocTitle'), function (body, done) {
      var name = field(body, t('name'), input('text', 'Untitled'));
      var w = field(body, t('width'), input('number', 1920, 1, 16384));
      var h = field(body, t('height'), input('number', 1080, 1, 16384));
      var bg = field(body, t('background'), select([['white', t('white')], ['transparent', t('transparent')]]));
      actions(body, done, [
        { label: t('cancel') },
        { label: t('create'), primary: true, act: function () {
          var d = PF_CORE.createDoc(name.value || 'Untitled', +w.value || 1920, +h.value || 1080, bg.value);
          d.original = PF_ENGINE.renderDoc(d, 1);
          addDoc(d);
        } },
      ]);
    });
  }

  // ── Stage rendering ───────────────────────────────────────────────────
  function layoutCanvases() {
    var d = doc();
    if (!d) return;
    var v = d.view;
    var renderScale = Math.min(1, Math.max(0.02, v.zoom));
    d._renderScale = renderScale;
    els.canvas.width = Math.max(1, Math.round(d.width * renderScale));
    els.canvas.height = Math.max(1, Math.round(d.height * renderScale));
    els.overlay.width = els.canvas.width;
    els.overlay.height = els.canvas.height;
    positionCanvas(els.canvas, d, v);
    positionCanvas(els.overlay, d, v);
  }
  function positionCanvas(c, d, v) {
    c.style.width = Math.round(d.width * v.zoom) + 'px';
    c.style.height = Math.round(d.height * v.zoom) + 'px';
    c.style.left = '50%';
    c.style.top = '50%';
    c.style.transform = 'translate(calc(-50% + ' + v.panX + 'px), calc(-50% + ' + v.panY + 'px))';
  }
  var repaintQueued = false;
  function repaint() {
    if (repaintQueued) return;
    repaintQueued = true;
    requestAnimationFrame(function () {
      repaintQueued = false;
      var d = doc();
      if (!d) return;
      var ctx = els.canvas.getContext('2d');
      if (state.holding && d.original) {
        ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
        ctx.drawImage(d.original, 0, 0, els.canvas.width, els.canvas.height);
        return;
      }
      var out = PF_ENGINE.renderDoc(d, d._renderScale || 1);
      ctx.clearRect(0, 0, els.canvas.width, els.canvas.height);
      ctx.drawImage(out, 0, 0);
    });
  }
  var overlayQueued = false;
  function repaintOverlay() {
    if (overlayQueued) return;
    overlayQueued = true;
    requestAnimationFrame(function () {
      overlayQueued = false;
      var d = doc();
      var ctx = els.overlay.getContext('2d');
      var w = els.overlay.width, h = els.overlay.height;
      ctx.clearRect(0, 0, w, h);
      if (!d) return;
      var s = d._renderScale || 1;
      ctx.lineWidth = 1.5;
      // draft shapes while dragging
      if (state.overlayDraft) {
        ctx.strokeStyle = 'rgba(255,255,255,.9)';
        ctx.setLineDash([4, 3]);
        var dr = state.overlayDraft;
        ctx.beginPath();
        if (dr.type === 'poly') {
          dr.pts.forEach(function (q, i) { var x = q.x * s, y = q.y * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
          ctx.stroke();
        } else {
          var x = Math.min(dr.x, dr.x2 || dr.x) * s, y = Math.min(dr.y, dr.y2 || dr.y) * s;
          var ww = Math.abs((dr.x2 || dr.x) - dr.x) * s, hh = Math.abs((dr.y2 || dr.y) - dr.y) * s;
          if (dr.type === 'ellipse') ctx.ellipse(x + ww / 2, y + hh / 2, ww / 2, hh / 2, 0, 0, Math.PI * 2);
          else ctx.rect(x, y, ww, hh);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      // marching ants
      if (d.selection) {
        if (!d._antsPath || d._antsSel !== d.selection) {
          d._antsPath = PF_ENGINE.antsPath(d.selection);
          d._antsSel = d.selection;
        }
        if (d._antsPath) {
          ctx.strokeStyle = 'rgb(' + (document.documentElement.classList.contains('dark') ? '245 245 244' : '28 25 23') + ')';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.lineDashOffset = -state.antsOffset;
          ctx.stroke(d._antsPath);
          ctx.strokeStyle = 'rgba(' + (document.documentElement.classList.contains('dark') ? '28 25 23' : '245 245 244') + ',.9)';
          ctx.lineDashOffset = -state.antsOffset + 4;
          ctx.stroke(d._antsPath);
          ctx.setLineDash([]);
        }
      }
    });
  }
  setInterval(function () {
    if (!prefersReducedMotion() && doc() && doc().selection) {
      state.antsOffset = (state.antsOffset + 1) % 8;
      repaintOverlay();
    }
  }, 120);
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function docPt(e) {
    var d = doc();
    if (!d) return { x: 0, y: 0, px: 0, py: 0 };
    var r = els.canvas.getBoundingClientRect();
    var v = d.view;
    return {
      x: (e.clientX - r.left) / v.zoom,
      y: (e.clientY - r.top) / v.zoom,
      px: e.clientX, py: e.clientY,
    };
  }
  function setPan(x, y) {
    var d = doc(); if (!d) return;
    d.view.panX = x; d.view.panY = y;
    positionCanvas(els.canvas, d, d.view);
    positionCanvas(els.overlay, d, d.view);
    drawNavigator();
  }
  function zoomAt(px, py, factor) {
    var d = doc(); if (!d) return;
    var v = d.view;
    var nz = Math.min(16, Math.max(0.01, v.zoom * factor));
    var r = els.canvas.getBoundingClientRect();
    var cx = px - r.left, cy = py - r.top;
    v.panX = v.panX - cx * (nz - v.zoom) / v.zoom + cx * 0; // keep point under cursor: adjust pan
    v.panX = v.panX - (cx / v.zoom) * (nz - v.zoom) + (cx / v.zoom) * 0;
    v.panX = v.panX - cx * (nz / v.zoom - 1);
    v.panY = v.panY - cy * (nz / v.zoom - 1);
    v.zoom = nz;
    layoutCanvases(); repaint(); repaintOverlay(); updateStatus(); drawNavigator();
  }
  function zoomFit() { fitView(); layoutCanvases(); repaint(); updateStatus(); drawNavigator(); }

  // pointer plumbing -----------------------------------------------------
  var pointer = { down: false, pt: null, tool: null };
  els.overlay.style.pointerEvents = 'none';
  els.stagewrap.addEventListener('pointerdown', function (e) {
    var d = doc(); if (!d) return;
    if (e.target.closest('button')) return;
    els.stagewrap.setPointerCapture(e.pointerId);
    var tool = PF_TOOLS.byId[state.toolId];
    pointer.down = true; pointer.tool = tool;
    var p = docPt(e);
    pointer.pt = p;
    if (tool && tool.down) tool.down(p, e);
    e.preventDefault();
  });
  els.stagewrap.addEventListener('pointermove', function (e) {
    if (!pointer.down || !pointer.tool) return;
    var p = docPt(e);
    pointer.pt = p;
    if (pointer.tool.move) pointer.tool.move(p, e);
  });
  function endPointer(e) {
    if (!pointer.down) return;
    pointer.down = false;
    var tool = pointer.tool;
    pointer.tool = null;
    if (tool && tool.up && pointer.pt) tool.up(pointer.pt, e);
  }
  els.stagewrap.addEventListener('pointerup', endPointer);
  els.stagewrap.addEventListener('pointercancel', endPointer);
  els.stagewrap.addEventListener('dblclick', function (e) {
    var tool = PF_TOOLS.byId[state.toolId];
    if (tool && tool.dbl) tool.dbl(docPt(e), e);
  });
  // two-finger pinch/pan on touch
  var touchState = null;
  els.stagewrap.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2 && doc()) {
      var v = doc().view;
      touchState = { d: dist(e.touches), zoom: v.zoom, panX: v.panX, panY: v.panY, mid: midPt(e.touches) };
    }
  }, { passive: true });
  els.stagewrap.addEventListener('touchmove', function (e) {
    if (touchState && e.touches.length === 2 && doc()) {
      var v = doc().view;
      var f = dist(e.touches) / touchState.d;
      var nz = Math.min(16, Math.max(0.01, touchState.zoom * f));
      var m = midPt(e.touches);
      var r = els.canvas.getBoundingClientRect();
      var cx = m.x - r.left, cy = m.y - r.top;
      v.panX = touchState.panX - cx * (nz / touchState.zoom - 1) + (m.x - touchState.mid.x);
      v.panY = touchState.panY - cy * (nz / touchState.zoom - 1) + (m.y - touchState.mid.y);
      v.zoom = nz;
      layoutCanvases(); repaint(); repaintOverlay(); updateStatus();
      e.preventDefault();
    }
  }, { passive: false });
  els.stagewrap.addEventListener('touchend', function () { touchState = null; }, { passive: true });
  function dist(ts) { return Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY); }
  function midPt(ts) { return { x: (ts[0].clientX + ts[1].clientX) / 2, y: (ts[0].clientY + ts[1].clientY) / 2 }; }

  function wheelZoom(e) {
    if (!doc()) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }
  }
  els.stagewrap.addEventListener('wheel', wheelZoom, { passive: false });

  // ── Tools UI ──────────────────────────────────────────────────────────
  var TOOL_ICONS = {
    move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
    marqueeRect: '<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 2"/>',
    marqueeEllipse: '<ellipse cx="12" cy="12" rx="8" ry="8" stroke-dasharray="3 2"/>',
    lasso: '<path d="M4 12c0-4.4 3.6-7 8-7s8 2.6 8 7-3.6 7-8 7c-2 0-4-.5-4-2s2-2 4-2"/><circle cx="6" cy="19" r="2"/>',
    lassoPoly: '<path d="M5 8l6-4 8 5-2 9-7 3-4-6z" stroke-dasharray="2 2"/>',
    wand: '<path d="M6 18L18 6M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM5 5l.6 1.2L7 7l-1.4.6L5 9l-.6-1.4L3 7l1.4-.8z"/>',
    crop: '<path d="M6 2v16h16M2 6h16v16"/>',
    eyedropper: '<path d="M18 3a3 3 0 0 1 3 3l-8 8-3 1 1-3zM4 16l6-6 4 4-6 6H4z"/>',
    brush: '<path d="M14 3l7 7-8 8c-2 2-5 2-7 0s0-5 0-7z"/>',
    pencil: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>',
    eraser: '<path d="M7 20l-4-4L14 5l5 5-9 10zM5 20h14"/>',
    bucket: '<path d="M12 3l8 8-7 7a3 3 0 0 1-4 0l-5-5a3 3 0 0 1 0-4zM20 17c0 1.5-1 3-2 3s-2-1.5-2-3 2-3 2-3 2 1.5 2 3z"/>',
    gradient: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 12h18" stroke-dasharray="2 2"/>',
    clone: '<rect x="8" y="8" width="10" height="10" rx="1"/><path d="M6 16H4V4h12v2"/>',
    heal: '<path d="M11 4h2v7h7v2h-7v7h-2v-7H4v-2h7z"/>',
    blur: '<circle cx="12" cy="12" r="8" stroke-dasharray="1 2"/><circle cx="12" cy="12" r="4"/>',
    smudge: '<path d="M4 15c4-1 6-5 9-5s5 2 7 4M4 19c5-1 8-4 12-4"/>',
    dodge: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    burn: '<path d="M12 3s5 5.5 5 9a5 5 0 0 1-10 0c0-3.5 5-9 5-9z"/>',
    text: '<path d="M5 5h14M12 5v14M9 19h6"/>',
    shape: '<rect x="3" y="8" width="8" height="8" rx="1"/><ellipse cx="16" cy="12" rx="5" ry="4"/>',
    pen: '<path d="M4 20c4-1 4-5 8-8s8-8 8-8M14 12l4 4"/>',
    pathSelect: '<path d="M4 18c6 0 6-12 12-12"/><rect x="2" y="16" width="4" height="4"/><rect x="14" y="4" width="4" height="4"/>',
    hand: '<path d="M8 12V6a1.5 1.5 0 0 1 3 0v5V4.5a1.5 1.5 0 0 1 3 0V11v-5a1.5 1.5 0 0 1 3 0v8a7 7 0 0 1-7 7c-3 0-5-2-6.5-5L2.6 12.6A1.5 1.5 0 0 1 5 10.5L8 14z"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="M16 16l5 5M8 11h6M11 8v6"/>',
  };
  function svgIcon(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
  }
  function renderTools() {
    els.toolscol.innerHTML = '';
    PF_TOOLS.list.forEach(function (tool) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tl' + (tool.id === state.toolId ? ' on' : '');
      b.title = t('tool' + tool.id.charAt(0).toUpperCase() + tool.id.slice(1)) + (SHORTCUT_HINTS[tool.id] ? ' (' + SHORTCUT_HINTS[tool.id] + ')' : '');
      b.setAttribute('aria-label', t('tool' + tool.id.charAt(0).toUpperCase() + tool.id.slice(1)));
      b.dataset.tool = tool.id;
      b.innerHTML = svgIcon(TOOL_ICONS[tool.id] || '');
      b.addEventListener('click', function () { selectTool(tool.id); });
      els.toolscol.appendChild(b);
    });
    var chips = document.createElement('div');
    chips.className = 'chips';
    var c1 = document.createElement('button');
    c1.className = 'c1'; c1.style.background = state.fg; c1.title = t('color');
    c1.setAttribute('aria-label', 'Foreground color');
    var ci1 = document.createElement('input'); ci1.type = 'color'; ci1.value = state.fg;
    ci1.addEventListener('input', function () { setForeground(ci1.value, false); });
    c1.appendChild(ci1);
    var c2 = document.createElement('button');
    c2.className = 'c2'; c2.style.background = state.bg; c2.title = 'Background';
    var ci2 = document.createElement('input'); ci2.type = 'color'; ci2.value = state.bg;
    ci2.addEventListener('input', function () { state.bg = ci2.value; });
    c2.appendChild(ci2);
    chips.appendChild(c1); chips.appendChild(c2);
    els.toolscol.appendChild(chips);
  }
  var SHORTCUT_HINTS = { move: 'V', marqueeRect: 'M', lasso: 'L', wand: 'W', crop: 'C', eyedropper: 'I', brush: 'B', eraser: 'E', bucket: 'G', text: 'T', shape: 'U', hand: 'H', zoom: 'Z' };
  function selectTool(id) {
    var tool = PF_TOOLS.byId[state.toolId];
    if (tool && tool.cancel) tool.cancel();
    PF_TOOLS.clearState();
    state.toolId = id;
    renderTools();
    renderOpts();
  }
  function renderOpts() {
    var tool = PF_TOOLS.byId[state.toolId];
    els.optsbar.innerHTML = '';
    var b = document.createElement('b');
    b.textContent = t('tool' + state.toolId.charAt(0).toUpperCase() + state.toolId.slice(1));
    els.optsbar.appendChild(b);
    var vals = toolOpts();
    (tool.options || []).forEach(function (f) {
      var wrap = document.createElement('span');
      wrap.className = 'opt';
      if (f.type === 'slider') {
        var lab = document.createElement('span'); lab.textContent = t(f.param) || f.param;
        wrap.appendChild(lab);
        var r = document.createElement('input');
        r.type = 'range'; r.min = f.min; r.max = f.max; r.step = f.step; r.value = vals[f.param];
        var num = document.createElement('span'); num.textContent = vals[f.param];
        r.addEventListener('input', function () { vals[f.param] = +r.value; num.textContent = r.value; });
        wrap.appendChild(r); wrap.appendChild(num);
      } else if (f.type === 'select') {
        var lab2 = document.createElement('span'); lab2.textContent = t(f.param) || f.param;
        wrap.appendChild(lab2);
        var s = document.createElement('select');
        var opts = f.options === 'FONTS' ? FONTS.map(function (n) { return [n, n]; }) : f.options.map(function (o) { return [o, o]; });
        opts.forEach(function (o) {
          var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
          if (String(vals[f.param]) === String(o[0])) op.selected = true;
          s.appendChild(op);
        });
        s.addEventListener('change', function () { vals[f.param] = s.value; });
        wrap.appendChild(s);
      } else if (f.type === 'check') {
        var c = document.createElement('input'); c.type = 'checkbox'; c.className = 'opt-check'; c.checked = !!vals[f.param];
        var lab3 = document.createElement('span'); lab3.textContent = t(f.param) || f.param;
        c.addEventListener('change', function () { vals[f.param] = c.checked; });
        wrap.appendChild(c); wrap.appendChild(lab3);
      } else if (f.type === 'color') {
        var ci = document.createElement('input'); ci.type = 'color'; ci.value = vals[f.param];
        ci.addEventListener('input', function () { vals[f.param] = ci.value; });
        wrap.appendChild(ci);
      }
      els.optsbar.appendChild(wrap);
    });
    // mode group for selection tools
    if (tool.modeOpt) {
      var wrap = document.createElement('span');
      wrap.className = 'opt';
      var lab4 = document.createElement('span'); lab4.textContent = t('mode');
      wrap.appendChild(lab4);
      ['replace', 'add', 'subtract', 'intersect'].forEach(function (m) {
        var rb = document.createElement('button');
        rb.type = 'button'; rb.className = 'mini'; rb.textContent = t(m);
        rb.addEventListener('click', function () { selMode = m; wrap.querySelectorAll('button').forEach(function (x) { x.style.boxShadow = ''; }); rb.style.boxShadow = 'inset 0 0 0 2px rgb(var(--accent))'; });
        if (m === selMode) rb.style.boxShadow = 'inset 0 0 0 2px rgb(var(--accent))';
        wrap.appendChild(rb);
      });
      els.optsbar.appendChild(wrap);
    }
    // mask painting toggle
    var d = doc();
    var entry = d && PF_CORE.activeEntry(d);
    if (entry && entry.layer.mask) {
      var mt = document.createElement('span');
      mt.className = 'opt';
      var mb = document.createElement('button');
      mb.type = 'button'; mb.className = 'mini';
      mb.textContent = state.maskEdit ? t('layers') : t('addMask');
      mb.addEventListener('click', function () { state.maskEdit = !state.maskEdit; renderOpts(); status(state.maskEdit ? 'Painting the layer mask' : 'Painting the layer'); });
      mt.appendChild(mb);
      els.optsbar.appendChild(mt);
    }
    // Hold to compare
    var cmp = document.createElement('button');
    cmp.type = 'button'; cmp.className = 'mini'; cmp.textContent = t('holdToCompare');
    cmp.addEventListener('pointerdown', function () { startHold(); });
    cmp.addEventListener('pointerup', stopHold);
    cmp.addEventListener('pointerleave', stopHold);
    els.optsbar.appendChild(cmp);
  }
  var selMode = 'replace';
  // selection tools read the mode via state.mode set by tools
  Object.defineProperty(PF_TOOLS, 'selMode', { get: function () { return selMode; } });

  var FONTS = ['system-ui', 'ui-rounded', 'ui-serif', 'ui-monospace', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Verdana', 'Courier New'];

  // ── Layers panel ──────────────────────────────────────────────────────
  function renderBlendOptions() {
    if (els.layerBlend.options.length) return;
    PF_ENGINE.BLEND_ORDER.forEach(function (b) {
      var o = document.createElement('option');
      o.value = b;
      o.textContent = { normal: 'Normal' }[b] || b.split('-').map(function (w) { return w.charAt(0).toUpperCase() + w.slice(1); }).join(' ');
      els.layerBlend.appendChild(o);
    });
  }
  function renderPanels() {
    renderLayerList();
    renderAdjList();
    renderHistoryList();
    renderSwatches();
    updateColorUI();
    drawHistogram();
    drawNavigator();
  }
  function renderLayerList() {
    var d = doc();
    els.layerList.innerHTML = '';
    if (!d) return;
    var entries = PF_CORE.flat(d).slice().reverse();
    entries.forEach(function (en) {
      var l = en.layer;
      var row = document.createElement('div');
      row.className = 'lr' + (l.id === d.activeLayerId ? ' on' : '');
      row.setAttribute('role', 'option');
      var eye = document.createElement('button');
      eye.className = 'eye' + (l.visible ? '' : ' off');
      eye.title = t('hidden');
      eye.innerHTML = svgIcon('<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/>');
      eye.addEventListener('click', function (e) {
        e.stopPropagation();
        var before = PF_CORE.snapshotTree(d), after;
        l.visible = !l.visible;
        after = PF_CORE.snapshotTree(d);
        PF_CORE.pushStructHistory(d, before, after, 'mEnableMask');
        afterSelectionChange(); docDirty();
      });
      row.appendChild(eye);
      var lk = null;
      if (l.kind !== 'group') {
        lk = document.createElement('button');
        lk.className = 'lk' + (l.locked ? ' off' : '');
        lk.title = t('locked');
        lk.innerHTML = svgIcon(l.locked ? '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>' : '<rect x="5" y="11" width="14" height="9" rx="2" stroke-dasharray="2 2"/><path d="M8 11V7a4 4 0 0 1 7-2.8"/>');
        lk.addEventListener('click', function (e) { e.stopPropagation(); l.locked = !l.locked; renderPanels(); });
        row.appendChild(lk);
      }
      var th = document.createElement('span');
      th.className = 'th';
      var label = { raster: '', text: 'T', shape: '◆', fill: '▨', adjustment: '◐', group: '▣' }[l.kind] || '';
      th.textContent = label;
      if (l.kind === 'raster' && l.canvas) {
        var tc = document.createElement('canvas');
        tc.width = 36; tc.height = 28;
        var tcx = tc.getContext('2d');
        var sc = Math.min(36 / l.canvas.width, 28 / l.canvas.height);
        tcx.drawImage(l.canvas, 0, 0, l.canvas.width * sc, l.canvas.height * sc);
        th.innerHTML = ''; th.appendChild(tc);
      }
      row.appendChild(th);
      if (l.mask) {
        var mk = document.createElement('span');
        mk.className = 'mk'; mk.title = 'Layer mask';
        row.appendChild(mk);
      }
      var nm = document.createElement('span');
      nm.className = 'nm'; nm.textContent = l.name;
      row.appendChild(nm);
      if (l.kind === 'adjustment') {
        var bd = document.createElement('span');
        bd.className = 'badge';
        bd.textContent = t('curContrast') === 'Curves' ? adjLabel(l.adjType) : adjLabel(l.adjType);
        row.appendChild(bd);
      }
      if (l.kind === 'group') {
        var gb = document.createElement('span');
        gb.className = 'badge';
        gb.textContent = l.passThrough ? 'Pass through' : (l.children || []).length + '';
        row.appendChild(gb);
      }
      if (l.filters && l.filters.length) {
        var fb = document.createElement('span');
        fb.className = 'badge'; fb.textContent = 'ƒ' + l.filters.filter(function (f) { return f.enabled; }).length;
        row.appendChild(fb);
      }
      row.addEventListener('click', function () {
        d.activeLayerId = l.id;
        state.maskEdit = false;
        renderPanels(); renderOpts();
      });
      // drag to reorder
      row.draggable = true;
      row.addEventListener('dragstart', function (e) { e.dataTransfer.setData('text/plain', l.id); });
      row.addEventListener('dragover', function (e) { e.preventDefault(); });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        var srcId = e.dataTransfer.getData('text/plain');
        moveLayer(d, srcId, l.id);
      });
      els.layerList.appendChild(row);
    });
    var entry = PF_CORE.activeEntry(d);
    if (entry) {
      els.layerBlend.value = entry.layer.blend || 'normal';
      els.layerOpacity.value = Math.round((entry.layer.opacity == null ? 1 : entry.layer.opacity) * 100);
      els.layerClip.textContent = entry.layer.clipped ? t('unclip') : t('clip');
      els.layerMask.textContent = entry.layer.mask ? t('mInvertMask') : t('addMask');
    }
  }
  function adjLabel(id) {
    var a = PF_ADJUST.byId[id];
    if (!a) return id;
    var names = {
      brightnessContrast: 'Brightness/Contrast', levels: 'Levels', curves: 'Curves', exposure: 'Exposure',
      vibrance: 'Vibrance', hueSaturation: 'Hue/Saturation', colorBalance: 'Color Balance',
      blackWhite: 'Black & White', photoFilter: 'Photo Filter', invert: 'Invert',
      posterize: 'Posterize', threshold: 'Threshold',
    };
    return names[id] || id;
  }
  function moveLayer(d, srcId, beforeId) {
    if (srcId === beforeId) return;
    var flat = PF_CORE.flat(d);
    var src = null, dst = null;
    flat.forEach(function (en) { if (en.layer.id === srcId) src = en; if (en.layer.id === beforeId) dst = en; });
    if (!src || !dst) return;
    var before = PF_CORE.snapshotTree(d);
    src.parent.splice(src.index, 1);
    var dstFlat = PF_CORE.flat(d);
    var di = null;
    dstFlat.forEach(function (en) { if (en.layer.id === beforeId) di = en; });
    if (!di) { before.parent.splice(Math.max(0, src.index), 0, src.layer); return; }
    di.parent.splice(di.index, 0, src.layer);
    var after = PF_CORE.snapshotTree(d);
    PF_CORE.pushStructHistory(d, before, after, 'mMove');
    docDirty(); renderPanels(); repaint();
  }

  els.layerBlend.addEventListener('change', function () {
    var d = doc(); var e2 = d && PF_CORE.activeEntry(d);
    if (!e2) return;
    var before = PF_CORE.snapshotTree(d);
    e2.layer.blend = els.layerBlend.value;
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'layerBlend');
    docDirty(); repaint();
  });
  els.layerOpacity.addEventListener('change', function () {
    var d = doc(); var e2 = d && PF_CORE.activeEntry(d);
    if (!e2) return;
    var before = PF_CORE.snapshotTree(d);
    e2.layer.opacity = Math.max(0, Math.min(100, +els.layerOpacity.value || 100)) / 100;
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'opacity');
    docDirty(); repaint();
  });
  els.layerClip.addEventListener('click', function () {
    var d = doc(); var e2 = d && PF_CORE.activeEntry(d);
    if (!e2 || e2.index === 0) return;
    var before = PF_CORE.snapshotTree(d);
    e2.layer.clipped = !e2.layer.clipped;
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mNewLayer');
    docDirty(); renderPanels(); repaint();
  });
  els.layerMask.addEventListener('click', function () {
    var d = doc(); var e2 = d && PF_CORE.activeEntry(d);
    if (!e2) return;
    if (e2.layer.mask) {
      var before = PF_CORE.snapshotTree(d);
      e2.layer.mask.inverted = !e2.layer.mask.inverted;
      PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mInvertMask');
      docDirty(); renderPanels(); repaint();
    } else {
      addMask(e2.layer);
    }
  });
  function addMask(l) {
    var d = doc();
    var before = PF_CORE.snapshotTree(d);
    l.mask = { canvas: PF_CORE.makeCanvas(d.width, d.height), enabled: true, inverted: false };
    var mc = l.mask.canvas.getContext('2d');
    mc.fillStyle = '#ffffff';
    mc.fillRect(0, 0, d.width, d.height);
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mAddMask');
    docDirty(); renderPanels(); repaint();
    status('Mask added. Select Brush with black or white to paint it.');
  }
  els.layerDup.addEventListener('click', function () { menuAction('mDuplicate'); });
  els.layerDel.addEventListener('click', function () { menuAction('mDeleteLayer'); });

  function rasterizeLayer(l, label) {
    var d = doc();
    if (l.kind === 'raster') return l;
    var flat = PF_CORE.flat(d);
    var en = null;
    flat.forEach(function (e2) { if (e2.layer === l) en = e2; });
    if (!en) return null;
    var before = PF_CORE.snapshotTree(d);
    var c = PF_ENGINE.renderLayerContent(d, l, 1);
    var nl = PF_CORE.baseLayer(l.name, 'raster');
    nl.canvas = c; nl.x = 0; nl.y = 0;
    nl.opacity = l.opacity; nl.blend = l.blend; nl.clipped = l.clipped; nl.visible = l.visible;
    en.parent.splice(en.index, 1, nl);
    if (d.activeLayerId === l.id) d.activeLayerId = nl.id;
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), label || 'mRasterize');
    docDirty(); renderPanels();
    return nl;
  }

  // ── Adjustments panel ─────────────────────────────────────────────────
  function renderAdjList() {
    els.adjList.innerHTML = '';
    PF_ADJUST.list.forEach(function (a) {
      var row = document.createElement('button');
      row.type = 'button'; row.className = 'mi';
      row.innerHTML = '<span>' + adjLabel(a.id) + '</span><span class="sc">+</span>';
      row.addEventListener('click', function () { openAdjustDialog(a.id); });
      els.adjList.appendChild(row);
    });
  }
  function openAdjustDialog(id, existing) {
    var a = PF_ADJUST.byId[id];
    var params = existing ? JSON.parse(JSON.stringify(existing.params)) : defaultsOf(a);
    dialog(t('adjTitle') + ' — ' + adjLabel(id), function (body, done) {
      var pv = document.createElement('canvas');
      pv.className = 'fpreview'; pv.width = 240; pv.height = 160;
      body.appendChild(pv);
      buildParamFields(body, a, params, function () { previewAdjust(pv, id, params); });
      previewAdjust(pv, id, params);
      actions(body, done, [
        { label: t('reset'), act: function () { var d2 = defaultsOf(a); Object.keys(d2).forEach(function (k) { params[k] = d2[k]; }); body.querySelectorAll('input,select').forEach(function () {}); buildParamFields(body, a, params, function () { previewAdjust(pv, id, params); }); previewAdjust(pv, id, params); } },
        { label: t('cancel') },
        { label: t('adjApplyDirect'), act: function () {
          done();
          var d = doc(); var e2 = d && PF_CORE.activeEntry(d);
          if (!e2) return;
          applyAdjustDirect(e2.layer, id, params);
        } },
        { label: t('adjLayerAdd'), primary: true, act: function () {
          done();
          var d = doc(); var e2 = d && PF_CORE.activeEntry(d);
          if (!e2) return;
          var before = PF_CORE.snapshotTree(d);
          var l = PF_CORE.baseLayer(adjLabel(id), 'adjustment');
          l.adjType = id; l.params = JSON.parse(JSON.stringify(params));
          e2.parent.splice(e2.index + 1, 0, l);
          d.activeLayerId = l.id;
          PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'adjTitle');
          docDirty(); renderPanels(); repaint();
        } },
      ]);
    });
  }
  function defaultsOf(a) {
    var p = {};
    (a.fields || []).forEach(function (f) { p[f.param] = f.def; });
    if (a.id === 'curves') p.points = [[0, 0], [128, 128], [255, 255]];
    return p;
  }
  function previewAdjust(pv, id, params) {
    var d = doc();
    var src;
    if (state._adjPreviewSrc) src = state._adjPreviewSrc;
    else if (d) { src = PF_ENGINE.renderDoc(d, 0.2); state._adjPreviewSrc = src; }
    else { src = PF_CORE.makeCanvas(240, 160); var sc = src.getContext('2d'); sc.fillStyle = '#888'; sc.fillRect(0, 0, 240, 160); }
    var ctx = pv.getContext('2d');
    var img = src.getContext('2d').getImageData(0, 0, Math.min(src.width, 240), Math.min(src.height, 160));
    var a = PF_ADJUST.byId[id];
    try { a.apply(img.data, img.width, img.height, params); } catch (e) {}
    var tmp = PF_CORE.makeCanvas(img.width, img.height);
    tmp.getContext('2d').putImageData(img, 0, 0);
    ctx.clearRect(0, 0, pv.width, pv.height);
    ctx.drawImage(tmp, 0, 0, pv.width, pv.height);
  }
  function applyAdjustDirect(l, id, params) {
    var d = doc();
    if (l.kind !== 'raster') { l = rasterizeLayer(l, 'mRasterize'); if (!l) return; }
    var c = l.canvas, ctx = c.getContext('2d');
    var before = ctx.getImageData(0, 0, c.width, c.height);
    var img = ctx.getImageData(0, 0, c.width, c.height);
    var a = PF_ADJUST.byId[id];
    runInWorker({ op: 'adjust', adjustId: id, params: params, width: c.width, height: c.height, buffer: img.data.buffer }, function (out, err) {
      if (err) { status(err); return; }
      var after = new ImageData(new Uint8ClampedArray(out), c.width, c.height);
      ctx.putImageData(after, 0, 0);
      PF_CORE.pushPixelHistory(d, l, { x: 0, y: 0, w: c.width, h: c.height }, before, after, 'adjTitle');
      docDirty(); repaint();
    });
  }

  // ── History panel ─────────────────────────────────────────────────────
  function renderHistoryList() {
    var d = doc();
    els.historyList.innerHTML = '';
    if (!d || !d.history) return;
    els.historyNote.hidden = !d.history.dropped();
    var cur = d.history.index;
    d.history.entries.forEach(function (en, i) {
      var row = document.createElement('button');
      row.type = 'button'; row.className = 'hrow' + (i === cur ? ' on' : '');
      row.innerHTML = '<span class="hidx">' + (i + 1) + '</span><span>' + (t(en.label) || en.label) + '</span>';
      row.addEventListener('click', function () {
        d.history.jumpTo(i);
        docDirty(); updateMenuState(); renderHistoryList(); repaint();
      });
      els.historyList.appendChild(row);
    });
  }

  // ── Colour panel ──────────────────────────────────────────────────────
  function renderSwatches() {
    els.swatches.innerHTML = '';
    SWATCHES.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.style.background = c;
      b.setAttribute('aria-label', c);
      b.addEventListener('click', function () { setForeground(c, true); });
      els.swatches.appendChild(b);
    });
    els.recent.innerHTML = '';
    state.recent.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.style.background = c;
      b.setAttribute('aria-label', c);
      b.addEventListener('click', function () { setForeground(c, false); });
      els.recent.appendChild(b);
    });
  }
  function setForeground(hex, addRecent) {
    state.fg = hex;
    if (addRecent && state.recent[0] !== hex) {
      state.recent = [hex].concat(state.recent.filter(function (c) { return c !== hex; })).slice(0, 12);
    }
    renderSwatches(); updateColorUI();
  }
  function hsvToFg() {
    var h = +els.cpH.value, s = +els.cpS.value / 100, v = +els.cpV.value / 100;
    var c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    var rgb;
    if (h < 60) rgb = [c, x, 0]; else if (h < 120) rgb = [x, c, 0]; else if (h < 180) rgb = [0, c, x];
    else if (h < 240) rgb = [0, x, c]; else if (h < 300) rgb = [x, 0, c]; else rgb = [c, 0, x];
    state.fg = PF_ADJUST.rgbToHex([rgb[0] + m, rgb[1] + m, rgb[2] + m].map(function (q) { return q * 255; }));
    els.fgSwatch.style.background = state.fg;
    els.cpNative.value = state.fg;
  }
  function updateColorUI() {
    els.fgSwatch.style.background = state.fg;
    els.cpNative.value = /^#[0-9a-f]{6}$/i.test(state.fg) ? state.fg : '#000000';
  }
  [els.cpH, els.cpS, els.cpV].forEach(function (r) { r.addEventListener('input', hsvToFg); });
  els.cpNative.addEventListener('input', function () { setForeground(els.cpNative.value, true); });

  // ── Histogram and navigator ───────────────────────────────────────────
  function drawHistogram() {
    var d = doc();
    var ctx = els.histogram.getContext('2d');
    ctx.clearRect(0, 0, els.histogram.width, els.histogram.height);
    if (!d) return;
    var src = PF_ENGINE.renderDoc(d, Math.min(1, 200 / d.width));
    var img = src.getContext('2d').getImageData(0, 0, src.width, src.height).data;
    var bins = [[], [], []];
    for (var c = 0; c < 3; c++) {
      bins[c] = new Array(64).fill(0);
      for (var i = 0; i < img.length; i += 16) bins[c][img[i + c] >> 2]++;
    }
    var mx = 1;
    bins.forEach(function (b) { b.forEach(function (v) { if (v > mx) mx = v; }); });
    var w = els.histogram.width, h = els.histogram.height;
    var cols = ['rgba(220,38,38,.55)', 'rgba(22,163,74,.55)', 'rgba(37,99,235,.55)'];
    bins.forEach(function (b, ci) {
      ctx.fillStyle = cols[ci];
      for (var x = 0; x < 64; x++) {
        var bh = b[x] / mx * (h - 4);
        ctx.fillRect(x * (w / 64), h - bh, w / 64 - 0.5, bh);
      }
    });
  }
  function drawNavigator() {
    var d = doc();
    var ctx = els.navigator.getContext('2d');
    var w = els.navigator.width, h = els.navigator.height;
    ctx.clearRect(0, 0, w, h);
    if (!d) return;
    var src = PF_ENGINE.renderDoc(d, Math.min(w / d.width, h / d.height));
    var ox = (w - src.width) / 2, oy = (h - src.height) / 2;
    ctx.drawImage(src, ox, oy);
    // viewport rect
    var sw = els.stagewrap.clientWidth, sh = els.stagewrap.clientHeight;
    var v = d.view;
    var vw = Math.min(w, sw / v.zoom * (src.width / d.width)), vh = Math.min(h, sh / v.zoom * (src.height / d.height));
    ctx.strokeStyle = 'rgb(var(--accent))';
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.max(0, ox - v.panX * (src.width / d.width / v.zoom)), Math.max(0, oy - v.panY * (src.height / d.height / v.zoom)), vw, vh);
  }
  els.navigator.addEventListener('pointerdown', function (e) {
    var d = doc(); if (!d) return;
    var r = els.navigator.getBoundingClientRect();
    var src = PF_ENGINE.renderDoc(d, Math.min(r.width / d.width, r.height / d.height));
    var ox = (r.width - src.width) / 2, oy = (r.height - src.height) / 2;
    var fx = (e.clientX - r.left - ox) / (src.width || 1), fy = (e.clientY - r.top - oy) / (src.height || 1);
    var v = d.view;
    v.panX = -(fx * d.width - els.stagewrap.clientWidth / 2 / v.zoom) * v.zoom;
    v.panY = -(fy * d.height - els.stagewrap.clientHeight / 2 / v.zoom) * v.zoom;
    setPan(v.panX, v.panY);
  });

  // ── Menus ─────────────────────────────────────────────────────────────
  var FILTER_NAMES = {
    gaussianBlur: 'Gaussian Blur', boxBlur: 'Box Blur', motionBlur: 'Motion Blur', spinBlur: 'Spin Blur',
    zoomBlur: 'Zoom Blur', surfaceBlur: 'Surface Blur', unsharpMask: 'Unsharp Mask', sharpen: 'Sharpen',
    highPass: 'High Pass', addNoise: 'Add Noise', median: 'Median', dustScratches: 'Dust & Scratches',
    emboss: 'Emboss', findEdges: 'Find Edges', glowingEdges: 'Glowing Edges', pixelate: 'Pixelate',
    crystallize: 'Crystallize', colorHalftone: 'Color Halftone', oilPaint: 'Oil Paint', twirl: 'Twirl',
    pinch: 'Pinch', spherize: 'Spherize', ripple: 'Ripple', wave: 'Wave', polarCoordinates: 'Polar Coordinates',
  };

  var MENUS = [
    { id: 'file', items: [
      { label: 'mNew', act: openNew },
      { label: 'mOpen', act: function () { els.fileInput.click(); } },
      { label: 'mOpenProject', act: function () { els.pfsInput.click(); } },
      { sep: true },
      { label: 'mSaveProject', act: saveProject },
      { label: 'mExport', act: openExport },
      { sep: true },
      { label: 'mClose', act: function () { if (doc()) closeDoc(activeDocId); } },
    ] },
    { id: 'edit', items: [
      { label: 'mUndo', sc: 'Ctrl+Z', act: function () { doUndo(); } },
      { label: 'mRedo', sc: 'Ctrl+Shift+Z', act: function () { doRedo(); } },
      { sep: true },
      { label: 'mFill', act: fillSelection },
      { label: 'mContentAware', act: contentAwareFill },
    ] },
    { id: 'image', items: [
      { label: 'mImageSize', act: openImageSize },
      { label: 'mCanvasSize', act: openCanvasSize },
      { sep: true },
      { label: 'mRotateCW', act: function () { transformDoc('rotcw'); } },
      { label: 'mRotateCCW', act: function () { transformDoc('rotccw'); } },
      { label: 'mFlipH', act: function () { transformDoc('fliph'); } },
      { label: 'mFlipV', act: function () { transformDoc('flipv'); } },
      { sep: true },
      { label: 'mCropToSelection', act: cropToSelection },
    ] },
    { id: 'layer', items: [
      { label: 'mNewLayer', act: newPixelLayer },
      { label: 'mNewGroup', act: newGroup },
      { label: 'mNewFill', act: newFillLayer },
      { sep: true },
      { label: 'mDuplicate', act: duplicateLayer },
      { label: 'mMergeDown', sc: 'Ctrl+E', act: mergeDown },
      { label: 'mMergeVisible', act: mergeVisible },
      { label: 'mFlatten', sc: 'Ctrl+Shift+E', act: flattenDoc },
      { label: 'mRasterize', act: function () { var d = doc(); var e2 = d && PF_CORE.activeEntry(d); if (e2) rasterizeLayer(e2.layer, 'mRasterize'); } },
      { label: 'mDeleteLayer', act: deleteLayer },
      { sep: true },
      { label: 'mAddMask', act: function () { var d = doc(); var e2 = d && PF_CORE.activeEntry(d); if (e2 && !e2.layer.mask) addMask(e2.layer); } },
      { label: 'mDeleteMask', act: function () { layerMaskOp('delete'); } },
      { label: 'mApplyMask', act: function () { layerMaskOp('apply'); } },
      { label: 'mInvertMask', act: function () { els.layerMask.click(); } },
      { label: 'mDisableMask', act: function () { layerMaskOp('disable'); } },
      { label: 'mEnableMask', act: function () { layerMaskOp('enable'); } },
    ] },
    { id: 'select', items: [
      { label: 'mSelectAll', sc: 'Ctrl+A', act: selectAll },
      { label: 'mDeselect', sc: 'Ctrl+D', act: deselect },
      { label: 'mInvertSel', sc: 'Ctrl+Shift+I', act: invertSelection },
      { sep: true },
      { label: 'mFeather', act: function () { selAmountDialog('mFeather', function (r) { PF_ENGINE.featherSel(doc(), r); afterSelectionChange(); }); } },
      { label: 'mGrow', act: function () { selAmountDialog('mGrow', function (r) { PF_ENGINE.growSel(doc(), r); afterSelectionChange(); }); } },
      { label: 'mContract', act: function () { selAmountDialog('mContract', function (r) { PF_ENGINE.contractSel(doc(), r); afterSelectionChange(); }); } },
      { label: 'mBorder', act: function () { selAmountDialog('mBorder', function (r) { PF_ENGINE.borderSel(doc(), r); afterSelectionChange(); }); } },
    ] },
    { id: 'filter', items: PF_FILTERS.list.map(function (f) {
      return { label: filterLabel(f.id), act: function () { openFilterDialog(f.id); } };
    }) },
    { id: 'view', items: [
      { label: 'mZoomIn', sc: '+', act: function () { zoomAt(els.stagewrap.clientWidth / 2, els.stagewrap.clientHeight / 2, 1.25); } },
      { label: 'mZoomOut', sc: '−', act: function () { zoomAt(els.stagewrap.clientWidth / 2, els.stagewrap.clientHeight / 2, 1 / 1.25); } },
      { label: 'mFit', act: zoomFit },
      { label: 'mActual', act: function () { var d = doc(); if (d) { d.view.zoom = 1; layoutCanvases(); repaint(); updateStatus(); } } },
      { sep: true },
      { label: 'displayPath', act: function () {
        status(t('pathCanvas2d'));
      } },
    ] },
    { id: 'help', items: [
      { label: 'mShortcuts', act: function () {
        dialog(t('shortcutsTitle'), function (body, done) {
          var p = document.createElement('p');
          p.textContent = t('shortcutsBody');
          body.appendChild(p);
          actions(body, done, [{ label: t('ok'), primary: true }]);
        });
      } },
    ] },
  ];

  function filterLabel(id) { return FILTER_NAMES[id] || id; }

  function renderMenus() {
    els.menus.innerHTML = '';
    MENUS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'mb-btn';
      b.textContent = t(m.id === 'file' ? 'file' : m.id === 'edit' ? 'edit' : m.id === 'image' ? 'image' : m.id === 'layer' ? 'layer' : m.id === 'select' ? 'select' : m.id === 'filter' ? 'filter' : m.id === 'view' ? 'view' : 'help');
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        openMenuPop(b, m.items);
      });
      els.menus.appendChild(b);
    });
  }
  function openMenuPop(anchor, items) {
    els.menuPop.innerHTML = '';
    items.forEach(function (it) {
      if (it.sep) {
        var s = document.createElement('div'); s.className = 'mi-sep';
        els.menuPop.appendChild(s);
        return;
      }
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'mi';
      b.innerHTML = '<span>' + t(it.label) + '</span>' + (it.sc ? '<span class="sc">' + it.sc + '</span>' : '');
      b.addEventListener('click', function () {
        hideMenuPop();
        menuAction(it.label);
      });
      els.menuPop.appendChild(b);
    });
    var r = anchor.getBoundingClientRect();
    els.menuPop.style.left = r.left + 'px';
    els.menuPop.style.top = (r.bottom + 4) + 'px';
    els.menuPop.hidden = false;
  }
  function hideMenuPop() { els.menuPop.hidden = true; }
  document.addEventListener('click', hideMenuPop);
  window.addEventListener('resize', function () { hideMenuPop(); });

  function menuAction(label) {
    var d = doc();
    switch (label) {
      case 'mNew': openNew(); break;
      case 'mOpen': els.fileInput.click(); break;
      case 'mOpenProject': els.pfsInput.click(); break;
      case 'mSaveProject': saveProject(); break;
      case 'mExport': openExport(); break;
      case 'mClose': if (d) closeDoc(activeDocId); break;
      case 'mUndo': doUndo(); break;
      case 'mRedo': doRedo(); break;
      case 'mFill': fillSelection(); break;
      case 'mContentAware': contentAwareFill(); break;
      case 'mImageSize': openImageSize(); break;
      case 'mCanvasSize': openCanvasSize(); break;
      case 'mRotateCW': transformDoc('rotcw'); break;
      case 'mRotateCCW': transformDoc('rotccw'); break;
      case 'mFlipH': transformDoc('fliph'); break;
      case 'mFlipV': transformDoc('flipv'); break;
      case 'mCropToSelection': cropToSelection(); break;
      case 'mNewLayer': newPixelLayer(); break;
      case 'mNewGroup': newGroup(); break;
      case 'mNewFill': newFillLayer(); break;
      case 'mDuplicate': duplicateLayer(); break;
      case 'mMergeDown': mergeDown(); break;
      case 'mMergeVisible': mergeVisible(); break;
      case 'mFlatten': flattenDoc(); break;
      case 'mDeleteLayer': deleteLayer(); break;
      case 'mAddMask': { var e2 = d && PF_CORE.activeEntry(d); if (e2 && !e2.layer.mask) addMask(e2.layer); break; }
      case 'mDeleteMask': layerMaskOp('delete'); break;
      case 'mApplyMask': layerMaskOp('apply'); break;
      case 'mInvertMask': layerMaskOp('invert'); break;
      case 'mDisableMask': layerMaskOp('disable'); break;
      case 'mEnableMask': layerMaskOp('enable'); break;
      case 'mSelectAll': selectAll(); break;
      case 'mDeselect': deselect(); break;
      case 'mInvertSel': invertSelection(); break;
      case 'mFeather': selAmountDialog('mFeather', function (r) { PF_ENGINE.featherSel(d, r); afterSelectionChange(); }); break;
      case 'mGrow': selAmountDialog('mGrow', function (r) { PF_ENGINE.growSel(d, r); afterSelectionChange(); }); break;
      case 'mContract': selAmountDialog('mContract', function (r) { PF_ENGINE.contractSel(d, r); afterSelectionChange(); }); break;
      case 'mBorder': selAmountDialog('mBorder', function (r) { PF_ENGINE.borderSel(d, r); afterSelectionChange(); }); break;
      case 'mZoomIn': zoomAt(els.stagewrap.clientWidth / 2, els.stagewrap.clientHeight / 2, 1.25); break;
      case 'mZoomOut': zoomAt(els.stagewrap.clientWidth / 2, els.stagewrap.clientHeight / 2, 1 / 1.25); break;
      case 'mFit': zoomFit(); break;
      case 'mActual': if (d) { d.view.zoom = 1; layoutCanvases(); repaint(); updateStatus(); } break;
      case 'mShortcuts':
        dialog(t('shortcutsTitle'), function (body, done) {
          var p = document.createElement('p');
          p.textContent = t('shortcutsBody');
          body.appendChild(p);
          actions(body, done, [{ label: t('ok'), primary: true }]);
        });
        break;
      default:
        var f = PF_FILTERS.byId[label];
        if (f) { openFilterDialog(label); return; }
        status(t(label) || label);
    }
  }
  function updateMenuState() {
    var d = doc();
    els.undo.disabled = !(d && d.history && d.history.index >= 0);
    els.redo.disabled = !(d && d.history && d.history.index < d.history.entries.length - 1);
  }
  function doUndo() {
    var d = doc();
    if (!d || !d.history || !d.history.undo()) return;
    docDirty(); updateMenuState(); renderHistoryList(); renderPanels(); repaint();
  }
  function doRedo() {
    var d = doc();
    if (!d || !d.history || !d.history.redo()) return;
    docDirty(); updateMenuState(); renderHistoryList(); renderPanels(); repaint();
  }

  // ── Layer ops ─────────────────────────────────────────────────────────
  function newPixelLayer() {
    var d = doc(); if (!d) return;
    var e2 = PF_CORE.activeEntry(d);
    var l = PF_CORE.baseLayer('Layer', 'raster');
    l.canvas = PF_CORE.makeCanvas(d.width, d.height);
    if (!e2) { d.layers.push(l); } else { e2.parent.splice(e2.index + 1, 0, l); }
    d.activeLayerId = l.id;
    PF_CORE.pushHistory(d, 'mNewLayer', function () {}, function () {}, 64);
    docDirty(); renderPanels();
  }
  function newGroup() {
    var d = doc(); if (!d) return;
    var e2 = PF_CORE.activeEntry(d);
    var g = PF_CORE.baseLayer('Group', 'group');
    g.children = []; g.passThrough = false;
    if (!e2) { d.layers.push(g); } else { e2.parent.splice(e2.index + 1, 0, g); }
    d.activeLayerId = g.id;
    PF_CORE.pushHistory(d, 'mNewGroup', function () {}, function () {}, 64);
    docDirty(); renderPanels();
  }
  function newFillLayer() {
    var d = doc(); if (!d) return;
    var e2 = PF_CORE.activeEntry(d);
    var l = PF_CORE.baseLayer('Fill', 'fill');
    l.paint = { type: 'solid', color: state.fg };
    if (!e2) { d.layers.push(l); } else { e2.parent.splice(e2.index + 1, 0, l); }
    d.activeLayerId = l.id;
    PF_CORE.pushHistory(d, 'mNewFill', function () {}, function () {}, 64);
    docDirty(); renderPanels(); repaint();
  }
  function addLayerAbove(entry, l, label) {
    var d = doc();
    entry.parent.splice(entry.index + 1, 0, l);
    d.activeLayerId = l.id;
    PF_CORE.pushHistory(d, label, function () {}, function () {}, 64);
    docDirty(); renderPanels(); repaint();
  }
  function deleteLayer() {
    var d = doc(); if (!d) return;
    var e2 = PF_CORE.activeEntry(d); if (!e2) return;
    var before = PF_CORE.snapshotTree(d);
    e2.parent.splice(e2.index, 1);
    PF_CORE.fixActive(d);
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mDeleteLayer');
    docDirty(); renderPanels(); repaint();
  }
  function duplicateLayer() {
    var d = doc(); if (!d) return;
    var e2 = PF_CORE.activeEntry(d); if (!e2) return;
    var before = PF_CORE.snapshotTree(d);
    var l = e2.layer;
    var copy2 = PF_CORE.cloneLayerMeta(l);
    copy2.name = l.name + ' copy';
    copy2.id = PF_CORE.uid('l');
    if (l.kind === 'raster' && l.canvas) {
      var c = PF_CORE.makeCanvas(l.canvas.width, l.canvas.height);
      c.getContext('2d').drawImage(l.canvas, 0, 0);
      copy2.canvas = c;
    }
    if (l.mask) {
      var m = PF_CORE.makeCanvas(l.mask.canvas.width, l.mask.canvas.height);
      m.getContext('2d').drawImage(l.mask.canvas, 0, 0);
      copy2.mask = { canvas: m, enabled: l.mask.enabled, inverted: l.mask.inverted };
    }
    e2.parent.splice(e2.index + 1, 0, copy2);
    d.activeLayerId = copy2.id;
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mDuplicate');
    docDirty(); renderPanels(); repaint();
  }
  function flattenLayers(d, layers, label) {
    var before = PF_CORE.snapshotTree(d);
    var c = PF_ENGINE.renderStack(d, layers, 1);
    var l = PF_CORE.baseLayer(label === 'mFlatten' ? 'Background' : 'Merged', 'raster');
    l.canvas = c;
    d.layers = [l];
    d.activeLayerId = l.id;
    d.selection = null;
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), label);
    docDirty(); renderPanels(); repaint(); afterSelectionChange();
  }
  function mergeDown() {
    var d = doc(); if (!d) return;
    var e2 = PF_CORE.activeEntry(d); if (!e2 || e2.index === 0) { status('Nothing below to merge'); return; }
    var before = PF_CORE.snapshotTree(d);
    var below = e2.parent[e2.index - 1];
    var c = PF_ENGINE.renderStack(d, [below, e2.layer], 1);
    var l = PF_CORE.baseLayer(below.name, 'raster');
    l.canvas = c;
    e2.parent.splice(e2.index - 1, 2, l);
    d.activeLayerId = l.id;
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mMergeDown');
    docDirty(); renderPanels(); repaint();
  }
  function mergeVisible() {
    var d = doc(); if (!d) return;
    var visible = d.layers.filter(function (l) { return l.visible; });
    if (!visible.length) return;
    var before = PF_CORE.snapshotTree(d);
    var c = PF_ENGINE.renderStack(d, visible, 1);
    var l = PF_CORE.baseLayer('Merged', 'raster');
    l.canvas = c;
    d.layers = d.layers.filter(function (l2) { return !l2.visible; });
    d.layers.push(l);
    d.activeLayerId = l.id;
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mMergeVisible');
    docDirty(); renderPanels(); repaint();
  }
  function flattenDoc() {
    var d = doc(); if (!d) return;
    flattenLayers(d, d.layers, 'mFlatten');
  }
  function layerMaskOp(op) {
    var d = doc(); if (!d) return;
    var e2 = PF_CORE.activeEntry(d); if (!e2 || !e2.layer.mask) return;
    var l = e2.layer;
    var before = PF_CORE.snapshotTree(d);
    if (op === 'delete') l.mask = null;
    else if (op === 'disable') l.mask.enabled = false;
    else if (op === 'enable') l.mask.enabled = true;
    else if (op === 'invert') l.mask.inverted = !l.mask.inverted;
    else if (op === 'apply') {
      // bake mask into a raster copy of the content
      var content = PF_ENGINE.renderLayerContent(d, l.kind === 'raster' ? l : Object.assign({}, l, { x: 0, y: 0 }), 1);
      var masked = PF_CORE.makeCanvas(d.width, d.height);
      var mctx = masked.getContext('2d');
      mctx.drawImage(content, l.x || 0, l.y || 0);
      var mc = PF_CORE.makeCanvas(d.width, d.height);
      mc.getContext('2d').drawImage(l.mask.canvas, 0, 0);
      if (l.mask.inverted) {
        var ic = mc.getContext('2d');
        var idata = ic.getImageData(0, 0, d.width, d.height);
        for (var i = 3; i < idata.data.length; i += 4) idata.data[i] = 255 - idata.data[i];
        ic.putImageData(idata, 0, 0);
      }
      mctx.globalCompositeOperation = 'destination-in';
      mctx.drawImage(mc, 0, 0);
      var nl = PF_CORE.baseLayer(l.name, 'raster');
      nl.canvas = masked;
      nl.opacity = l.opacity; nl.blend = l.blend; nl.clipped = l.clipped; nl.visible = l.visible;
      e2.parent.splice(e2.index, 1, nl);
      if (d.activeLayerId === l.id) d.activeLayerId = nl.id;
    }
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mApplyMask');
    docDirty(); renderPanels(); repaint();
  }

  // ── Selection ops ─────────────────────────────────────────────────────
  function selectAll() { var d = doc(); if (!d) return; d.selection = PF_ENGINE.selAll(d); afterSelectionChange(); }
  function deselect() { var d = doc(); if (!d) return; d.selection = null; afterSelectionChange(); }
  function invertSelection() { var d = doc(); if (!d) return; PF_ENGINE.invertSel(d); afterSelectionChange(); }
  function afterSelectionChange() {
    var d = doc();
    if (d) { d._antsPath = null; }
    repaintOverlay(); renderPanels();
  }
  function selAmountDialog(label, apply) {
    var d = doc();
    if (!d || !d.selection) { status(t('scopeNoSel')); return; }
    dialog(t(label), function (body, done) {
      var r = field(body, t('amount'), input('number', label === 'mFeather' ? 4 : 2, 1, 100));
      actions(body, done, [
        { label: t('cancel') },
        { label: t('apply'), primary: true, act: function () { done(); apply(+r.value || 1); } },
      ]);
    });
  }
  function cropToSelection() {
    var d = doc();
    if (!d || !d.selection) { status(t('scopeNoSel')); return; }
    var b = d.selection.bounds;
    applyCropRect(b);
  }
  function setCropDraft(r) {
    state.cropDraft = r;
    els.cropOk.hidden = !r;
  }

  // ── Image / canvas transforms ─────────────────────────────────────────
  function transformDoc(kind) {
    var d = doc(); if (!d) return;
    PF_CORE.flat(d).forEach(function (en) {
      var l = en.layer;
      if (l.kind !== 'raster' && l.kind !== 'fill' && l.kind !== 'adjustment') rasterizeLayer(l, 'mRasterize');
    });
    var before = PF_CORE.snapshotTree(d);
    if (kind === 'rotcw' || kind === 'rotccw') {
      var nw = d.height, nh = d.width;
      d.layers.forEach(function (l) {
        if (l.kind === 'raster' && l.canvas) {
          var c = PF_CORE.makeCanvas(l.canvas.height, l.canvas.width);
          var ctx = c.getContext('2d');
          ctx.translate(c.width / 2, c.height / 2);
          ctx.rotate(kind === 'rotcw' ? Math.PI / 2 : -Math.PI / 2);
          ctx.drawImage(l.canvas, -l.canvas.width / 2, -l.canvas.height / 2);
          l.canvas = c;
        }
      });
      d.width = nw; d.height = nh;
    } else {
      d.layers.forEach(function (l) {
        if (l.kind === 'raster' && l.canvas) {
          var c2 = PF_CORE.makeCanvas(l.canvas.width, l.canvas.height);
          var ctx2 = c2.getContext('2d');
          ctx2.translate(kind === 'fliph' ? c2.width : 0, kind === 'flipv' ? c2.height : 0);
          ctx2.scale(kind === 'fliph' ? -1 : 1, kind === 'flipv' ? -1 : 1);
          ctx2.drawImage(l.canvas, 0, 0);
          l.canvas = c2;
        }
      });
    }
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mFlipH');
    d.original = PF_ENGINE.renderDoc(d, 1);
    fitView(); docDirty(); renderPanels(); repaint(); updateStatus(); layoutCanvases();
  }
  function openImageSize() {
    var d = doc(); if (!d) return;
    dialog(t('imageSizeTitle'), function (body, done) {
      var w = field(body, t('width'), input('number', d.width, 1, 16384));
      var h = field(body, t('height'), input('number', d.height, 1, 16384));
      var note = document.createElement('p');
      note.className = 'dval';
      note.textContent = d.width + ' × ' + d.height + ' → ' + w.value + ' × ' + h.value;
      w.addEventListener('input', function () { note.textContent = d.width + ' × ' + d.height + ' → ' + w.value + ' × ' + (h.value = Math.round(+w.value * d.height / d.width) || 1); });
      body.appendChild(note);
      actions(body, done, [
        { label: t('cancel') },
        { label: t('apply'), primary: true, act: function () {
          done();
          var nw = Math.max(1, Math.min(16384, +w.value | 0)), nh = Math.max(1, Math.min(16384, +h.value | 0));
          var before = PF_CORE.snapshotTree(d);
          PF_CORE.flat(d).forEach(function (en) {
            var l = en.layer;
            if (l.kind !== 'raster') rasterizeLayer(l, 'mRasterize');
          });
          d.layers.forEach(function (l) {
            if (l.kind === 'raster' && l.canvas) {
              var c = PF_CORE.makeCanvas(nw, nh);
              c.getContext('2d').drawImage(l.canvas, 0, 0, nw, nh);
              l.canvas = c;
            }
          });
          d.width = nw; d.height = nh;
          PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mImageSize');
          d.original = PF_ENGINE.renderDoc(d, 1);
          fitView(); docDirty(); renderPanels(); repaint(); updateStatus(); layoutCanvases();
        } },
      ]);
    });
  }
  function openCanvasSize() {
    var d = doc(); if (!d) return;
    dialog(t('canvasSizeTitle'), function (body, done) {
      var w = field(body, t('width'), input('number', d.width, 1, 16384));
      var h = field(body, t('height'), input('number', d.height, 1, 16384));
      actions(body, done, [
        { label: t('cancel') },
        { label: t('apply'), primary: true, act: function () {
          done();
          var nw = Math.max(1, Math.min(16384, +w.value | 0)), nh = Math.max(1, Math.min(16384, +h.value | 0));
          var dx = Math.round((nw - d.width) / 2), dy = Math.round((nh - d.height) / 2);
          var before = PF_CORE.snapshotTree(d);
          PF_CORE.flat(d).forEach(function (en) {
            var l = en.layer;
            if (l.kind === 'raster' && l.canvas) {
              var c = PF_CORE.makeCanvas(nw, nh);
              c.getContext('2d').drawImage(l.canvas, dx, dy);
              l.canvas = c;
            } else if (l.x != null) { l.x += dx; l.y += dy; }
          });
          d.width = nw; d.height = nh;
          PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mCanvasSize');
          d.original = PF_ENGINE.renderDoc(d, 1);
          fitView(); docDirty(); renderPanels(); repaint(); updateStatus(); layoutCanvases();
        } },
      ]);
    });
  }
  function applyCropRect(b) {
    var d = doc(); if (!d || !b || b.w < 2 || b.h < 2) return;
    var before = PF_CORE.snapshotTree(d);
    PF_CORE.flat(d).forEach(function (en) {
      var l = en.layer;
      if (l.kind === 'raster' && l.canvas) {
        var c = PF_CORE.makeCanvas(b.w, b.h);
        c.getContext('2d').drawImage(l.canvas, -(b.x - (l.x || 0)), -(b.y - (l.y || 0)));
        l.canvas = c;
        l.x = 0; l.y = 0;
      } else if (l.x != null) { l.x -= b.x; l.y -= b.y; }
    });
    d.width = b.w; d.height = b.h;
    d.selection = null;
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mCropToSelection');
    d.original = PF_ENGINE.renderDoc(d, 1);
    setCropDraft(null);
    fitView(); docDirty(); renderPanels(); repaint(); updateStatus(); layoutCanvases(); afterSelectionChange();
  }

  // ── Fill / content-aware fill / heal ──────────────────────────────────
  function fillSelection() {
    var d = doc(); if (!d) return;
    var e2 = PF_CORE.activeEntry(d); if (!e2) return;
    var l = e2.layer;
    if (l.kind !== 'raster') { l = rasterizeLayer(l, 'mRasterize'); if (!l) return; }
    var c = l.canvas, ctx = c.getContext('2d');
    ctx.save();
    ctx.fillStyle = state.fg;
    var selCanvas = PF_ENGINE.maskCanvas(d);
    if (selCanvas) {
      var tmp = PF_CORE.makeCanvas(c.width, c.height);
      var tc = tmp.getContext('2d');
      tc.fillStyle = state.fg;
      tc.fillRect(0, 0, c.width, c.height);
      tc.globalCompositeOperation = 'destination-in';
      tc.drawImage(selCanvas, -(l.x || 0), -(l.y || 0));
      ctx.drawImage(tmp, 0, 0);
    } else {
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.restore();
    PF_CORE.pushHistory(d, 'mFill', function () {}, function () {}, 0);
    docDirty(); repaint();
  }
  function contentAwareFill() {
    var d = doc(); if (!d) return;
    if (!d.selection) { status(t('scopeNoSel')); return; }
    var e2 = PF_CORE.activeEntry(d); if (!e2 || e2.layer.kind !== 'raster') return;
    var l = e2.layer;
    var b = d.selection.bounds;
    if (b.w * b.h > d.width * d.height * 0.25) { status(t('scopeInpaintBig')); return; }
    dialog(t('scopeInpaintTitle'), function (body, done) {
      var p = document.createElement('p');
      p.className = 'scope-note';
      p.textContent = t('scopeInpaintDone');
      body.appendChild(p);
      var prog = document.createElement('div');
      prog.className = 'dprog'; prog.innerHTML = '<i></i>';
      body.appendChild(prog);
      actions(body, done, [
        { label: t('cancel') },
        { label: t('apply'), primary: true, act: function () {
          done();
          inpaintRegion(l, b, d.selection, function (before, after, rect) {
            PF_CORE.pushPixelHistory(d, l, rect, before, after, 'mContentAware');
            docDirty(); repaint();
            status(t('scopeInpaintDone'));
          });
        } },
      ]);
    });
  }
  function inpaintRegion(l, rect, sel, cb) {
    var c = l.canvas, ctx = c.getContext('2d');
    var rx = Math.max(0, rect.x - (l.x || 0)), ry = Math.max(0, rect.y - (l.y || 0));
    var rw = Math.min(c.width - rx, rect.w + 4), rh = Math.min(c.height - ry, rect.h + 4);
    if (rw <= 0 || rh <= 0) return;
    var before = ctx.getImageData(rx, ry, rw, rh);
    var img = ctx.getImageData(rx, ry, rw, rh);
    var dpx = img.data;
    var w = rw, h = rh;
    // mask of pixels to fill: selection intersected with this rect
    var fill = new Uint8Array(w * h);
    var doc = doc();
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var gx = rx + x + (l.x || 0), gy = ry + y + (l.y || 0);
        if (gx >= 0 && gy >= 0 && gx < doc.width && gy < doc.height && sel.mask[gy * doc.width + gx]) fill[y * w + x] = 1;
      }
    }
    // Gauss-Seidel diffusion from boundary colours
    var data = dpx;
    for (var it = 0; it < 120; it++) {
      for (y = 0; y < h; y++) {
        for (x = 0; x < w; x++) {
          if (!fill[y * w + x]) continue;
          var i4 = (y * w + x) * 4;
          var n = 0, sr = 0, sg = 0, sb = 0;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (dq) {
            var xx = x + dq[0], yy = y + dq[1];
            if (xx < 0 || yy < 0 || xx >= w || yy >= h) return;
            var j4 = (yy * w + xx) * 4;
            if (fill[yy * w + xx] && it < 1) return;
            sr += data[j4]; sg += data[j4 + 1]; sb += data[j4 + 2]; n++;
          });
          if (n) { data[i4] = sr / n; data[i4 + 1] = sg / n; data[i4 + 2] = sb / n; }
        }
      }
    }
    var after = new ImageData(new Uint8ClampedArray(dpx), w, h);
    ctx.putImageData(after, rx, ry);
    cb(before, after, { x: rx, y: ry, w: w, h: h });
  }
  function healRegion(l, pts) {
    if (!pts.length) return;
    var xs = pts.map(function (q) { return q.x - (l.x || 0); }), ys = pts.map(function (q) { return q.y - (l.y || 0); });
    var r = (toolOpts().size || 24) / 2;
    var rect = { x: Math.max(0, Math.min.apply(null, xs) - r), y: Math.max(0, Math.min.apply(null, ys) - r), w: 0, h: 0 };
    rect.w = Math.min(l.canvas.width - rect.x, Math.max.apply(null, xs) + r - rect.x);
    rect.h = Math.min(l.canvas.height - rect.y, Math.max.apply(null, ys) + r - rect.y);
    if (rect.w <= 2 || rect.h <= 2) return;
    var doc = doc();
    var sel = { width: doc.width, height: doc.height, mask: new Uint8Array(doc.width * doc.height), bounds: rect };
    pts.forEach(function (q) {
      var gx = Math.round(q.x), gy = Math.round(q.y);
      for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
        var xx = gx + dx, yy = gy + dy;
        if (xx >= 0 && yy >= 0 && xx < doc.width && yy < doc.height && dx * dx + dy * dy <= r * r) sel.mask[yy * doc.width + xx] = 255;
      }
    });
    inpaintRegion(l, rect, sel, function (before, after, r2) {
      PF_CORE.pushPixelHistory(doc, l, r2, before, after, 'toolHeal');
      docDirty(); repaint();
    });
  }

  // ── Filter dialog ─────────────────────────────────────────────────────
  function openFilterDialog(filterId) {
    var d = doc(); if (!d) return;
    var e2 = PF_CORE.activeEntry(d); if (!e2) return;
    var f = PF_FILTERS.byId[filterId];
    var params = defaultsOf(f);
    if (params.seed == null) params.seed = 1;
    dialog(t('filterTitle') + ' — ' + filterLabel(filterId), function (body, done) {
      var pv = document.createElement('canvas');
      pv.className = 'fpreview'; pv.width = 280; pv.height = 180;
      body.appendChild(pv);
      var hint = document.createElement('p');
      hint.className = 'dval';
      hint.textContent = t('previewOf');
      body.appendChild(hint);
      var debounceTimer = 0;
      function schedule() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () { previewFilter(pv, filterId, params); }, 150);
      }
      buildParamFields(body, f, params, schedule);
      previewFilter(pv, filterId, params);
      actions(body, done, [
        { label: t('reset'), act: function () {
          var d2 = defaultsOf(f);
          if (d2.seed == null) d2.seed = 1;
          Object.keys(d2).forEach(function (k) { params[k] = d2[k]; });
          buildParamFields(body, f, params, schedule);
          previewFilter(pv, filterId, params);
        } },
        { label: t('cancel') },
        { label: 'ƒ ' + t('adjLayerAdd'), act: function () {
          done();
          addSmartFilter(e2.layer, filterId, params);
        } },
        { label: t('apply'), primary: true, act: function () {
          done();
          var l = e2.layer;
          if (l.kind !== 'raster') { l = rasterizeLayer(l, 'mRasterize'); if (!l) return; }
          applyFilterDirect(l, filterId, params);
        } },
      ]);
    });
  }
  function addSmartFilter(l, filterId, params) {
    var d = doc();
    var before = PF_CORE.snapshotTree(d);
    l.filters.push({ id: PF_CORE.uid('sf'), filterId: filterId, params: JSON.parse(JSON.stringify(params)), enabled: true });
    PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'mFilterGallery');
    docDirty(); renderPanels(); repaint();
    status('Smart filter added. The layer’s own pixels stay untouched; reorder or remove it in the Layers panel.');
  }
  function applyFilterDirect(l, filterId, params) {
    var d = doc();
    var c = l.canvas, ctx = c.getContext('2d');
    var before = ctx.getImageData(0, 0, c.width, c.height);
    var prog = null;
    runInWorker({ op: 'filter', filterId: filterId, params: params, width: c.width, height: c.height, buffer: before.data.buffer.slice(0) }, function (out, err) {
      if (err) { status(err); return; }
      var after = new ImageData(new Uint8ClampedArray(out), c.width, c.height);
      ctx.putImageData(after, 0, 0);
      PF_CORE.pushPixelHistory(d, l, { x: 0, y: 0, w: c.width, h: c.height }, before, after, 'mFilterGallery');
      docDirty(); repaint();
    }, function (pct) {
      status(t('filterApplyTitle') + ' ' + Math.round(pct * 100) + '%');
    });
  }
  function previewFilter(pv, filterId, params) {
    var d = doc();
    if (!state._filterPreviewSrc) {
      state._filterPreviewSrc = PF_ENGINE.renderDoc(d, Math.min(0.25, 280 / d.width));
    }
    var src = state._filterPreviewSrc;
    var img = src.getContext('2d').getImageData(0, 0, src.width, src.height);
    var f = PF_FILTERS.byId[filterId];
    var p2 = JSON.parse(JSON.stringify(params));
    runInWorker({ op: 'filter', filterId: filterId, params: p2, width: img.width, height: img.height, buffer: img.data.buffer.slice(0) }, function (out, err) {
      if (err) return;
      var ctx = pv.getContext('2d');
      var tmp = PF_CORE.makeCanvas(img.width, img.height);
      tmp.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(out), img.width, img.height), 0, 0);
      ctx.clearRect(0, 0, pv.width, pv.height);
      var sc = Math.min(pv.width / img.width, pv.height / img.height);
      ctx.drawImage(tmp, (pv.width - img.width * sc) / 2, (pv.height - img.height * sc) / 2, img.width * sc, img.height * sc);
    });
  }

  // ── Worker plumbing ───────────────────────────────────────────────────
  var worker = null;
  var workerJobs = {};
  var jobId = 0;
  function getWorker() {
    if (worker) return worker;
    try {
      worker = new Worker('/filters-worker.js');
      worker.onmessage = function (e) {
        var m = e.data;
        var job = workerJobs[m.id];
        if (!job) return;
        delete workerJobs[m.id];
        if (m.op === 'error') job.onDone(null, m.message);
        else job.onDone(m.buffer, null);
      };
      worker.onerror = function () {
        worker = null;
        Object.keys(workerJobs).forEach(function (k) {
          workerJobs[k].onDone(null, 'Worker failed');
          delete workerJobs[k];
        });
      };
    } catch (e) {
      worker = null;
      return null;
    }
    return worker;
  }
  function runInWorker(msg, onDone, onProgress) {
    var w = getWorker();
    if (!w) {
      // synchronous fallback with the same pure functions
      try {
        if (msg.op === 'filter') {
          var f = PF_FILTERS.byId[msg.filterId];
          var data = new Uint8ClampedArray(msg.buffer);
          var out = f.apply(data, msg.width, msg.height, msg.params);
          onDone(out.buffer, null);
        } else {
          var a = PF_ADJUST.byId[msg.adjustId];
          var d2 = new Uint8ClampedArray(msg.buffer);
          a.apply(d2, msg.width, msg.height, msg.params);
          onDone(d2.buffer, null);
        }
      } catch (err) { onDone(null, String(err)); }
      return;
    }
    var id = ++jobId;
    workerJobs[id] = { onDone: onDone, onProgress: onProgress };
    msg.id = id;
    w.postMessage(msg, [msg.buffer]);
  }

  // ── Param fields builder ──────────────────────────────────────────────
  function buildParamFields(body, def, params, onChange) {
    var old = body.querySelector('.params');
    if (old) old.remove();
    var wrap = document.createElement('div');
    wrap.className = 'params';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '8px';
    (def.fields || []).forEach(function (f) {
      if (f.type === 'hidden') return;
      var row = document.createElement('label');
      row.className = 'drow';
      var lab = document.createElement('span');
      lab.textContent = t(f.param) || f.param;
      row.appendChild(lab);
      if (f.type === 'slider') {
        var r = document.createElement('input');
        r.type = 'range'; r.min = f.min; r.max = f.max; r.step = f.step; r.value = params[f.param];
        var v = document.createElement('span');
        v.className = 'dval'; v.textContent = params[f.param];
        r.addEventListener('input', function () { params[f.param] = +r.value; v.textContent = r.value; onChange && onChange(); });
        row.appendChild(r); row.appendChild(v);
      } else if (f.type === 'check') {
        var c = document.createElement('input');
        c.type = 'checkbox'; c.checked = !!params[f.param];
        c.addEventListener('change', function () { params[f.param] = c.checked; onChange && onChange(); });
        row.appendChild(c);
      } else if (f.type === 'color') {
        var ci = document.createElement('input');
        ci.type = 'color'; ci.value = params[f.param];
        ci.addEventListener('input', function () { params[f.param] = ci.value; onChange && onChange(); });
        row.appendChild(ci);
      } else if (f.type === 'curves') {
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.value = (params[f.param] || []).map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
        inp.setAttribute('aria-label', 'Curve points');
        inp.addEventListener('change', function () {
          var pts = inp.value.split(/\s+/).map(function (pair) {
            var xy = pair.split(',').map(Number);
            return (xy.length === 2 && isFinite(xy[0]) && isFinite(xy[1])) ? xy : null;
          }).filter(Boolean);
          if (pts.length >= 2) { params[f.param] = pts; onChange && onChange(); }
        });
        var h = document.createElement('span');
        h.className = 'dval';
        h.textContent = 'Points as x,y pairs, e.g. 0,0 128,150 255,255';
        row.appendChild(inp); row.appendChild(h);
      } else if (f.type === 'select') {
        var s = document.createElement('select');
        f.options.forEach(function (o) {
          var op = document.createElement('option');
          op.value = o; op.textContent = o;
          if (params[f.param] === o) op.selected = true;
          s.appendChild(op);
        });
        s.addEventListener('change', function () { params[f.param] = s.value; onChange && onChange(); });
        row.appendChild(s);
      }
      wrap.appendChild(row);
    });
    body.appendChild(wrap);
  }

  // ── Text layer editing ────────────────────────────────────────────────
  function editTextLayer(l) {
    dialog(t('kindText'), function (body, done) {
      var txt = field(body, 'Text', document.createElement('textarea'));
      txt.value = l.text || '';
      txt.rows = 3;
      var size = field(body, t('fontSize'), input('number', l.font.size, 6, 400));
      var fam = field(body, t('font'), select(FONTS.map(function (n) { return [n, n]; }), l.font.family));
      var col = field(body, t('color'), input('color', l.color));
      var wt = field(body, t('weight'), select([['400', 'Regular'], ['700', 'Bold'], ['400 italic', 'Italic']], l.font.weight));
      actions(body, done, [
        { label: t('cancel') },
        { label: t('apply'), primary: true, act: function () {
          done();
          var d = doc();
          var before = PF_CORE.snapshotTree(d);
          l.text = txt.value;
          l.font.size = +size.value || l.font.size;
          l.font.family = fam.value;
          l.color = col.value;
          var w = wt.value.split(' ');
          l.font.weight = w[0];
          l.font.style = w[1] || 'normal';
          l.name = String(l.text).split('\n')[0].slice(0, 24) || 'Text';
          PF_CORE.pushStructHistory(d, before, PF_CORE.snapshotTree(d), 'toolText');
          docDirty(); renderPanels(); repaint();
        } },
      ]);
    });
  }
  els.canvas.addEventListener('dblclick', function (e) {
    var d = doc(); if (!d) return;
    var entry = PF_CORE.activeEntry(d);
    if (entry && entry.layer.kind === 'text') editTextLayer(entry.layer);
  });

  // ── Dialog plumbing ───────────────────────────────────────────────────
  function dialog(title, build) {
    els.backdrop.hidden = false;
    els.dialogBox.innerHTML = '';
    var h = document.createElement('h3');
    h.textContent = title;
    els.dialogBox.appendChild(h);
    var closeBtn = function () { els.backdrop.hidden = true; };
    build(els.dialogBox, closeBtn);
    els.backdrop.addEventListener('click', function (e) {
      if (e.target === els.backdrop) closeBtn();
    }, { once: true });
  }
  function field(body, label, inputEl) {
    var row = document.createElement('label');
    row.className = 'drow';
    var s = document.createElement('span');
    s.textContent = label;
    row.appendChild(s);
    row.appendChild(inputEl);
    body.appendChild(row);
    return inputEl;
  }
  function input(type, value, min, max) {
    var i = document.createElement('input');
    i.type = type;
    if (value != null) i.value = value;
    if (min != null) i.min = min;
    if (max != null) i.max = max;
    return i;
  }
  function select(pairs, value) {
    var s = document.createElement('select');
    pairs.forEach(function (p) {
      var o = document.createElement('option');
      o.value = p[0]; o.textContent = p[1];
      if (value != null && String(value) === String(p[0])) o.selected = true;
      s.appendChild(o);
    });
    return s;
  }
  function actions(body, done, list) {
    var bar = document.createElement('div');
    bar.className = 'dlg-actions';
    list.forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = a.primary ? 'btn-primary' : 'btn-secondary';
      b.textContent = a.label;
      b.addEventListener('click', function () {
        if (a.act) a.act();
        if (!a.primary || a.label === t('cancel') || a.label === t('ok')) done();
        else done();
      });
      bar.appendChild(b);
    });
    body.appendChild(bar);
  }

  // ── Open files ────────────────────────────────────────────────────────
  els.fileInput.addEventListener('change', function () {
    var file = els.fileInput.files[0];
    els.fileInput.value = '';
    if (file) openImageFile(file);
  });
  els.pfsInput.addEventListener('change', function () {
    var file = els.pfsInput.files[0];
    els.pfsInput.value = '';
    if (file) openPfsFile(file);
  });
  function openImageFile(file) {
    var isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
    var isGif = /gif/i.test(file.type);
    var name = file.name.replace(/\.[^.]+$/, '');
    if (isSvg) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        URL.revokeObjectURL(url);
        var w = Math.min(8192, im.naturalWidth || 512), h = Math.min(8192, im.naturalHeight || 512);
        var d = PF_CORE.createDoc(name, w, h, null);
        var l = PF_CORE.baseLayer(name, 'raster');
        l.canvas = PF_CORE.makeCanvas(w, h);
        l.canvas.getContext('2d').drawImage(im, 0, 0, w, h);
        d.layers.push(l);
        d.activeLayerId = l.id;
        d.original = PF_ENGINE.renderDoc(d, 1);
        addDoc(d);
        status(t('scopeSvg'));
      };
      im.onerror = function () { status(t('scopeOpenFailed')); };
      im.src = url;
      return;
    }
    file.arrayBuffer().then(function (buf) {
      return createImageBitmap(new Blob([buf], { type: file.type }));
    }).then(function (bm) {
      var d = PF_CORE.createDoc(name, bm.width, bm.height, null);
      var l = PF_CORE.baseLayer(name, 'raster');
      l.canvas = PF_CORE.makeCanvas(bm.width, bm.height);
      l.canvas.getContext('2d').drawImage(bm, 0, 0);
      bm.close && bm.close();
      d.layers.push(l);
      d.activeLayerId = l.id;
      d.original = PF_ENGINE.renderDoc(d, 1);
      addDoc(d);
      if (isGif) status(t('scopeGif'));
    }).catch(function () {
      status(t('scopeOpenFailed'));
    });
  }
  function openPfsFile(file) {
    PF_PFS.decode(file, PF_CORE).then(function (d) {
      d.original = PF_ENGINE.renderDoc(d, 1);
      addDoc(d);
      status(t('openedProject'));
    }).catch(function (err) {
      status(/too-new/.test(String(err)) ? t('pfsTooNew') : t('pfsBad'));
    });
  }

  // ── Export / save project ─────────────────────────────────────────────
  var avifOk = null;
  function probeAvif() {
    if (avifOk != null) return Promise.resolve(avifOk);
    var c = PF_CORE.makeCanvas(1, 1);
    return new Promise(function (resolve) {
      c.toBlob(function (b) {
        avifOk = !!(b && b.type === 'image/avif');
        resolve(avifOk);
      }, 'image/avif');
    });
  }
  function openExport() {
    var d = doc(); if (!d) return;
    probeAvif().then(function (avif) {
      dialog(t('exportTitle'), function (body, done) {
        var fmt = field(body, t('format'), select([
          ['image/png', 'PNG'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP'],
        ].concat(avif ? [['image/avif', 'AVIF']] : []).concat([['psd', 'PSD (flattened, pixels only)']])));
        var q = field(body, t('quality'), input('range', 92, 1, 100));
        var scale = field(body, t('scale'), select([['0.5', '0.5x'], ['1', '1x'], ['2', '2x'], ['3', '3x'], ['4', '4x']], '1'));
        var res = document.createElement('p');
        res.className = 'dval';
        function upd() {
          var s = +scale.value;
          res.textContent = t('resultSize') + ': ' + Math.round(d.width * s) + ' × ' + Math.round(d.height * s) + ' px';
        }
        scale.addEventListener('change', upd); upd();
        body.appendChild(res);
        if (!avif) {
          var n = document.createElement('p');
          n.className = 'scope-note';
          n.textContent = t('avifUnsupported');
          body.appendChild(n);
        }
        var jp = document.createElement('p');
        jp.className = 'dval'; jp.textContent = t('jpegTransparency');
        body.appendChild(jp);
        actions(body, done, [
          { label: t('cancel') },
          { label: t('exportBtn'), primary: true, act: function () { done(); doExport(fmt.value, +q.value / 100, +scale.value); } },
        ]);
      });
    });
  }
  function doExport(type, quality, scale) {
    var d = doc(); if (!d) return;
    var w = Math.round(d.width * scale), h = Math.round(d.height * scale);
    if (w > 16384 || h > 16384 || w * h > 268 * 1024 * 1024) { status(t('exportTooBig')); return; }
    if (type === 'psd') {
      // PSD export writes layers as pixels; keep the merged composite for now
      status(t('savedProject'));
      exportBlob(buildPsdLike(d), d.name + '.psd');
      return;
    }
    var src = PF_ENGINE.renderDoc(d, 1);
    var c = PF_CORE.makeCanvas(w, h);
    var ctx = c.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(src, 0, 0, w, h);
    c.toBlob(function (b) {
      if (!b) { status(t('scopeOpenFailed')); return; }
      var ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' }[type] || 'png';
      exportBlob(b, d.name + '.' + ext);
      status(t('exported'));
    }, type, quality);
  }
  function buildPsdLike(d) {
    // A minimal 8-bit RGB PSD with one merged composite layer.
    var w = d.width, h = d.height;
    var data = PF_ENGINE.renderDoc(d, 1).getContext('2d').getImageData(0, 0, w, h).data;
    var chLen = w * h;
    var buf = new ArrayBuffer(26 + 4 * chLen * 3);
    var dv = new DataView(buf);
    dv.setUint16(0, 1);            // version
    dv.setUint16(12, 3);           // channels
    dv.setUint32(14, h); dv.setUint32(18, w);
    dv.setUint16(22, 8);           // depth
    dv.setUint16(24, 3);           // RGB
    var off = 26;
    for (var c = 0; c < 3; c++) {
      for (var i = 0; i < chLen; i++) dv.setUint8(off + c * chLen + i, data[i * 4 + c]);
    }
    return new Blob([buf], { type: 'application/octet-stream' });
  }
  function exportBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  function saveProject() {
    var d = doc(); if (!d) return;
    PF_PFS.encode(d).then(function (blob) {
      exportBlob(blob, d.name + '.pfs');
      d.dirty = false;
      status(t('savedProject'));
      if (d._autosaveKey) deleteAutosave(d._autosaveKey);
    }).catch(function () { status(t('scopeOpenFailed')); });
  }
  els.exportBtn.addEventListener('click', function () { if (doc()) openExport(); });
  els.newBtn.addEventListener('click', openNew);
  els.emptyOpenBtn.addEventListener('click', function () { els.fileInput.click(); });
  els.undo.addEventListener('click', doUndo);
  els.redo.addEventListener('click', doRedo);
  els.cropApply.addEventListener('click', function () { if (state.cropDraft) applyCropRect(state.cropDraft); });
  els.panelsToggle.addEventListener('click', function () { els.panels.classList.toggle('open'); });

  // ── Hold to compare ───────────────────────────────────────────────────
  function startHold() {
    var d = doc();
    if (!d || !d.original) return;
    state.holding = true;
    els.chip.hidden = false;
    els.chip.textContent = t('original');
    repaint();
  }
  function stopHold() {
    if (!state.holding) return;
    state.holding = false;
    els.chip.hidden = true;
    repaint();
  }
  window.addEventListener('keydown', function (e) {
    if (e.key === '\\') { startHold(); e.preventDefault(); return; }
  });
  window.addEventListener('keyup', function (e) {
    if (e.key === '\\') { stopHold(); return; }
  });

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  var KEY_TOOLS = { v: 'move', m: 'marqueeRect', l: 'lasso', w: 'wand', c: 'crop', i: 'eyedropper', b: 'brush', e: 'eraser', g: 'bucket', t: 'text', u: 'shape', h: 'hand', z: 'zoom', n: 'pencil' };
  window.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    var d = doc();
    if (e.ctrlKey || e.metaKey) {
      var k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { doUndo(); e.preventDefault(); return; }
      if ((k === 'z' && e.shiftKey) || k === 'y') { doRedo(); e.preventDefault(); return; }
      if (k === 'a') { selectAll(); e.preventDefault(); return; }
      if (k === 'd') { deselect(); e.preventDefault(); return; }
      if (k === 'i' && e.shiftKey) { invertSelection(); e.preventDefault(); return; }
      if (k === 'e' && e.shiftKey) { flattenDoc(); e.preventDefault(); return; }
      if (k === 'e') { mergeDown(); e.preventDefault(); return; }
      if (k === 's') { saveProject(); e.preventDefault(); return; }
      if (k === 'o') { els.fileInput.click(); e.preventDefault(); return; }
      if (k === 'n') { openNew(); e.preventDefault(); return; }
      return;
    }
    if (e.key === 'Escape') {
      var tool = PF_TOOLS.byId[state.toolId];
      if (tool && tool.cancel) tool.cancel();
      if (d && d.selection) deselect();
      return;
    }
    if (e.key === '[' || e.key === ']') {
      var opts = toolOpts();
      if ('size' in opts) {
        opts.size = Math.max(1, Math.min(300, opts.size + (e.key === ']' ? 4 : -4)));
        renderOpts();
      }
      return;
    }
    if (e.key === 'Enter' || e.key === 'Escape') {
      var tl = PF_TOOLS.byId[state.toolId];
      if (tl && tl.key) tl.key(e.key);
      return;
    }
    var toolId = KEY_TOOLS[e.key.toLowerCase()];
    if (toolId && PF_TOOLS.byId[toolId]) {
      selectTool(toolId);
      e.preventDefault();
    }
  });

  // ── Tabs ──────────────────────────────────────────────────────────────
  function renderTabs() {
    els.doctabs.innerHTML = '';
    docs.forEach(function (d) {
      var tab = document.createElement('div');
      tab.className = 'tab' + (d.id === activeDocId ? ' on' : '');
      var name = document.createElement('button');
      name.type = 'button'; name.className = 'tab';
      name.textContent = d.name + (d.dirty ? ' •' : '');
      name.style.border = '0'; name.style.background = 'none'; name.style.padding = '0';
      name.addEventListener('click', function () {
        activeDocId = d.id;
        fitView();
        renderAll();
      });
      tab.appendChild(name);
      var x = document.createElement('button');
      x.type = 'button'; x.className = 'tab-x';
      x.textContent = '×';
      x.setAttribute('aria-label', t('closeDoc'));
      x.addEventListener('click', function (e) { e.stopPropagation(); closeDoc(d.id); });
      tab.appendChild(x);
      els.doctabs.appendChild(tab);
    });
  }

  // ── Status bar ────────────────────────────────────────────────────────
  function updateStatus() {
    var d = doc();
    els.statusDims.textContent = d ? d.width + ' × ' + d.height + ' px' : t('stNoDoc');
    els.statusZoom.textContent = d ? 'Zoom ' + Math.round(d.view.zoom * 100) + '%' : '';
    els.statusAutosave.textContent = state.autosaveOk ? t('stAutosaveOn') : t('stAutosaveOff');
  }

  // ── i18n ──────────────────────────────────────────────────────────────
  function applyLang() {
    document.documentElement.lang = PF_I18N.lang();
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.dataset.i18n);
    });
    renderMenus();
    renderTools();
    renderOpts();
    renderPanels();
    updateStatus();
  }
  window.PFApp = { applyLang: applyLang };

  // ── Autosave ──────────────────────────────────────────────────────────
  var autosaveTimer = 0;
  var idb = null;
  function openIdb(cb) {
    if (idb) return cb(idb);
    var req;
    try { req = indexedDB.open('pixelforge', 1); } catch (e) { state.autosaveOk = false; return cb(null); }
    req.onupgradeneeded = function () { req.result.createObjectStore('autosave'); };
    req.onsuccess = function () { idb = req.result; cb(idb); };
    req.onerror = function () { state.autosaveOk = false; updateStatus(); cb(null); };
  }
  function scheduleAutosave() {
    if (!state.autosaveOk) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(saveAllAutosave, 30000);
  }
  function saveAllAutosave() {
    var dirty = docs.filter(function (d) { return d.dirty && !d.demo; });
    if (!dirty.length) return;
    openIdb(function (db) {
      if (!db) return;
      dirty.forEach(function (d) {
        PF_PFS.encode(d).then(function (blob) {
          var tx = db.transaction('autosave', 'readwrite');
          tx.objectStore('autosave').put({ name: d.name, savedAt: Date.now(), pfs: blob }, d.id);
          d._autosaveKey = d.id;
          d.dirty = false;
        }).catch(function () {
          state.autosaveOk = false;
          updateStatus();
        });
      });
    });
  }
  function deleteAutosave(key) {
    openIdb(function (db) {
      if (!db) return;
      var tx = db.transaction('autosave', 'readwrite');
      tx.objectStore('autosave').delete(key);
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveAllAutosave();
  });
  window.addEventListener('beforeunload', function (e) {
    if (docs.some(function (d) { return d.dirty; })) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  function checkRestore() {
    openIdb(function (db) {
      if (!db) return;
      var tx = db.transaction('autosave', 'readonly');
      var req = tx.objectStore('autosave').getAll();
      req.onsuccess = function () {
        var entries = req.result || [];
        if (!entries.length) return;
        dialog(t('restoreTitle'), function (body, done) {
          var p = document.createElement('p');
          p.textContent = t('restoreBody') + ' (' + entries.map(function (e2) { return e2.name; }).join(', ') + ')';
          body.appendChild(p);
          actions(body, done, [
            { label: t('discard'), act: function () {
              entries.forEach(function () {});
              var tx2 = db.transaction('autosave', 'readwrite');
              tx2.objectStore('autosave').clear();
            } },
            { label: t('restoreAll'), primary: true, act: function () {
              entries.forEach(function (e2) {
                PF_PFS.decode(e2.pfs, PF_CORE).then(function (d) {
                  d.original = PF_ENGINE.renderDoc(d, 1);
                  addDoc(d);
                }).catch(function () {});
              });
            } },
          ]);
        });
      };
    });
  }

  // ── Staging demo ──────────────────────────────────────────────────────
  function buildDemo() {
    var W = 1600, H = 1200;
    var d = PF_CORE.createDoc('harbour-sunrise.jpg', W, H, null);
    d.demo = true;
    // Background: sky and sea, locked
    var bg = PF_CORE.baseLayer('Background', 'raster');
    bg.locked = true;
    bg.canvas = PF_CORE.makeCanvas(W, H);
    var bc = bg.canvas.getContext('2d');
    var sky = bc.createLinearGradient(0, 0, 0, H * 0.62);
    sky.addColorStop(0, '#f9c784');
    sky.addColorStop(0.7, '#ef8354');
    sky.addColorStop(1, '#c96f4a');
    bc.fillStyle = sky;
    bc.fillRect(0, 0, W, H * 0.62);
    var sea = bc.createLinearGradient(0, H * 0.62, 0, H);
    sea.addColorStop(0, '#41586e');
    sea.addColorStop(1, '#22303f');
    bc.fillStyle = sea;
    bc.fillRect(0, H * 0.62, W, H * 0.38);
    // sun reflection
    bc.fillStyle = 'rgba(255,214,150,.35)';
    bc.fillRect(W * 0.42, H * 0.62, W * 0.16, H * 0.3);
    // some harbour silhouettes
    bc.fillStyle = '#1f2937';
    bc.fillRect(0, H * 0.58, W * 0.25, H * 0.05);
    bc.fillRect(W * 0.7, H * 0.56, W * 0.3, H * 0.07);
    d.layers.push(bg);
    // Sun: ellipse shape with a painted mask
    var sun = PF_CORE.baseLayer('Sun', 'shape');
    sun.shape = 'ellipse';
    sun.x = W * 0.44; sun.y = H * 0.22; sun.w = W * 0.12; sun.h = W * 0.12;
    sun.fill = { type: 'solid', color: '#ffe2a8' };
    sun.stroke = null;
    sun.mask = { canvas: PF_CORE.makeCanvas(W, H), enabled: true, inverted: false };
    var mc = sun.mask.canvas.getContext('2d');
    mc.fillStyle = '#ffffff';
    mc.fillRect(0, 0, W, H * 0.62);   // sun only above the horizon
    d.layers.push(sun);
    // Warm up: curves adjustment
    var warm = PF_CORE.baseLayer('Warm up', 'adjustment');
    warm.adjType = 'curves';
    warm.params = { points: [[0, 0], [128, 148], [255, 255]] };
    d.layers.push(warm);
    // Text
    var txt = PF_CORE.baseLayer('Harbour at sunrise', 'text');
    txt.text = 'Harbour at sunrise';
    txt.font = { family: 'ui-rounded', size: 72, weight: '700', style: 'normal' };
    txt.color = '#ffffff';
    txt.align = 'left';
    txt.mode = 'point';
    txt.x = W * 0.08; txt.y = H * 0.9;
    d.layers.push(txt);
    d.activeLayerId = sun.id;
    d.original = PF_ENGINE.renderDoc(d, 1);
    return d;
  }

  // ── Composite cache for wand/eyedropper ───────────────────────────────
  function compositeData() {
    var d = doc();
    if (!d) return null;
    if (!state.compositeCache) {
      var src = PF_ENGINE.renderDoc(d, 1);
      state.compositeCache = src.getContext('2d').getImageData(0, 0, d.width, d.height);
    }
    return state.compositeCache;
  }

  // ── Boot ──────────────────────────────────────────────────────────────
  applyLang();
  renderBlendOptions();
  renderAll();
  var params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') {
    addDoc(buildDemo());
    els.demoNote.hidden = false;
    els.demoNote.textContent = t('demoNote');
    // fit after layout settles
    requestAnimationFrame(function () { fitView(); layoutCanvases(); repaint(); drawNavigator(); });
  } else {
    checkRestore();
  }
})();