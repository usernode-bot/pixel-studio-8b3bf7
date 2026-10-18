/* PixelForge Studio — the hand-written Canvas2D engine: compositing,
 * selections with marching ants, and smart-filter application.
 * Everything here runs on the device; there is no compositing library.
 */
'use strict';

var PF_ENGINE = (function () {
  var BLEND_MAP = {
    normal: 'source-over', multiply: 'multiply', screen: 'screen', overlay: 'overlay',
    darken: 'darken', lighten: 'lighten', 'color-dodge': 'color-dodge', 'color-burn': 'color-burn',
    'hard-light': 'hard-light', 'soft-light': 'soft-light', difference: 'difference',
    exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'color', luminosity: 'luminosity',
  };
  var BLEND_ORDER = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge',
    'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  }

  // Paint a layer's own content (no mask/blend/opacity) into a fresh canvas
  // at doc size, with smart filters applied.
  function renderLayerContent(doc, layer, scale) {
    var W = Math.max(1, Math.round(doc.width * scale)), H = Math.max(1, Math.round(doc.height * scale));
    var c = makeCanvas(W, H);
    var ctx = c.getContext('2d');
    ctx.save();
    if (scale !== 1) ctx.scale(scale, scale);
    drawRawLayer(ctx, doc, layer);
    ctx.restore();
    if (layer.filters && layer.filters.length) {
      applySmartFilters(c, layer.filters);
    }
    return c;
  }

  function drawRawLayer(ctx, doc, layer) {
    var W = doc.width, H = doc.height;
    switch (layer.kind) {
      case 'raster':
        ctx.drawImage(layer.canvas, layer.x || 0, layer.y || 0);
        break;
      case 'fill':
        ctx.fillStyle = paintToStyle(layer.paint, ctx, W, H, 0, 0, W, H);
        ctx.fillRect(0, 0, W, H);
        break;
      case 'adjustment':
        // Content is the composite below; the compositor handles it specially.
        break;
      case 'group':
        // Composited by the compositor; nothing raw.
        break;
      case 'text':
        drawTextLayer(ctx, layer);
        break;
      case 'shape':
        drawShapeLayer(ctx, layer);
        break;
    }
  }

  function paintToStyle(paint, ctx, W, H, x, y, w, h) {
    if (!paint) return 'rgba(0,0,0,0)';
    if (paint.type === 'solid') return paint.color;
    var g;
    if (paint.type === 'radial') {
      g = ctx.createRadialGradient(x + w / 2, y + h / 2, 0, x + w / 2, y + h / 2, Math.max(w, h) / 2);
    } else {
      var from = paint.from || [x, y], to = paint.to || [x + w, y];
      g = ctx.createLinearGradient(from[0], from[1], to[0], to[1]);
    }
    g.addColorStop(0, paint.color || '#000000');
    g.addColorStop(1, paint.color2 || '#ffffff');
    return g;
  }

  function drawTextLayer(ctx, layer) {
    var f = layer.font || {};
    var fam = f.family || 'system-ui';
    ctx.font = (f.style === 'italic' ? 'italic ' : '') + (f.weight || 400) + ' ' + (f.size || 24) + 'px ' + fam;
    ctx.fillStyle = layer.color || '#000000';
    ctx.textAlign = layer.align === 'center' ? 'center' : layer.align === 'right' ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    if (ctx.letterSpacing !== undefined && layer.tracking) ctx.letterSpacing = layer.tracking + 'px';
    var lines = String(layer.text || '').split('\n');
    var lh = (layer.leading || Math.round((f.size || 24) * 1.25));
    if (layer.mode === 'box' && layer.box) {
      var bw = layer.box.w, x = layer.x, y = layer.y;
      var ax = layer.align === 'center' ? x + bw / 2 : layer.align === 'right' ? x + bw : x;
      var yy = y + (f.size || 24) * 0.9;
      lines.forEach(function (line) {
        // manual wrap for box text
        var words = line.split(' '), cur = '';
        var out = [];
        for (var i = 0; i < words.length; i++) {
          var test = cur ? cur + ' ' + words[i] : words[i];
          if (ctx.measureText(test).width > bw && cur) { out.push(cur); cur = words[i]; }
          else cur = test;
        }
        out.push(cur);
        out.forEach(function (ln) { ctx.fillText(ln, ax, yy); yy += lh; });
      });
    } else {
      var yy2 = layer.y;
      lines.forEach(function (ln) { ctx.fillText(ln, layer.x, yy2); yy2 += lh; });
    }
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
  }

  function drawShapeLayer(ctx, layer) {
    var paths = layer.points && layer.points.length >= 2 ? [penPath(layer.points, layer.closed)] : [shapePath(layer)];
    ctx.save();
    paths.forEach(function (path) {
      if (layer.fill) {
        ctx.fillStyle = paintToStyle(layer.fill, ctx, docShapeBounds(layer).w, docShapeBounds(layer).h,
          docShapeBounds(layer).x, docShapeBounds(layer).y, docShapeBounds(layer).w, docShapeBounds(layer).h);
        ctx.fill(path);
      }
      if (layer.stroke && layer.stroke.width > 0) {
        ctx.strokeStyle = layer.stroke.paint && layer.stroke.paint.color || layer.stroke.color || '#000000';
        ctx.lineWidth = layer.stroke.width;
        ctx.lineJoin = layer.stroke.join || 'miter';
        ctx.lineCap = layer.stroke.cap || 'butt';
        ctx.stroke(path);
      }
    });
    ctx.restore();
  }

  function docShapeBounds(layer) {
    var b = shapeBounds(layer);
    return b;
  }
  function shapeBounds(layer) {
    var x = layer.x || 0, y = layer.y || 0, w = layer.w || 0, h = layer.h || 0;
    if (layer.points && layer.points.length) {
      var xs = layer.points.map(function (p) { return p.x; }), ys = layer.points.map(function (p) { return p.y; });
      x = Math.min.apply(null, xs); y = Math.min.apply(null, ys);
      w = Math.max.apply(null, xs) - x; h = Math.max.apply(null, ys) - y;
    }
    return { x: x, y: y, w: w, h: h };
  }
  function shapePath(layer) {
    var p = new Path2D();
    var b = shapeBounds(layer), x = b.x, y = b.y, w = b.w, h = b.h;
    var k = layer.shape;
    if (k === 'ellipse') {
      p.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    } else if (k === 'line') {
      p.moveTo(x, y); p.lineTo(x + w, y + h);
    } else if (k === 'polygon' || k === 'star') {
      var n = Math.max(3, layer.sides || (k === 'star' ? 5 : 6));
      var cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2;
      var steps = k === 'star' ? n * 2 : n;
      for (var i = 0; i < steps; i++) {
        var a = -Math.PI / 2 + i / steps * Math.PI * 2;
        var rr = k === 'star' && i % 2 ? 0.45 : 1;
        var px = cx + Math.cos(a) * rx * rr, py = cy + Math.sin(a) * ry * rr;
        i ? p.lineTo(px, py) : p.moveTo(px, py);
      }
      p.closePath();
    } else { // rounded rect
      var r = Math.min(Math.abs(w), Math.abs(h)) * Math.min(0.5, (layer.radius == null ? 0.15 : layer.radius));
      p.moveTo(x + r, y);
      p.arcTo(x + w, y, x + w, y + h, r);
      p.arcTo(x + w, y + h, x, y + h, r);
      p.arcTo(x, y + h, x, y, r);
      p.arcTo(x, y, x + w, y, r);
      p.closePath();
    }
    return p;
  }
  function penPath(points, closed) {
    var p = new Path2D();
    points.forEach(function (pt, i) {
      if (!i) p.moveTo(pt.x, pt.y);
      else {
        var prev = points[i - 1];
        p.bezierCurveTo(
          prev.x + (prev.outX == null ? 0 : prev.outX), prev.y + (prev.outY == null ? 0 : prev.outY),
          pt.x + (pt.inX == null ? 0 : pt.inX), pt.y + (pt.inY == null ? 0 : pt.inY),
          pt.x, pt.y);
      }
    });
    if (closed && points.length > 2) p.closePath();
    return p;
  }

  // ── Smart filters ─────────────────────────────────────────────────────
  var filterCache = { key: null, canvas: null };
  function applySmartFilters(canvas, filters) {
    var ctx = canvas.getContext('2d');
    var src = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var w = canvas.width, h = canvas.height;
    var data = src.data;
    var seedBase = 0;
    filters.forEach(function (sf) {
      if (!sf.enabled) return;
      var f = PF_FILTERS.byId[sf.filterId];
      if (!f) return;
      var params = JSON.parse(JSON.stringify(sf.params || {}));
      params.seed = (params.seed | 0) + seedBase;
      seedBase += 17;
      data = f.apply(data, w, h, params);
    });
    ctx.putImageData(new ImageData(data, w, h), 0, 0);
    filterCache.key = null;
    return canvas;
  }

  // ── Compositor ────────────────────────────────────────────────────────
  // Renders a layer stack bottom-to-top into a canvas of doc size (or a
  // view-scale version when scale < 1). Returns the canvas.
  function renderStack(doc, layers, scale) {
    var W = Math.max(1, Math.round(doc.width * scale)), H = Math.max(1, Math.round(doc.height * scale));
    var c = makeCanvas(W, H);
    var ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    composeInto(ctx, doc, layers, scale, c);
    return c;
  }

  function composeInto(ctx, doc, layers, scale, ownerCanvas) {
    // pass 1: adjustment layers need what is below them within this group
    for (var i = 0; i < layers.length; i++) {
      var layer = layers[i];
      if (!layer.visible) continue;
      if (layer.kind === 'group') {
        var sub = PF_ENGINE.renderStack(doc, layer.children || [], scale);
        drawWithProps(ctx, doc, layer, sub, scale);
      } else if (layer.kind === 'adjustment') {
        // read what is drawn so far, apply the op, blend it back
        var region = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        var adj = PF_ADJUST.byId[layer.adjType];
        if (adj) {
          var params = layer.params || {};
          try { adj.apply(region.data, region.width, region.height, params); } catch (e) {}
        }
        var tmp = makeCanvas(ctx.canvas.width, ctx.canvas.height);
        tmp.getContext('2d').putImageData(region, 0, 0);
        drawWithProps(ctx, doc, layer, tmp, scale);
      } else {
        var content = renderLayerContent(doc, layer, scale);
        drawWithProps(ctx, doc, layer, content, scale);
      }
      // clipped layers: draw the following layers through this layer's alpha
      var next = layers[i + 1];
      while (next && next.clipped) {
        if (next.visible) {
          if (next.kind === 'group') {
            var sub2 = PF_ENGINE.renderStack(doc, next.children || [], scale);
            drawClipped(ctx, doc, next, sub2, scale);
          } else {
            var content2 = renderLayerContent(doc, next, scale);
            drawClipped(ctx, doc, next, content2, scale);
          }
        }
        i++;
        next = layers[i + 1];
      }
    }
  }

  function drawWithProps(ctx, doc, layer, content, scale) {
    var masked = applyMask(content, layer, scale);
    ctx.save();
    ctx.globalAlpha = layer.opacity == null ? 1 : layer.opacity;
    ctx.globalCompositeOperation = BLEND_MAP[layer.blend] || 'source-over';
    ctx.drawImage(masked, 0, 0, ctx.canvas.width / scale, ctx.canvas.height / scale);
    ctx.restore();
  }

  function drawClipped(ctx, doc, layer, content, scale) {
    // Clip this layer to the alpha of what is already on ctx (its base).
    var masked = applyMask(content, layer, scale);
    var clipCanvas = makeCanvas(ctx.canvas.width, ctx.canvas.height);
    var cctx = clipCanvas.getContext('2d');
    cctx.drawImage(ctx.canvas, 0, 0);
    cctx.globalCompositeOperation = 'destination-in';
    cctx.drawImage(masked, 0, 0);
    ctx.save();
    ctx.globalAlpha = layer.opacity == null ? 1 : layer.opacity;
    ctx.drawImage(clipCanvas, 0, 0, ctx.canvas.width / scale, ctx.canvas.height / scale);
    ctx.restore();
  }

  function applyMask(content, layer, scale) {
    if (!layer.mask || !layer.mask.enabled || !layer.mask.canvas) return content;
    var c = makeCanvas(content.width, content.height);
    var ctx = c.getContext('2d');
    ctx.drawImage(content, 0, 0);
    var mc = makeCanvas(content.width, content.height);
    var mctx = mc.getContext('2d');
    mctx.scale(content.width / layer.mask.canvas.width, content.height / layer.mask.canvas.height);
    if (layer.mask.inverted) {
      mctx.filter = 'invert(1)';
    }
    mctx.drawImage(layer.mask.canvas, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(mc, 0, 0);
    return c;
  }

  function renderDoc(doc, scale) {
    return renderStack(doc, doc.layers, scale == null ? 1 : scale);
  }

  // ── Selection ─────────────────────────────────────────────────────────
  function selFromPredicate(doc, pred) {
    var w = doc.width, h = doc.height;
    var mask = new Uint8Array(w * h);
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (pred(x, y)) {
          mask[y * w + x] = 255;
          if (x < minX) minX = x; if (x > maxX) maxX = x;
          if (y < minY) minY = y; if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    return { width: w, height: h, mask: mask, bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
  }
  function selRect(doc, x0, y0, x1, y1) {
    var rx = Math.min(x0, x1), ry = Math.min(y0, y1), rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
    return selFromPredicate(doc, function (x, y) {
      return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
    });
  }
  function selEllipse(doc, x0, y0, x1, y1) {
    var rx = Math.min(x0, x1), ry = Math.min(y0, y1), rw = Math.abs(x1 - x0), rh = Math.abs(y1 - y0);
    var cx = rx + rw / 2, cy = ry + rh / 2, a = rw / 2 || 0.5, b = rh / 2 || 0.5;
    return selFromPredicate(doc, function (x, y) {
      var nx = (x + 0.5 - cx) / a, ny = (y + 0.5 - cy) / b;
      return nx * nx + ny * ny <= 1;
    });
  }
  function selPolygon(doc, pts) {
    return selFromPredicate(doc, function (x, y) {
      return pointInPolygon(x + 0.5, y + 0.5, pts);
    });
  }
  function pointInPolygon(px, py, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function selWand(doc, data, sx, sy, tolerance, contiguous) {
    var w = doc.width, h = doc.height;
    sx = Math.min(w - 1, Math.max(0, sx | 0)); sy = Math.min(h - 1, Math.max(0, sy | 0));
    var si = (sy * w + sx) * 4;
    var r0 = data[si], g0 = data[si + 1], b0 = data[si + 2], a0 = data[si + 3];
    var tol = (tolerance || 0) * 2.55 * 3;
    var mask = new Uint8Array(w * h);
    if (!contiguous) {
      for (var i = 0; i < w * h; i++) {
        var o = i * 4;
        if (Math.abs(data[o] - r0) + Math.abs(data[o + 1] - g0) + Math.abs(data[o + 2] - b0) + Math.abs(data[o + 3] - a0) <= tol) mask[i] = 255;
      }
    } else {
      var stack = [sy * w + sx], seen = new Uint8Array(w * h);
      while (stack.length) {
        var idx = stack.pop();
        if (seen[idx]) continue;
        seen[idx] = 1;
        var o2 = idx * 4;
        if (Math.abs(data[o2] - r0) + Math.abs(data[o2 + 1] - g0) + Math.abs(data[o2 + 2] - b0) + Math.abs(data[o2 + 3] - a0) > tol) continue;
        mask[idx] = 255;
        var x = idx % w, y = (idx / w) | 0;
        if (x > 0) stack.push(idx - 1);
        if (x < w - 1) stack.push(idx + 1);
        if (y > 0) stack.push(idx - w);
        if (y < h - 1) stack.push(idx + w);
      }
    }
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (i = 0; i < w * h; i++) if (mask[i]) {
      var x3 = i % w, y3 = (i / w) | 0;
      if (x3 < minX) minX = x3; if (x3 > maxX) maxX = x3;
      if (y3 < minY) minY = y3; if (y3 > maxY) maxY = y3;
    }
    if (maxX < 0) return null;
    return { width: w, height: h, mask: mask, bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } };
  }
  function combine(doc, sel, op) {
    if (!sel) return;
    if (!doc.selection || op === 'replace') { doc.selection = sel; return; }
    var a = doc.selection.mask, b = sel.mask, n = a.length;
    for (var i = 0; i < n; i++) {
      if (op === 'add') a[i] = Math.max(a[i], b[i]);
      else if (op === 'subtract') a[i] = a[i] && !b[i] ? a[i] : 0;
      else a[i] = Math.min(a[i], b[i]);
    }
    doc.selection = boundsOf(doc.selection);
  }
  function invertSel(doc) {
    if (!doc.selection) { doc.selection = selAll(doc); return; }
    var m = doc.selection.mask;
    for (var i = 0; i < m.length; i++) m[i] = m[i] ? 0 : 255;
    doc.selection = boundsOf(doc.selection);
  }
  function selAll(doc) {
    return selRect(doc, 0, 0, doc.width, doc.height);
  }
  function boundsOf(sel) {
    var w = sel.width, h = sel.height, m = sel.mask;
    var minX = w, minY = h, maxX = -1, maxY = -1;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      if (m[y * w + x]) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return null;
    sel.bounds = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
    return sel;
  }
  function dilate(mask, w, h, r, erode) {
    var out = new Uint8Array(w * h);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var v = erode ? 255 : 0;
      for (var dy = -r; dy <= r && (erode ? v > 0 : v < 255); dy++) {
        var yy = Math.min(h - 1, Math.max(0, y + dy));
        for (var dx = -r; dx <= r; dx++) {
          var xx = Math.min(w - 1, Math.max(0, x + dx));
          var s = mask[yy * w + xx];
          if (erode) { if (!s) { v = 0; break; } }
          else if (s) { v = 255; break; }
        }
      }
      out[y * w + x] = v;
    }
    return out;
  }
  function featherSel(doc, r) {
    if (!doc.selection) return;
    var s = doc.selection, w = s.width, h = s.height;
    var a = PF_FILTERS.boxBlur(s.mask, w, h, Math.max(1, Math.round(r)), 2);
    doc.selection.mask = a;
    doc.selection = boundsOf(doc.selection);
    if (!doc.selection) doc.selection = null;
  }
  function growSel(doc, r) { if (doc.selection) { doc.selection.mask = dilate(doc.selection.mask, doc.width, doc.height, r, false); doc.selection = boundsOf(doc.selection); } }
  function contractSel(doc, r) { if (doc.selection) { doc.selection.mask = dilate(doc.selection.mask, doc.width, doc.height, r, true); doc.selection = boundsOf(doc.selection); if (!doc.selection) doc.selection = null; } }
  function borderSel(doc, r) {
    if (!doc.selection) return;
    var g = dilate(doc.selection.mask, doc.width, doc.height, r, false);
    var e = dilate(doc.selection.mask, doc.width, doc.height, r, true);
    for (var i = 0; i < g.length; i++) g[i] = g[i] && !e[i] ? 255 : 0;
    doc.selection.mask = g;
    doc.selection = boundsOf(doc.selection);
  }

  // Marching ants: boundary edges of the mask as one Path2D of 1px cells.
  function antsPath(sel) {
    if (!sel) return null;
    var w = sel.width, h = sel.height, m = sel.mask;
    var p = new Path2D();
    var any = false;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (!m[y * w + x]) continue;
        any = true;
        if (!y || !m[(y - 1) * w + x]) { p.moveTo(x, y); p.lineTo(x + 1, y); }
        if (y === h - 1 || !m[(y + 1) * w + x]) { p.moveTo(x, y + 1); p.lineTo(x + 1, y + 1); }
        if (!x || !m[y * w + x - 1]) { p.moveTo(x, y); p.lineTo(x, y + 1); }
        if (x === w - 1 || !m[y * w + x + 1]) { p.moveTo(x + 1, y); p.lineTo(x + 1, y + 1); }
      }
    }
    return any ? p : null;
  }

  // Selection mask as a canvas (for clipping paint ops).
  function maskCanvas(doc) {
    var c = makeCanvas(doc.width, doc.height);
    if (!doc.selection) return null;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(doc.width, doc.height);
    for (var i = 0; i < doc.selection.mask.length; i++) {
      img.data[i * 4 + 3] = doc.selection.mask[i] ? 255 : 0;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  return {
    BLEND_MAP: BLEND_MAP, BLEND_ORDER: BLEND_ORDER,
    renderDoc: renderDoc, renderStack: renderStack, renderLayerContent: renderLayerContent,
    applySmartFilters: applySmartFilters, drawTextLayer: drawTextLayer, drawShapeLayer: drawShapeLayer,
    shapePath: shapePath, shapeBounds: shapeBounds, penPath: penPath, paintToStyle: paintToStyle,
    selRect: selRect, selEllipse: selEllipse, selPolygon: selPolygon, selWand: selWand, selAll: selAll,
    combine: combine, invertSel: invertSel, featherSel: featherSel, growSel: growSel,
    contractSel: contractSel, borderSel: borderSel, antsPath: antsPath, maskCanvas: maskCanvas,
  };
})();