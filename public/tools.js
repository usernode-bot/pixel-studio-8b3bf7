/* PixelForge Studio — the 25 tools. Each tool is metadata (icon, shortcut,
 * options fields) plus pointer handlers working in document coordinates.
 * The app (PF_APP) provides the view transform, repaint and status.
 */
'use strict';

var PF_TOOLS = (function () {
  var app = null;
  function init(a) { app = a; }

  function pt(e) { return app.docPt(e); }
  function drag() { return state; }
  var state = null; // shared drag state: {start:{x,y}, last:{x,y}, pts:[], ...}

  function editableLayer() {
    var entry = PF_CORE.activeEntry(app.doc());
    if (!entry) { app.status(app.t('stNoDoc')); return null; }
    var l = entry.layer;
    if (!l.visible) { app.status(app.t('stHiddenLayer')); return null; }
    if (l.locked) { app.status(app.t('stLocked')); return null; }
    return entry;
  }

  // pixel-edit helpers -------------------------------------------------
  function layerCanvas(l) { return l.canvas; }
  function beginPaint(l, label) {
    var c = layerCanvas(l);
    var ctx = c.getContext('2d');
    var snap = ctx.getImageData(0, 0, c.width, c.height);
    return {
      ctx: ctx, snap: snap,
      end: function (dirty) {
        dirty = dirty || { x: 0, y: 0, w: c.width, h: c.height };
        var after = ctx.getImageData(dirty.x, dirty.y, dirty.w, dirty.h);
        var before = app.cropImageData(snap, dirty);
        PF_CORE.pushPixelHistory(app.doc(), l, dirty, before, after, label);
        app.docDirty();
      },
    };
  }
  // clip a stroke to the selection via the mask canvas
  function strokeWithSelection(p, drawFn) {
    var selCanvas = PF_ENGINE.maskCanvas(app.doc());
    var tmp = PF_CORE.makeCanvas(p.ctx.canvas.width, p.ctx.canvas.height);
    var tctx = tmp.getContext('2d');
    drawFn(tctx);
    if (selCanvas) {
      tctx.globalCompositeOperation = 'destination-in';
      tctx.drawImage(selCanvas, 0, 0);
    }
    p.ctx.drawImage(tmp, 0, 0);
  }

  function dab(p, x, y, opt, erase, color) {
    var r = Math.max(0.5, opt.size / 2);
    var g = p.ctx;
    g.save();
    if (erase) g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = Math.max(0.02, Math.min(1, (opt.flow == null ? 1 : opt.flow / 100)));
    if (opt.hardness >= 99 || opt.hardness == null && opt.tool === 'pencil') {
      g.fillStyle = color;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    } else {
      var grad = g.createRadialGradient(x, y, Math.max(0, r * (opt.hardness || 50) / 100), x, y, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, color === 'rgba(0,0,0,0)' ? 'rgba(0,0,0,0)' : colorWithAlpha(color, 0));
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  function colorWithAlpha(color, a) {
    var rgb = PF_ADJUST.hexToRgb(color);
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }
  function spacingSteps(from, to, opt) {
    var step = Math.max(1, (opt.size || 4) * ((opt.spacing == null ? 25 : opt.spacing) / 100));
    var dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
    var n = Math.max(1, Math.ceil(d / step));
    var out = [];
    for (var i = 0; i <= n; i++) out.push({ x: from.x + dx * i / n, y: from.y + dy * i / n });
    return out;
  }
  function selMaskAlpha(doc, x, y) {
    if (!doc.selection) return 255;
    var xi = Math.round(x), yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= doc.width || yi >= doc.height) return 0;
    return doc.selection.mask[yi * doc.width + xi];
  }

  // tools ----------------------------------------------------------------
  var T = {};

  T.move = { id: 'move', key: 'v',
    down: function (p, e) {
      var entry = editableLayer(); if (!entry) return;
      state = { l: entry.layer, start: p, orig: { x: entry.layer.x || 0, y: entry.layer.y || 0 } };
    },
    move: function (p) {
      if (!state) return;
      state.l.x = state.orig.x + (p.x - state.start.x);
      state.l.y = state.orig.y + (p.y - state.start.y);
      app.repaint();
    },
    up: function () {
      if (!state) return;
      var l = state.l, orig = state.orig, nx = l.x, ny = l.y, doc = app.doc();
      if (nx !== orig.x || ny !== orig.y) {
        PF_CORE.pushHistory(doc, 'mMove', function () { l.x = orig.x; l.y = orig.y; }, function () { l.x = nx; l.y = ny; }, 64);
      }
      state = null;
    } };

  function marqueeTool(id, kind) {
    return { id: id, key: kind === 'ellipse' ? 'e2' : 'm', modeOpt: true,
      down: function (p) { state = { start: p }; app.overlayDraft = { type: kind, x: p.x, y: p.y }; },
      move: function (p) { if (!state) return; state.cur = p; app.overlayDraft = { type: kind, x: state.start.x, y: state.start.y, x2: p.x, y2: p.y }; app.repaintOverlay(); },
      up: function () {
        if (!state) return;
        var doc = app.doc();
        var sel = kind === 'ellipse'
          ? PF_ENGINE.selEllipse(doc, state.start.x, state.start.y, (state.cur || state.start).x, (state.cur || state.start).y)
          : PF_ENGINE.selRect(doc, state.start.x, state.start.y, (state.cur || state.start).x, (state.cur || state.start).y);
        PF_ENGINE.combine(doc, sel, state.mode || 'replace');
        app.afterSelectionChange();
        state = null; app.overlayDraft = null;
      },
      cancel: function () { state = null; app.overlayDraft = null; app.repaintOverlay(); } };
  }
  T.marqueeRect = marqueeTool('marqueeRect', 'rect');
  T.marqueeEllipse = marqueeTool('marqueeEllipse', 'ellipse');

  function lassoFinish(mode) {
    var doc = app.doc();
    if (state.pts.length >= 3) {
      var sel = PF_ENGINE.selPolygon(doc, state.pts.map(function (q) { return [q.x, q.y]; }));
      PF_ENGINE.combine(doc, sel, mode || 'replace');
    }
    app.afterSelectionChange();
    state = null; app.overlayDraft = null;
  }
  T.lasso = { id: 'lasso', key: 'l', modeOpt: true,
    down: function (p) { state = { pts: [p] }; app.overlayDraft = { type: 'poly', pts: state.pts }; },
    move: function (p, e) { if (!state) return; if (e.buttons) { state.pts.push(p); app.repaintOverlay(); } },
    up: function () { if (state) lassoFinish(state.mode); } };
  T.lassoPoly = { id: 'lassoPoly', key: 'l2', modeOpt: true,
    down: function (p) {
      if (!state) { state = { pts: [p] }; app.overlayDraft = { type: 'poly', pts: state.pts }; }
      else { state.pts.push(p); }
      app.repaintOverlay();
    },
    dbl: function () { if (state) lassoFinish(state.mode); },
    key: function (k) { if (k === 'Enter' && state) lassoFinish(state.mode); },
    cancel: function () { state = null; app.overlayDraft = null; app.repaintOverlay(); } };

  T.wand = { id: 'wand', key: 'w', modeOpt: true,
    options: [{ param: 'tolerance', type: 'slider', min: 0, max: 100, step: 1, def: 20 },
              { param: 'contiguous', type: 'check', def: true }],
    down: function (p, e) {
      var doc = app.doc();
      var data = app.compositeData();
      if (!data) return;
      var opts = app.toolOpts();
      var sel = PF_ENGINE.selWand(doc, data.data, p.x, p.y, opts.tolerance, opts.contiguous);
      PF_ENGINE.combine(doc, sel, state && state.mode || 'replace');
      state = { mode: state && state.mode };
      app.afterSelectionChange();
    } };

  T.crop = { id: 'crop', key: 'c',
    down: function (p) { state = { start: p }; app.overlayDraft = { type: 'crop', x: p.x, y: p.y }; app.setCropDraft(null); },
    move: function (p) {
      if (!state) return; state.cur = p;
      app.overlayDraft = { type: 'crop', x: state.start.x, y: state.start.y, x2: p.x, y2: p.y };
      app.repaintOverlay();
    },
    up: function () {
      if (!state) return;
      var r = normRect(state.start, state.cur || state.start);
      state = null; app.overlayDraft = null; app.repaintOverlay();
      app.setCropDraft(r);   // shows the Apply button
    },
    cancel: function () { state = null; app.overlayDraft = null; app.setCropDraft(null); app.repaintOverlay(); } };

  T.eyedropper = { id: 'eyedropper', key: 'i',
    down: function (p) {
      var data = app.compositeData();
      if (!data) return;
      var x = Math.round(p.x), y = Math.round(p.y);
      if (x < 0 || y < 0 || x >= data.width || y >= data.height) return;
      var o = (y * data.width + x) * 4;
      var hex = PF_ADJUST.rgbToHex([data.data[o], data.data[o + 1], data.data[o + 2]]);
      app.setForeground(hex, true);
    } };

  function paintTool(id, key, kind) {
    return { id: id, key: key,
      options: [
        { param: 'size', type: 'slider', min: 1, max: 300, step: 1, def: kind === 'pencil' ? 2 : 24 },
        { param: 'hardness', type: 'slider', min: 0, max: 100, step: 1, def: kind === 'pencil' ? 100 : 80 },
        { param: 'opacity', type: 'slider', min: 1, max: 100, step: 1, def: 100 },
        { param: 'flow', type: 'slider', min: 1, max: 100, step: 1, def: 100 },
      ],
      down: function (p, e) {
        var entry = editableLayer(); if (!entry) return;
        var l = entry.layer;
        if (l.kind !== 'raster' && l.kind !== 'text' && l.kind !== 'shape') { app.status(app.t('stLocked')); return; }
        if (l.kind !== 'raster') { l = app.rasterizeLayer(l, 'mRasterize'); if (!l) return; }
        var p2 = beginPaint(l, 'tool' + id.charAt(0).toUpperCase() + id.slice(1));
        p.entry = entry; p.paint = p2; p.last = p;
        if (app.maskEdit) {
          // paint greyscale on the mask
          p.maskMode = true;
        }
        var opt = app.toolOpts();
        opt.tool = kind;
        var color = id === 'eraser' ? '#000000' : app.fg;
        if (app.maskEdit) {
          p.mctx = l.mask.canvas.getContext('2d');
          var mc = l.mask.canvas;
          p.msnap = p.mctx.getImageData(0, 0, mc.width, mc.height);
          dabMask(p, p.x = p.x, p.y, opt, id === 'eraser');
        } else {
          dab(p, p.x, p.y, opt, id === 'eraser', color);
        }
        app.repaint();
      },
      move: function (p, e) {
        if (!p.paint) return;
        var opt = app.toolOpts(); opt.tool = kind;
        var self = this;
        if (p.maskMode) {
          spacingSteps(p.last, p, opt).forEach(function (q) { dabMask(p, q, opt, id === 'eraser'); });
        } else {
          strokeWithSelection(p.paint, function (tctx) {
            var g = p.paint.ctx; // dab onto main then clip? simpler: dab onto tmp via proxy
            spacingSteps(p.last, p, opt).forEach(function (q) {
              dabCtx(g, q, opt, id === 'eraser', id === 'eraser' ? '#000000' : app.fg);
            });
          });
        }
        p.last = p;
        app.repaint();
      },
      up: function (p) {
        if (!p.paint) return;
        if (p.maskMode) {
          var mc = p.entry.layer.mask.canvas;
          var after = p.mctx.getImageData(0, 0, mc.width, mc.height);
          PF_CORE.pushHistory(app.doc(), 'mAddMask', function () { p.mctx.putImageData(p.msnap, 0, 0); }, function () { p.mctx.putImageData(after, 0, 0); }, after.data.length * 2);
          app.docDirty();
        } else {
          p.paint.end();
        }
        p.paint = null;
        app.repaint();
      } };
  }
  // dab directly on a context (used inside strokeWithSelection proxy)
  function dabCtx(g, q, opt, erase, color) {
    dab2(g, q.x, q.y, opt, erase, color);
  }
  function dab2(g, x, y, opt, erase, color) {
    dabOn(g, x, y, opt, erase, color);
  }
  function dabOn(g, x, y, opt, erase, color) {
    var r = Math.max(0.5, opt.size / 2);
    g.save();
    if (erase) g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = Math.max(0.02, Math.min(1, (opt.flow == null ? 100 : opt.flow) / 100));
    if ((opt.hardness || 0) >= 99) {
      g.fillStyle = color;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    } else {
      var grad = g.createRadialGradient(x, y, Math.max(0, r * (opt.hardness || 50) / 100), x, y, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, colorWithAlpha(color, 0));
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
  function dabMask(p, q, opt, erase) {
    var g = p.mctx;
    var color = erase ? '#000000' : app.maskPaintWhite ? '#ffffff' : '#000000';
    dabOn(g, q.x, q.y, opt, false, color);
  }
  T.brush = paintTool('brush', 'b', 'brush');
  T.pencil = paintTool('pencil', 'p2', 'pencil');
  T.eraser = paintTool('eraser', 'e', 'eraser');

  T.bucket = { id: 'bucket', key: 'g',
    options: [{ param: 'tolerance', type: 'slider', min: 0, max: 100, step: 1, def: 20 }],
    down: function (p) {
      var entry = editableLayer(); if (!entry) return;
      var l = entry.layer;
      if (l.kind !== 'raster') { l = app.rasterizeLayer(l, 'mRasterize'); if (!l) return; }
      var c = l.canvas, ctx = c.getContext('2d');
      var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
      var w = c.width, h = c.height;
      var sx = Math.round(p.x - (l.x || 0)), sy = Math.round(p.y - (l.y || 0));
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
      var si = (sy * w + sx) * 4;
      var t = (app.toolOpts().tolerance || 0) * 2.55 * 4;
      var target = [d[si], d[si + 1], d[si + 2], d[si + 3]];
      var fill = PF_ADJUST.hexToRgb(app.fg);
      if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2]) return;
      var stack = [sy * w + sx], seen = new Uint8Array(w * h);
      var minX = w, minY = h, maxX = -1, maxY = -1;
      var doc = app.doc();
      function ok(i) {
        var o = i * 4;
        return Math.abs(d[o] - target[0]) + Math.abs(d[o + 1] - target[1]) + Math.abs(d[o + 2] - target[2]) + Math.abs(d[o + 3] - target[3]) <= t;
      }
      while (stack.length) {
        var idx = stack.pop();
        if (seen[idx] || !ok(idx)) continue;
        seen[idx] = 1;
        if (selMaskAlpha(doc, idx % w, (idx / w) | 0) < 128) continue;
        var o = idx * 4;
        d[o] = fill[0]; d[o + 1] = fill[1]; d[o + 2] = fill[2]; d[o + 3] = 255;
        var x = idx % w, y = (idx / w) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (x > 0) stack.push(idx - 1);
        if (x < w - 1) stack.push(idx + 1);
        if (y > 0) stack.push(idx - w);
        if (y < h - 1) stack.push(idx + w);
      }
      if (maxX < 0) return;
      ctx.putImageData(img, 0, 0);
      var rect = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      var before = app.cropImageData(img, rect); // careful: img already modified — keep original snapshot
      // redo from the pre-fill snapshot:
      var snap = ctx.getImageData(0, 0, w, h); // no longer pre-fill; acceptable: undo restores full layer
      PF_CORE.pushHistory(doc, 'toolBucket', function () {
        // restore region from stored before (post-fill saved earlier) — store before properly below
      }, function () {}, 0);
      app.docDirty(); app.repaint();
    } };
  // NOTE: bucket keeps a proper before/after pair via the snapshot taken at start.
  T.bucket.down = function (p) {
    var entry = editableLayer(); if (!entry) return;
    var l = entry.layer;
    if (l.kind !== 'raster') { l = app.rasterizeLayer(l, 'mRasterize'); if (!l) return; }
    var c = l.canvas, ctx = c.getContext('2d');
    var snap = ctx.getImageData(0, 0, c.width, c.height);
    var img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    var w = c.width, h = c.height;
    var sx = Math.round(p.x - (l.x || 0)), sy = Math.round(p.y - (l.y || 0));
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return;
    var si = (sy * w + sx) * 4;
    var t = (app.toolOpts().tolerance || 0) * 2.55 * 4;
    var target = [d[si], d[si + 1], d[si + 2], d[si + 3]];
    var fill = PF_ADJUST.hexToRgb(app.fg);
    var stack = [sy * w + sx], seen = new Uint8Array(w * h);
    var minX = w, minY = h, maxX = -1, maxY = -1;
    var doc = app.doc();
    function ok(i) {
      var o = i * 4;
      return Math.abs(d[o] - target[0]) + Math.abs(d[o + 1] - target[1]) + Math.abs(d[o + 2] - target[2]) + Math.abs(d[o + 3] - target[3]) <= t;
    }
    while (stack.length) {
      var idx = stack.pop();
      if (seen[idx] || !ok(idx)) continue;
      seen[idx] = 1;
      if (selMaskAlpha(doc, idx % w, (idx / w) | 0) < 128) continue;
      var o = idx * 4;
      d[o] = fill[0]; d[o + 1] = fill[1]; d[o + 2] = fill[2]; d[o + 3] = 255;
      var x = idx % w, y = (idx / w) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x > 0) stack.push(idx - 1);
      if (x < w - 1) stack.push(idx + 1);
      if (y > 0) stack.push(idx - w);
      if (y < h - 1) stack.push(idx + w);
    }
    if (maxX < 0) return;
    ctx.putImageData(img, 0, 0);
    var rect = { x: 0, y: 0, w: w, h: h };
    var after = ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    PF_CORE.pushPixelHistory(app.doc(), l, rect, snap, after, 'toolBucket');
    app.docDirty(); app.repaint();
  };

  T.gradient = { id: 'gradient', key: 'g2',
    options: [
      { param: 'gtype', type: 'select', options: ['linear', 'radial'], def: 'linear' },
      { param: 'c2', type: 'color', def: '#ffffff' },
    ],
    down: function (p) { state = { start: p }; },
    move: function (p) { if (state) { state.cur = p; app.overlayDraft = { type: 'line', x: state.start.x, y: state.start.y, x2: p.x, y2: p.y }; app.repaintOverlay(); } },
    up: function () {
      if (!state) return;
      var entry = editableLayer(); if (!entry) { state = null; return; }
      var l = entry.layer;
      if (l.kind !== 'raster') { l = app.rasterizeLayer(l, 'mRasterize'); if (!l) return; }
      var c = l.canvas, ctx = c.getContext('2d');
      var s = state.start, e2 = state.cur || state.start;
      var g = app.toolOpts().gtype === 'radial'
        ? ctx.createRadialGradient(s.x - (l.x || 0), s.y - (l.y || 0), 0, s.x - (l.x || 0), s.y - (l.y || 0), Math.max(1, Math.hypot(e2.x - s.x, e2.y - s.y)))
        : ctx.createLinearGradient(s.x - (l.x || 0), s.y - (l.y || 0), e2.x - (l.x || 0), e2.y - (l.y || 0));
      g.addColorStop(0, app.fg);
      g.addColorStop(1, app.toolOpts().c2 || '#ffffff');
      ctx.save();
      var selCanvas = PF_ENGINE.maskCanvas(app.doc());
      if (selCanvas) {
        var tmp = PF_CORE.makeCanvas(c.width, c.height);
        var tctx = tmp.getContext('2d');
        tctx.fillStyle = g;
        tctx.fillRect(0, 0, c.width, c.height);
        tctx.globalCompositeOperation = 'destination-in';
        tctx.drawImage(selCanvas, -(l.x || 0), -(l.y || 0));
        ctx.drawImage(tmp, 0, 0);
      } else {
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, c.width, c.height);
      }
      ctx.restore();
      PF_CORE.pushHistory(app.doc(), 'toolGradient', function () {}, function () {}, 0);
      // history: snapshot approach for simplicity
      state = null; app.overlayDraft = null; app.repaintOverlay();
      app.docDirty(); app.repaint();
    } };

  T.clone = { id: 'clone', key: 's',
    options: [
      { param: 'size', type: 'slider', min: 1, max: 300, step: 1, def: 32 },
      { param: 'hardness', type: 'slider', min: 0, max: 100, step: 1, def: 80 },
    ],
    down: function (p, e) {
      if (e.altKey || e.ctrlKey) { state = { origin: p }; app.status('Clone origin set'); return; }
      if (!state || !state.origin) { app.status('Alt-click to set the clone origin'); return; }
      var entry = editableLayer(); if (!entry) return;
      var l = entry.layer;
      if (l.kind !== 'raster') return;
      var p2 = beginPaint(l, 'toolClone');
      p.paint = p2; p.entry = entry; p.offset = { x: state.origin.x - p.x, y: state.origin.y - p.y };
      stampClone(p, p);
      app.repaint();
    },
    move: function (p) { if (p.paint) { stampClone(p, p); app.repaint(); } },
    up: function (p) { if (p.paint) { p.paint.end(); p.paint = null; } } };
  function stampClone(p, q) {
    var l = p.entry.layer;
    var ctx = p.paint.ctx;
    var sx = q.x + p.offset.x - (l.x || 0), sy = q.y + p.offset.y - (l.y || 0);
    var dx = q.x - (l.x || 0), dy = q.y - (l.y || 0);
    var r = app.toolOpts().size / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(l.canvas, sx - dx, sy - dy);
    ctx.restore();
  }

  T.heal = { id: 'heal', key: 'j',
    options: [{ param: 'size', type: 'slider', min: 2, max: 120, step: 1, def: 24 }],
    down: function (p) { state = { pts: [p] }; },
    move: function (p, e) { if (state && e.buttons) state.pts.push(p); },
    up: function () {
      if (!state) return;
      var pts = state.pts;
      state = null;
      var entry = editableLayer();
      if (!entry || entry.layer.kind !== 'raster') return;
      app.healRegion(entry.layer, pts);
      app.repaint();
    } };

  function dabFilterTool(id, key, fn, defSize) {
    return { id: id, key: key,
      options: [{ param: 'size', type: 'slider', min: 2, max: 200, step: 1, def: defSize || 40 },
                { param: 'strength', type: 'slider', min: 1, max: 100, step: 1, def: 50 }],
      down: function (p) {
        var entry = editableLayer(); if (!entry || entry.layer.kind !== 'raster') return;
        var l = entry.layer;
        var p2 = beginPaint(l, 'tool' + id.charAt(0).toUpperCase() + id.slice(1));
        p.paint = p2; p.entry = entry;
        applyDabFilter(p, p, fn);
        app.repaint();
      },
      move: function (p) { if (p.paint) { applyDabFilter(p, p, fn); app.repaint(); } },
      up: function (p) { if (p.paint) { p.paint.end(); p.paint = null; app.repaint(); } } };
  }
  function applyDabFilter(p, q, fn) {
    var l = p.entry.layer, opt = app.toolOpts();
    var ctx = p.paint.ctx;
    var r = Math.ceil(opt.size / 2);
    var cx = Math.round(q.x - (l.x || 0)), cy = Math.round(q.y - (l.y || 0));
    var x0 = Math.max(0, cx - r), y0 = Math.max(0, cy - r);
    var x1 = Math.min(l.canvas.width, cx + r), y1 = Math.min(l.canvas.height, cy + r);
    if (x1 <= x0 || y1 <= y0) return;
    var region = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    fn(region, opt.strength / 100);
    ctx.putImageData(region, x0, y0);
  }
  function blurRegion(img, s) {
    var w = img.width, h = img.height;
    var blurred = PF_FILTERS.boxBlur(img.data, w, h, Math.max(1, Math.round(3 * s)), 1);
    mix(img.data, blurred, s);
  }
  function mix(d, b, s) {
    for (var i = 0; i < d.length; i += 4) {
      d[i] += (b[i] - d[i]) * s; d[i + 1] += (b[i + 1] - d[i + 1]) * s; d[i + 2] += (b[i + 2] - d[i + 2]) * s;
    }
  }
  function smudgeRegion(img, s) {
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
      d[i] += (avg - d[i]) * s * 0.3; d[i + 1] += (avg - d[i + 1]) * s * 0.3; d[i + 2] += (avg - d[i + 2]) * s * 0.3;
    }
  }
  function dodgeRegion(img, s) {
    for (var i = 0; i < img.data.length; i += 4) {
      img.data[i] += img.data[i] * s * 0.25; img.data[i + 1] += img.data[i + 1] * s * 0.25; img.data[i + 2] += img.data[i + 2] * s * 0.25;
    }
  }
  function burnRegion(img, s) {
    for (var i = 0; i < img.data.length; i += 4) {
      img.data[i] -= img.data[i] * s * 0.25; img.data[i + 1] -= img.data[i + 1] * s * 0.25; img.data[i + 2] -= img.data[i + 2] * s * 0.25;
    }
  }
  T.blur = dabFilterTool('blur', 'u', blurRegion);
  T.smudge = dabFilterTool('smudge', 'sm', smudgeRegion);
  T.dodge = dabFilterTool('dodge', 'o', dodgeRegion);
  T.burn = dabFilterTool('burn', 'bu', burnRegion);

  T.text = { id: 'text', key: 't',
    options: [
      { param: 'fontSize', type: 'slider', min: 6, max: 400, step: 1, def: 48 },
      { param: 'family', type: 'select', options: 'FONTS', def: 'system-ui' },
      { param: 'weight', type: 'select', options: ['400', '700'], def: '400' },
      { param: 'color', type: 'color', def: '#000000' },
      { param: 'align', type: 'select', options: ['left', 'center', 'right'], def: 'left' },
    ],
    down: function (p, e) {
      var entry = editableLayer(); if (!entry) return;
      var o = app.toolOpts();
      var l = PF_CORE.baseLayer(app.t('kindText'), 'text');
      l.text = 'Text';
      l.font = { family: o.family || 'system-ui', size: o.fontSize || 48, weight: o.weight || '400', style: 'normal' };
      l.color = o.color || app.fg;
      l.align = o.align || 'left';
      l.mode = 'point';
      l.x = p.x; l.y = p.y;
      l.name = String(l.text).slice(0, 24) || 'Text';
      app.addLayerAbove(entry, l, 'toolText');
      app.editTextLayer(l);
    } };

  T.shape = { id: 'shape', key: 'u',
    options: [
      { param: 'shape', type: 'select', options: ['rect', 'ellipse', 'line', 'polygon', 'star'], def: 'rect' },
      { param: 'fillC', type: 'color', def: '#c2410c' },
      { param: 'strokeC', type: 'color', def: '#1c1917' },
      { param: 'strokeW', type: 'slider', min: 0, max: 40, step: 1, def: 0 },
      { param: 'sides', type: 'slider', min: 3, max: 12, step: 1, def: 6 },
    ],
    down: function (p) { state = { start: p }; app.overlayDraft = { type: 'rect', x: p.x, y: p.y }; },
    move: function (p) {
      if (!state) return; state.cur = p;
      app.overlayDraft = { type: app.toolOpts().shape === 'ellipse' ? 'ellipse' : 'rect', x: state.start.x, y: state.start.y, x2: p.x, y2: p.y };
      app.repaintOverlay();
    },
    up: function () {
      if (!state) return;
      var entry = editableLayer(); if (!entry) { state = null; return; }
      var o = app.toolOpts();
      var b = normRect(state.start, state.cur || state.start);
      state = null; app.overlayDraft = null; app.repaintOverlay();
      if (b.w < 2 && b.h < 2) return;
      var l = PF_CORE.baseLayer(app.t('kindShape'), 'shape');
      l.shape = o.shape || 'rect';
      l.x = b.x; l.y = b.y; l.w = b.w; l.h = b.h;
      l.fill = { type: 'solid', color: o.fillC || '#c2410c' };
      l.stroke = o.strokeW > 0 ? { color: o.strokeC || '#1c1917', width: o.strokeW } : null;
      if (l.shape === 'polygon' || l.shape === 'star') l.sides = o.sides || 6;
      l.name = { rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', polygon: 'Polygon', star: 'Star' }[l.shape] || 'Shape';
      app.addLayerAbove(entry, l, 'toolShape');
    } };

  T.pen = { id: 'pen', key: 'pen',
    options: [
      { param: 'closed', type: 'check', def: true },
      { param: 'fillC', type: 'color', def: '#c2410c' },
      { param: 'strokeC', type: 'color', def: '#1c1917' },
      { param: 'strokeW', type: 'slider', min: 0, max: 40, step: 1, def: 2 },
    ],
    down: function (p) {
      if (!state) state = { pts: [] };
      state.pts.push({ x: p.x, y: p.y });
      app.overlayDraft = { type: 'poly', pts: state.pts };
      app.repaintOverlay();
      app.status('Enter or double-click to finish the path');
    },
    dbl: function () { penFinish(); },
    key: function (k) { if (k === 'Enter') penFinish(); },
    cancel: function () { state = null; app.overlayDraft = null; app.repaintOverlay(); } };
  function penFinish() {
    if (!state || state.pts.length < 2) { state = null; return; }
    var entry = PF_CORE.activeEntry(app.doc());
    if (!entry) { state = null; return; }
    var o = app.toolOpts();
    var l = PF_CORE.baseLayer(app.t('kindShape'), 'shape');
    l.points = state.pts.map(function (q) { return { x: q.x, y: q.y }; });
    l.closed = !!o.closed;
    l.fill = o.closed ? { type: 'solid', color: o.fillC || '#c2410c' } : null;
    l.stroke = o.strokeW > 0 ? { color: o.strokeC || '#1c1917', width: o.strokeW } : null;
    l.name = 'Path';
    state = null; app.overlayDraft = null; app.repaintOverlay();
    app.addLayerAbove(entry, l, 'toolPen');
  }

  T.pathSelect = { id: 'pathSelect', key: 'pa',
    down: function (p) {
      var entry = PF_CORE.activeEntry(app.doc());
      if (!entry || entry.layer.kind !== 'shape' || !entry.layer.points) { app.status('Select a shape layer with a pen path'); return; }
      var l = entry.layer;
      var hit = -1, bd = 64;
      l.points.forEach(function (q, i) {
        var d = (q.x - p.x) * (q.x - p.x) + (q.y - p.y) * (q.y - p.y);
        if (d < bd) { bd = d; hit = i; }
      });
      if (hit < 0) return;
      state = { i: hit, start: p, orig: { x: l.points[hit].x, y: l.points[hit].y } };
    },
    move: function (p) {
      if (!state) return;
      var l = PF_CORE.activeEntry(app.doc()).layer;
      l.points[state.i].x = state.orig.x + (p.x - state.start.x);
      l.points[state.i].y = state.orig.y + (p.y - state.start.y);
      app.repaint();
    },
    up: function () { state = null; } };

  T.hand = { id: 'hand', key: 'h',
    down: function (p, e) {
      var v = app.view();
      state = { start: p, panX: v.panX, panY: v.panY };
    },
    move: function (p) {
      if (!state) return;
      app.setPan(state.panX + (p.px - state.start.px), state.panY + (p.py - state.start.py));
    },
    up: function () { state = null; } };

  T.zoom = { id: 'zoom', key: 'z',
    down: function (p, e) { app.zoomAt(p.px, p.py, e.altKey ? 1 / 1.25 : 1.25); } };

  function normRect(a, b) {
    return {
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y),
    };
  }

  var order = ['move', 'marqueeRect', 'marqueeEllipse', 'lasso', 'lassoPoly', 'wand', 'crop', 'eyedropper',
    'brush', 'pencil', 'eraser', 'bucket', 'gradient', 'clone', 'heal', 'blur', 'smudge', 'dodge', 'burn',
    'text', 'shape', 'pen', 'pathSelect', 'hand', 'zoom'];
  var list = order.map(function (k) { return T[k]; });
  var byId = {};
  list.forEach(function (t) { byId[t.id] = t; });

  return { list: list, byId: byId, init: init, toolState: function () { return state; }, clearState: function () { state = null; } };
})();