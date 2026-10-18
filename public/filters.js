/* PixelForge Studio — 25 deterministic filters.
 *
 * Each entry: { id, fields, apply(src /*Uint8ClampedArray*\/, w, h, params) -> new Uint8ClampedArray }
 * Random filters take params.seed and use mulberry32, so the same input and
 * params always give byte-identical output.
 */
'use strict';

var PF_FILTERS = (function () {
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function newBuf(w, h) { return new Uint8ClampedArray(w * h * 4); }
  function copy(src) { return new Uint8ClampedArray(src); }

  // Separable box blur x3 approximates a Gaussian.
  function boxBlur(src, w, h, r, passes) {
    var a = copy(src), b = newBuf(w, h);
    for (var p = 0; p < passes; p++) {
      // horizontal
      for (var y = 0; y < h; y++) {
        for (var c = 0; c < 4; c++) {
          var sum = 0, cnt = 0, base = y * w * 4;
          for (var x = -r; x <= r; x++) { var xi = Math.min(w - 1, Math.max(0, x)); sum += a[base + xi * 4 + c]; cnt++; }
          for (x = 0; x < w; x++) {
            b[base + x * 4 + c] = sum / cnt;
            var xo = Math.max(0, x - r), xn = Math.min(w - 1, x + r + 1);
            sum += a[base + xn * 4 + c] - a[base + xo * 4 + c];
          }
        }
      }
      // vertical
      var t = a; a = b; b = t;
      for (x = 0; x < w; x++) {
        for (c = 0; c < 4; c++) {
          sum = 0; cnt = 0;
          for (var yy = -r; yy <= r; yy++) { var yi = Math.min(h - 1, Math.max(0, yy)); sum += a[yi * w * 4 + x * 4 + c]; cnt++; }
          for (y = 0; y < h; y++) {
            b[y * w * 4 + x * 4 + c] = sum / cnt;
            var yo = Math.max(0, y - r), yn = Math.min(h - 1, y + r + 1);
            sum += a[yn * w * 4 + x * 4 + c] - a[yo * w * 4 + x * 4 + c];
          }
        }
      }
      t = a; a = b; b = t;
    }
    return a;
  }

  function convolve3(src, w, h, k, divisor, offset) {
    var out = newBuf(w, h);
    var dv = divisor == null ? 1 : divisor, of = offset || 0;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        for (var c = 0; c < 3; c++) {
          var sum = 0, ki = 0;
          for (var dy = -1; dy <= 1; dy++) {
            var yy = Math.min(h - 1, Math.max(0, y + dy));
            for (var dx = -1; dx <= 1; dx++) {
              var xx = Math.min(w - 1, Math.max(0, x + dx));
              sum += src[(yy * w + xx) * 4 + c] * k[ki++];
            }
          }
          out[(y * w + x) * 4 + c] = sum / dv + of;
        }
        out[(y * w + x) * 4 + 3] = src[(y * w + x) * 4 + 3];
      }
    }
    return out;
  }

  function sampleBilinear(src, w, h, fx, fy, out, oi) {
    var x0 = Math.floor(fx), y0 = Math.floor(fy);
    var tx = fx - x0, ty = fy - y0;
    var x1 = Math.min(w - 1, Math.max(0, x0)), y1 = Math.min(h - 1, Math.max(0, y0));
    x0 = Math.min(w - 1, Math.max(0, x0)); y0 = Math.min(h - 1, Math.max(0, y0));
    for (var c = 0; c < 4; c++) {
      var v00 = src[(y0 * w + x0) * 4 + c], v10 = src[(y0 * w + x1) * 4 + c];
      var v01 = src[(y1 * w + x0) * 4 + c], v11 = src[(y1 * w + x1) * 4 + c];
      out[oi + c] = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
    }
  }

  var F = {};

  F.gaussianBlur = { id: 'gaussianBlur', fields: [{ param: 'radius', type: 'slider', min: 0, max: 50, step: 1, def: 4 }],
    apply: function (s, w, h, p) { var r = Math.round((p.radius || 0) / 3); return r ? boxBlur(s, w, h, Math.max(1, r), 3) : copy(s); } };

  F.boxBlur = { id: 'boxBlur', fields: [{ param: 'radius', type: 'slider', min: 0, max: 50, step: 1, def: 4 }],
    apply: function (s, w, h, p) { var r = p.radius || 0; return r ? boxBlur(s, w, h, r, 1) : copy(s); } };

  F.motionBlur = { id: 'motionBlur', fields: [
      { param: 'distance', type: 'slider', min: 1, max: 60, step: 1, def: 12 },
      { param: 'angle', type: 'slider', min: 0, max: 360, step: 1, def: 0 }],
    apply: function (s, w, h, p) {
      var d = p.distance || 1, ang = (p.angle || 0) * Math.PI / 180;
      var dx = Math.cos(ang), dy = Math.sin(ang), out = newBuf(w, h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var ar = 0, ag = 0, ab = 0, aa = 0, n = 0;
        for (var i = 0; i <= d; i++) {
          var t = i / d - 0.5;
          var xx = Math.min(w - 1, Math.max(0, Math.round(x + dx * d * t)));
          var yy = Math.min(h - 1, Math.max(0, Math.round(y + dy * d * t)));
          var o = (yy * w + xx) * 4;
          ar += s[o]; ag += s[o + 1]; ab += s[o + 2]; aa += s[o + 3]; n++;
        }
        var oi = (y * w + x) * 4;
        out[oi] = ar / n; out[oi + 1] = ag / n; out[oi + 2] = ab / n; out[oi + 3] = aa / n;
      }
      return out;
    } };

  F.spinBlur = { id: 'spinBlur', fields: [{ param: 'degrees', type: 'slider', min: 1, max: 90, step: 1, def: 12 }],
    apply: function (s, w, h, p) {
      var total = (p.degrees || 1) * Math.PI / 180, steps = 8;
      var cx = w / 2, cy = h / 2, out = newBuf(w, h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var r = 0, g = 0, b = 0, a = 0;
        for (var i = 0; i < steps; i++) {
          var t = total * (i / (steps - 1) - 0.5);
          var dx = x - cx, dy = y - cy;
          var c = Math.cos(t), sn = Math.sin(t);
          sampleBilinear(s, w, h, cx + dx * c - dy * sn, cy + dx * sn + dy * c, null, 0);
          var fx = cx + dx * c - dy * sn, fy = cy + dx * sn + dy * c;
          var tmp = new Uint8ClampedArray(4);
          sampleBilinear(s, w, h, fx, fy, tmp, 0);
          r += tmp[0]; g += tmp[1]; b += tmp[2]; a += tmp[3];
        }
        var oi = (y * w + x) * 4;
        out[oi] = r / steps; out[oi + 1] = g / steps; out[oi + 2] = b / steps; out[oi + 3] = a / steps;
      }
      return out;
    } };

  F.zoomBlur = { id: 'zoomBlur', fields: [{ param: 'amount', type: 'slider', min: 1, max: 60, step: 1, def: 12 }],
    apply: function (s, w, h, p) {
      var amt = (p.amount || 1) / 100, steps = 8, cx = w / 2, cy = h / 2, out = newBuf(w, h);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var r = 0, g = 0, b = 0, a = 0, tmp = new Uint8ClampedArray(4);
        for (var i = 0; i < steps; i++) {
          var t = amt * (i / (steps - 1) - 0.5);
          sampleBilinear(s, w, h, cx + (x - cx) * (1 + t), cy + (y - cy) * (1 + t), tmp, 0);
          r += tmp[0]; g += tmp[1]; b += tmp[2]; a += tmp[3];
        }
        var oi = (y * w + x) * 4;
        out[oi] = r / steps; out[oi + 1] = g / steps; out[oi + 2] = b / steps; out[oi + 3] = a / steps;
      }
      return out;
    } };

  F.surfaceBlur = { id: 'surfaceBlur', fields: [
      { param: 'radius', type: 'slider', min: 1, max: 20, step: 1, def: 5 },
      { param: 'threshold', type: 'slider', min: 1, max: 100, step: 1, def: 20 }],
    apply: function (s, w, h, p) {
      var r = p.radius || 1, th = (p.threshold || 1) * 3, out = copy(s);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var oc = (y * w + x) * 4;
        for (var c = 0; c < 3; c++) {
          var sum = 0, wsum = 0;
          var cv = s[oc + c];
          for (var dy = -r; dy <= r; dy++) {
            var yy = Math.min(h - 1, Math.max(0, y + dy));
            for (var dx = -r; dx <= r; dx++) {
              var xx = Math.min(w - 1, Math.max(0, x + dx));
              var v = s[(yy * w + xx) * 4 + c];
              var wt = Math.max(0, 1 - Math.abs(v - cv) / (th || 1));
              sum += v * wt; wsum += wt;
            }
          }
          out[oc + c] = wsum ? sum / wsum : cv;
        }
      }
      return out;
    } };

  F.unsharpMask = { id: 'unsharpMask', fields: [
      { param: 'radius', type: 'slider', min: 1, max: 20, step: 1, def: 2 },
      { param: 'amount', type: 'slider', min: 0, max: 300, step: 1, def: 100 }],
    apply: function (s, w, h, p) {
      var blur = boxBlur(s, w, h, Math.max(1, Math.round((p.radius || 1) / 3)), 2);
      var f = (p.amount || 0) / 100, out = copy(s);
      for (var i = 0; i < s.length; i += 4) {
        out[i] = s[i] + (s[i] - blur[i]) * f;
        out[i + 1] = s[i + 1] + (s[i + 1] - blur[i + 1]) * f;
        out[i + 2] = s[i + 2] + (s[i + 2] - blur[i + 2]) * f;
      }
      return out;
    } };

  F.sharpen = { id: 'sharpen', fields: [{ param: 'amount', type: 'slider', min: 0, max: 100, step: 1, def: 40 }],
    apply: function (s, w, h, p) {
      var a = (p.amount || 0) / 100;
      return convolve3(s, w, h, [0, -a, 0, -a, 1 + 4 * a, -a, 0, -a, 0]);
    } };

  F.highPass = { id: 'highPass', fields: [{ param: 'radius', type: 'slider', min: 1, max: 20, step: 1, def: 3 }],
    apply: function (s, w, h, p) {
      var blur = boxBlur(s, w, h, p.radius || 1, 2), out = copy(s);
      for (var i = 0; i < s.length; i += 4) {
        out[i] = 128 + s[i] - blur[i];
        out[i + 1] = 128 + s[i + 1] - blur[i + 1];
        out[i + 2] = 128 + s[i + 2] - blur[i + 2];
      }
      return out;
    } };

  F.addNoise = { id: 'addNoise', fields: [
      { param: 'amount', type: 'slider', min: 0, max: 100, step: 1, def: 12 },
      { param: 'mono', type: 'check', def: true },
      { param: 'seed', type: 'hidden', def: 1 }],
    apply: function (s, w, h, p) {
      var amt = (p.amount || 0) * 2.55, rnd = mulberry32((p.seed | 0) || 1), out = copy(s), mono = p.mono !== false;
      for (var i = 0; i < s.length; i += 4) {
        if (mono) { var n = (rnd() - 0.5) * amt; out[i] += n; out[i + 1] += n; out[i + 2] += n; }
        else { out[i] += (rnd() - 0.5) * amt; out[i + 1] += (rnd() - 0.5) * amt; out[i + 2] += (rnd() - 0.5) * amt; }
      }
      return out;
    } };

  F.median = { id: 'median', fields: [{ param: 'radius', type: 'slider', min: 1, max: 10, step: 1, def: 1 }],
    apply: function (s, w, h, p) {
      var r = p.radius || 1, out = copy(s), buf = [];
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        for (var c = 0; c < 3; c++) {
          buf.length = 0;
          for (var dy = -r; dy <= r; dy++) {
            var yy = Math.min(h - 1, Math.max(0, y + dy));
            for (var dx = -r; dx <= r; dx++) {
              var xx = Math.min(w - 1, Math.max(0, x + dx));
              buf.push(s[(yy * w + xx) * 4 + c]);
            }
          }
          buf.sort(function (a, b) { return a - b; });
          out[(y * w + x) * 4 + c] = buf[buf.length >> 1];
        }
      }
      return out;
    } };

  F.dustScratches = { id: 'dustScratches', fields: [
      { param: 'radius', type: 'slider', min: 1, max: 4, step: 1, def: 2 },
      { param: 'threshold', type: 'slider', min: 0, max: 100, step: 1, def: 20 }],
    apply: function (s, w, h, p) {
      var r = p.radius || 1, th = (p.threshold || 0) * 3, out = copy(s);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var oc = (y * w + x) * 4;
        for (var c = 0; c < 3; c++) {
          var min = 255, max = 0;
          for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) {
            var v = s[(Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))) * 4 + c];
            if (v < min) min = v; if (v > max) max = v;
          }
          if (max - min > th) {
            var sum = 0, n = 0;
            for (dy = -r; dy <= r; dy++) for (dx = -r; dx <= r; dx++) {
              sum += s[(Math.min(h - 1, Math.max(0, y + dy)) * w + Math.min(w - 1, Math.max(0, x + dx))) * 4 + c]; n++;
            }
            out[oc + c] = sum / n;
          }
        }
      }
      return out;
    } };

  F.emboss = { id: 'emboss', fields: [{ param: 'angle', type: 'slider', min: 0, max: 360, step: 1, def: 135 }],
    apply: function (s, w, h, p) {
      var ang = (p.angle || 135) * Math.PI / 180;
      var dx = Math.round(Math.cos(ang)), dy = -Math.round(Math.sin(ang));
      var out = copy(s);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var xx = Math.min(w - 1, Math.max(0, x + dx)), yy = Math.min(h - 1, Math.max(0, y + dy));
        var o = (y * w + x) * 4, u = (yy * w + xx) * 4;
        for (var c = 0; c < 3; c++) out[o + c] = s[o + c] - s[u + c] + 128;
      }
      return out;
    } };

  F.findEdges = { id: 'findEdges', fields: [],
    apply: function (s, w, h) {
      return convolve3(s, w, h, [0, 1, 0, 1, -4, 1, 0, 1, 0], 1, 255);
    } };

  F.glowingEdges = { id: 'glowingEdges', fields: [{ param: 'softness', type: 'slider', min: 0, max: 20, step: 1, def: 4 }],
    apply: function (s, w, h, p) {
      var edges = F.findEdges.apply(s, w, h, {});
      var soft = boxBlur(edges, w, h, Math.max(1, p.softness || 1), 1);
      for (var i = 0; i < edges.length; i += 4) {
        for (var c = 0; c < 3; c++) {
          var a = edges[i + c] / 255, b = soft[i + c] / 255;
          edges[i + c] = Math.round(255 * (a + b - a * b));
        }
      }
      return edges;
    } };

  F.pixelate = { id: 'pixelate', fields: [{ param: 'size', type: 'slider', min: 2, max: 64, step: 1, def: 8 }],
    apply: function (s, w, h, p) {
      var sz = Math.max(2, p.size || 2), out = copy(s);
      for (var by = 0; by < h; by += sz) for (var bx = 0; bx < w; bx += sz) {
        var r = 0, g = 0, b = 0, a = 0, n = 0;
        for (var y = by; y < Math.min(h, by + sz); y++) for (var x = bx; x < Math.min(w, bx + sz); x++) {
          var o = (y * w + x) * 4; r += s[o]; g += s[o + 1]; b += s[o + 2]; a += s[o + 3]; n++;
        }
        r /= n; g /= n; b /= n; a /= n;
        for (y = by; y < Math.min(h, by + sz); y++) for (x = bx; x < Math.min(w, bx + sz); x++) {
          var oo = (y * w + x) * 4; out[oo] = r; out[oo + 1] = g; out[oo + 2] = b; out[oo + 3] = a;
        }
      }
      return out;
    } };

  F.crystallize = { id: 'crystallize', fields: [
      { param: 'size', type: 'slider', min: 3, max: 64, step: 1, def: 12 },
      { param: 'seed', type: 'hidden', def: 1 }],
    apply: function (s, w, h, p) {
      var sz = p.size || 12, rnd = mulberry32((p.seed | 0) || 1), out = copy(s);
      var sites = [];
      for (var gy = -1; gy * sz < h + sz; gy++) for (var gx = -1; gx * sz < w + sz; gx++) {
        sites.push([gx * sz + rnd() * sz, gy * sz + rnd() * sz]);
      }
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var best = -1, bd = Infinity;
        for (var i = 0; i < sites.length; i++) {
          var d = (sites[i][0] - x) * (sites[i][0] - x) + (sites[i][1] - y) * (sites[i][1] - y);
          if (d < bd) { bd = d; best = i; }
        }
        var o = (y * w + x) * 4;
        var sx = Math.min(w - 1, Math.max(0, Math.round(sites[best][0]))), sy = Math.min(h - 1, Math.max(0, Math.round(sites[best][1])));
        var u = (sy * w + sx) * 4;
        out[o] = s[u]; out[o + 1] = s[u + 1]; out[o + 2] = s[u + 2]; out[o + 3] = s[u + 3];
      }
      return out;
    } };

  F.colorHalftone = { id: 'colorHalftone', fields: [
      { param: 'size', type: 'slider', min: 2, max: 32, step: 1, def: 6 },
      { param: 'seed', type: 'hidden', def: 1 }],
    apply: function (s, w, h, p) {
      var sz = p.size || 6, rnd = mulberry32((p.seed | 0) || 1), out = newBuf(w, h);
      var jit = rnd() * sz;
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var o = (y * w + x) * 4, oi = o;
        for (var c = 0; c < 3; c++) {
          var fx = (x + jit) / sz, fy = (y + jit) / sz;
          var dx = fx - Math.floor(fx) - 0.5, dy = fy - Math.floor(fy) - 0.5;
          var dot = Math.sqrt(dx * dx + dy * dy) * 2;              // 0 centre .. 1 edge
          var v = s[o + c] / 255;
          out[oi + c] = dot < Math.sqrt(v) ? 255 : Math.round(255 * v * 0.5);
        }
        out[oi + 3] = s[o + 3];
      }
      return out;
    } };

  F.oilPaint = { id: 'oilPaint', fields: [{ param: 'radius', type: 'slider', min: 1, max: 8, step: 1, def: 3 },
      { param: 'levels', type: 'slider', min: 4, max: 32, step: 1, def: 12 }],
    apply: function (s, w, h, p) {
      var r = p.radius || 1, lv = p.levels || 12, out = copy(s);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var bins = new Array(lv), cnt = new Array(lv);
        for (var i = 0; i < lv; i++) { bins[i] = [0, 0, 0, 0]; cnt[i] = 0; }
        for (var dy = -r; dy <= r; dy++) {
          var yy = Math.min(h - 1, Math.max(0, y + dy));
          for (var dx = -r; dx <= r; dx++) {
            var xx = Math.min(w - 1, Math.max(0, x + dx));
            var o = (yy * w + xx) * 4;
            var lumBin = Math.min(lv - 1, Math.floor((s[o] * 0.3 + s[o + 1] * 0.5 + s[o + 2] * 0.2) / 255 * lv));
            bins[lumBin][0] += s[o]; bins[lumBin][1] += s[o + 1]; bins[lumBin][2] += s[o + 2]; bins[lumBin][3] += s[o + 3];
            cnt[lumBin]++;
          }
        }
        var best = 0; for (i = 1; i < lv; i++) if (cnt[i] > cnt[best]) best = i;
        var oo = (y * w + x) * 4;
        out[oo] = bins[best][0] / cnt[best]; out[oo + 1] = bins[best][1] / cnt[best];
        out[oo + 2] = bins[best][2] / cnt[best]; out[oo + 3] = bins[best][3] / cnt[best];
      }
      return out;
    } };

  function distort(s, w, h, fn) {
    var out = newBuf(w, h), tmp = new Uint8ClampedArray(4);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var p2 = fn(x, y), fx = p2[0], fy = p2[1];
      var oi = (y * w + x) * 4;
      if (fx < -1 || fx > w || fy < -1 || fy > h) { out[oi + 3] = 0; continue; }
      sampleBilinear(s, w, h, fx, fy, tmp, 0);
      out[oi] = tmp[0]; out[oi + 1] = tmp[1]; out[oi + 2] = tmp[2]; out[oi + 3] = tmp[3];
    }
    return out;
  }

  F.twirl = { id: 'twirl', fields: [{ param: 'angle', type: 'slider', min: -360, max: 360, step: 1, def: 60 },
      { param: 'radius', type: 'slider', min: 1, max: 100, step: 1, def: 50 }],
    apply: function (s, w, h, p) {
      var ang = (p.angle || 0) * Math.PI / 180, rad = (p.radius || 50) / 100 * Math.min(w, h) / 2;
      var cx = w / 2, cy = h / 2;
      return distort(s, w, h, function (x, y) {
        var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > rad) return [x, y];
        var t = (1 - d / rad); t *= t;
        var a = ang * t, c = Math.cos(a), sn = Math.sin(a);
        return [cx + dx * c - dy * sn, cy + dx * sn + dy * c];
      });
    } };

  F.pinch = { id: 'pinch', fields: [{ param: 'amount', type: 'slider', min: -100, max: 100, step: 1, def: 50 },
      { param: 'radius', type: 'slider', min: 1, max: 100, step: 1, def: 50 }],
    apply: function (s, w, h, p) {
      var amt = (p.amount || 0) / 100, rad = (p.radius || 50) / 100 * Math.min(w, h) / 2;
      var cx = w / 2, cy = h / 2;
      return distort(s, w, h, function (x, y) {
        var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
        if (d > rad || d === 0) return [x, y];
        var f = 1 - amt * Math.pow(1 - d / rad, 2);
        return [cx + dx * f, cy + dy * f];
      });
    } };

  F.spherize = { id: 'spherize', fields: [{ param: 'amount', type: 'slider', min: -100, max: 100, step: 1, def: 50 }],
    apply: function (s, w, h, p) {
      var amt = (p.amount || 0) / 100, cx = w / 2, cy = h / 2, rad = Math.min(cx, cy);
      return distort(s, w, h, function (x, y) {
        var dx = (x - cx) / rad, dy = (y - cy) / rad, d = Math.sqrt(dx * dx + dy * dy);
        if (d > 1 || d === 0) return [x, y];
        var nd = Math.asin(Math.min(1, d)) / (Math.PI / 2);
        var f = amt >= 0 ? nd / d : 1 + amt * (1 - nd / d) * -1 + (nd / d) * amt > 0 ? nd / d : nd / d;
        f = amt >= 0 ? nd / d : 1 / (nd / d || 1);
        var g = amt >= 0 ? Math.pow(d / 1, amt) * (nd / d) : 1;
        // linear refract: bulge for positive, sink for negative
        f = amt >= 0 ? nd / d : 1 + (1 - nd / d) * -amt;
        return [cx + dx * rad * f, cy + dy * rad * f];
      });
    } };

  F.ripple = { id: 'ripple', fields: [
      { param: 'amount', type: 'slider', min: 1, max: 100, step: 1, def: 20 },
      { param: 'wavelength', type: 'slider', min: 2, max: 200, step: 1, def: 30 }],
    apply: function (s, w, h, p) {
      var amt = (p.amount || 1), wl = Math.max(2, p.wavelength || 30);
      return distort(s, w, h, function (x, y) {
        return [x, y + amt * Math.sin(y / wl * Math.PI * 2)];
      });
    } };

  F.wave = { id: 'wave', fields: [
      { param: 'amplitude', type: 'slider', min: 1, max: 60, step: 1, def: 10 },
      { param: 'wavelength', type: 'slider', min: 2, max: 200, step: 1, def: 40 },
      { param: 'seed', type: 'hidden', def: 1 }],
    apply: function (s, w, h, p) {
      var amp = p.amplitude || 1, wl = Math.max(2, p.wavelength || 40), rnd = mulberry32((p.seed | 0) || 1);
      var ph = rnd() * Math.PI * 2;
      return distort(s, w, h, function (x, y) {
        return [x + amp * Math.sin(x / wl * Math.PI * 2 + ph), y + amp * Math.sin(y / wl * Math.PI * 2 + ph)];
      });
    } };

  F.polarCoordinates = { id: 'polarCoordinates', fields: [{ param: 'rectToPolar', type: 'check', def: true }],
    apply: function (s, w, h, p) {
      var toPolar = p.rectToPolar !== false, cx = w / 2, cy = h / 2, R = Math.min(cx, cy);
      var out = newBuf(w, h), tmp = new Uint8ClampedArray(4);
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var oi = (y * w + x) * 4;
        var fx, fy;
        if (toPolar) {
          var dx = x - cx, dy = y - cy;
          var r = Math.sqrt(dx * dx + dy * dy) / R, th = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
          fx = th * w; fy = r * h;
        } else {
          fx = x / w * Math.PI * 2;
          var rr = y / h * R;
          fx = cx + Math.cos(fx) * rr; fy = cy + Math.sin(fx) * rr;
        }
        if (fx < 0 || fx >= w || fy < 0 || fy >= h) { out[oi + 3] = 0; continue; }
        sampleBilinear(s, w, h, fx, fy, tmp, 0);
        out[oi] = tmp[0]; out[oi + 1] = tmp[1]; out[oi + 2] = tmp[2]; out[oi + 3] = tmp[3];
      }
      return out;
    } };

  var order = ['gaussianBlur', 'boxBlur', 'motionBlur', 'spinBlur', 'zoomBlur', 'surfaceBlur', 'unsharpMask',
    'sharpen', 'highPass', 'addNoise', 'median', 'dustScratches', 'emboss', 'findEdges', 'glowingEdges',
    'pixelate', 'crystallize', 'colorHalftone', 'oilPaint', 'twirl', 'pinch', 'spherize', 'ripple', 'wave',
    'polarCoordinates'];
  var list = order.map(function (k) { return F[k]; });
  var byId = {};
  list.forEach(function (f) { byId[f.id] = f; });

  return { list: list, byId: byId, mulberry32: mulberry32, boxBlur: boxBlur };
})();