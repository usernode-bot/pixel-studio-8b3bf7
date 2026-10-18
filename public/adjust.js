/* PixelForge Studio — the 12 adjustments as pure functions.
 *
 * Each entry: { id, fields: [{param, type, min, max, step, def}], apply(data, w, h, params) }
 * `data` is a Uint8ClampedArray (RGBA). Identity params must leave pixels
 * unchanged; the same input and params always give the same output.
 */
'use strict';

var PF_ADJUST = (function () {
  var clamp8 = function (v) { return v < 0 ? 0 : v > 255 ? 255 : v; };

  function lum(r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; }

  var A = {};

  A.brightnessContrast = {
    id: 'brightnessContrast',
    fields: [
      { param: 'brightness', type: 'slider', min: -100, max: 100, step: 1, def: 0 },
      { param: 'contrast', type: 'slider', min: -100, max: 100, step: 1, def: 0 },
    ],
    apply: function (d, w, h, p) {
      var b = (p.brightness || 0) * 1.28;          // matches the old applyAdjust
      var c = (p.contrast || 0) / 100;
      var f = c <= 0 ? 1 + c : 1 / (1 - c * 0.99); // same curve as the one-photo app
      for (var i = 0; i < d.length; i += 4) {
        d[i] = clamp8((d[i] + b - 128) * f + 128);
        d[i + 1] = clamp8((d[i + 1] + b - 128) * f + 128);
        d[i + 2] = clamp8((d[i + 2] + b - 128) * f + 128);
      }
    },
  };

  A.levels = {
    id: 'levels',
    fields: [
      { param: 'inBlack', type: 'slider', min: 0, max: 254, step: 1, def: 0 },
      { param: 'inWhite', type: 'slider', min: 1, max: 255, step: 1, def: 255 },
      { param: 'gamma', type: 'slider', min: 10, max: 300, step: 1, def: 100 },
      { param: 'outBlack', type: 'slider', min: 0, max: 255, step: 1, def: 0 },
      { param: 'outWhite', type: 'slider', min: 0, max: 255, step: 1, def: 255 },
    ],
    apply: function (d, w, h, p) {
      var ib = p.inBlack, iw = Math.max(p.inWhite, ib + 1), g = p.gamma / 100;
      var ob = p.outBlack, ow = p.outWhite;
      var lut = new Uint8ClampedArray(256);
      for (var v = 0; v < 256; v++) {
        var n = (v - ib) / (iw - ib);
        n = Math.max(0, Math.min(1, n));
        n = Math.pow(n, 1 / g);
        lut[v] = clamp8(ob + n * (ow - ob));
      }
      for (var i = 0; i < d.length; i += 4) {
        d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
      }
    },
  };

  A.curves = {
    id: 'curves',
    fields: [
      { param: 'points', type: 'curves', def: [[0, 0], [128, 128], [255, 255]] },
    ],
    apply: function (d, w, h, p) {
      var pts = (p.points && p.points.length >= 2) ? p.points.slice().sort(function (a, b) { return a[0] - b[0]; }) : [[0, 0], [255, 255]];
      var lut = new Uint8ClampedArray(256);
      var j = 0;
      for (var v = 0; v < 256; v++) {
        while (j < pts.length - 2 && v > pts[j + 1][0]) j++;
        var a = pts[j], b = pts[j + 1];
        var t = b[0] === a[0] ? 0 : (v - a[0]) / (b[0] - a[0]);
        lut[v] = clamp8(a[1] + t * (b[1] - a[1]));
      }
      for (var i = 0; i < d.length; i += 4) {
        d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
      }
    },
  };

  A.exposure = {
    id: 'exposure',
    fields: [{ param: 'stops', type: 'slider', min: -300, max: 300, step: 1, def: 0 }],
    apply: function (d, w, h, p) {
      var f = Math.pow(2, (p.stops || 0) / 100);
      if (f === 1) return;
      for (var i = 0; i < d.length; i += 4) {
        d[i] = clamp8(d[i] * f); d[i + 1] = clamp8(d[i + 1] * f); d[i + 2] = clamp8(d[i + 2] * f);
      }
    },
  };

  A.vibrance = {
    id: 'vibrance',
    fields: [{ param: 'amount', type: 'slider', min: -100, max: 100, step: 1, def: 0 }],
    apply: function (d, w, h, p) {
      var amt = (p.amount || 0) / 100;
      if (!amt) return;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        var sat = (mx - mn) / 255;
        var f = amt * (1 - sat);          // already-saturated pixels move less
        var l = lum(r, g, b);
        d[i] = clamp8(l + (r - l) * (1 + f));
        d[i + 1] = clamp8(l + (g - l) * (1 + f));
        d[i + 2] = clamp8(l + (b - l) * (1 + f));
      }
    },
  };

  A.hueSaturation = {
    id: 'hueSaturation',
    fields: [
      { param: 'hue', type: 'slider', min: -180, max: 180, step: 1, def: 0 },
      { param: 'sat', type: 'slider', min: -100, max: 100, step: 1, def: 0 },
      { param: 'light', type: 'slider', min: -100, max: 100, step: 1, def: 0 },
    ],
    apply: function (d, w, h, p) {
      var dh = (p.hue || 0) / 360, s = 1 + (p.sat || 0) / 100, l = (p.light || 0) / 100;
      if (!dh && s === 1 && !l) return;
      for (var i = 0; i < d.length; i += 4) {
        var hsl = rgbToHsl(d[i], d[i + 1], d[i + 2]);
        hsl[0] = (hsl[0] + dh + 1) % 1;
        hsl[1] = Math.max(0, Math.min(1, hsl[1] * s));
        hsl[2] = Math.max(0, Math.min(1, hsl[2] + l * (hsl[2] < 0.5 ? hsl[2] : 1 - hsl[2])));
        var rgb = hslToRgb(hsl[0], hsl[1], hsl[2]);
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
      }
    },
  };

  A.colorBalance = {
    id: 'colorBalance',
    fields: [
      { param: 'r', type: 'slider', min: -100, max: 100, step: 1, def: 0 },
      { param: 'g', type: 'slider', min: -100, max: 100, step: 1, def: 0 },
      { param: 'b', type: 'slider', min: -100, max: 100, step: 1, def: 0 },
    ],
    apply: function (d, w, h, p) {
      var r = p.r || 0, g = p.g || 0, b = p.b || 0;
      if (!r && !g && !b) return;
      for (var i = 0; i < d.length; i += 4) {
        var mid = 1 - Math.abs((d[i + 1] / 255) * 2 - 1); // weight toward midtones
        d[i] = clamp8(d[i] + r * mid * 0.6);
        d[i + 1] = clamp8(d[i + 1] + g * mid * 0.6);
        d[i + 2] = clamp8(d[i + 2] + b * mid * 0.6);
      }
    },
  };

  A.blackWhite = {
    id: 'blackWhite',
    fields: [
      { param: 'r', type: 'slider', min: -100, max: 100, step: 1, def: 40 },
      { param: 'g', type: 'slider', min: -100, max: 100, step: 1, def: 40 },
      { param: 'b', type: 'slider', min: -100, max: 100, step: 1, def: 20 },
    ],
    apply: function (d, w, h, p) {
      var wr = 0.2126 * (1 + (p.r || 0) / 100), wg = 0.7152 * (1 + (p.g || 0) / 100), wb = 0.0722 * (1 + (p.b || 0) / 100);
      var s = wr + wg + wb;
      for (var i = 0; i < d.length; i += 4) {
        var y = clamp8((wr * d[i] + wg * d[i + 1] + wb * d[i + 2]) / s * 1.0);
        d[i] = y; d[i + 1] = y; d[i + 2] = y;
      }
    },
  };

  A.photoFilter = {
    id: 'photoFilter',
    fields: [
      { param: 'color', type: 'color', def: '#ec8a3c' },
      { param: 'density', type: 'slider', min: 0, max: 100, step: 1, def: 25 },
    ],
    apply: function (d, w, h, p) {
      var c = hexToRgb(p.color || '#ec8a3c'), k = (p.density || 0) / 100;
      if (!k) return;
      for (var i = 0; i < d.length; i += 4) {
        d[i] = clamp8(d[i] * (1 - k) + c[0] * k * (d[i] / 255) * 1.2);
        d[i + 1] = clamp8(d[i + 1] * (1 - k) + c[1] * k * (d[i + 1] / 255) * 1.2);
        d[i + 2] = clamp8(d[i + 2] * (1 - k) + c[2] * k * (d[i + 2] / 255) * 1.2);
      }
    },
  };

  A.invert = {
    id: 'invert',
    fields: [],
    apply: function (d) {
      for (var i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
      }
    },
  };

  A.posterize = {
    id: 'posterize',
    fields: [{ param: 'levels', type: 'slider', min: 2, max: 32, step: 1, def: 6 }],
    apply: function (d, w, h, p) {
      var n = Math.max(2, p.levels || 6);
      var lut = new Uint8ClampedArray(256);
      for (var v = 0; v < 256; v++) lut[v] = Math.round(Math.round(v / 255 * (n - 1)) / (n - 1) * 255);
      for (var i = 0; i < d.length; i += 4) {
        d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]];
      }
    },
  };

  A.threshold = {
    id: 'threshold',
    fields: [{ param: 'level', type: 'slider', min: 0, max: 255, step: 1, def: 128 }],
    apply: function (d, w, h, p) {
      var t = p.level == null ? 128 : p.level;
      for (var i = 0; i < d.length; i += 4) {
        var y = lum(d[i], d[i + 1], d[i + 2]) >= t ? 255 : 0;
        d[i] = y; d[i + 1] = y; d[i + 2] = y;
      }
    },
  };

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, h = 0, s = 0;
    if (mx !== mn) {
      var dd = mx - mn;
      s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn);
      if (mx === r) h = ((g - b) / dd + (g < b ? 6 : 0)) / 6;
      else if (mx === g) h = ((b - r) / dd + 2) / 6;
      else h = ((r - g) / dd + 4) / 6;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    if (s === 0) { var y = Math.round(l * 255); return [y, y, y]; }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var pp = 2 * l - q;
    return [
      clamp8(hueToRgb(pp, q, h + 1 / 3) * 255),
      clamp8(hueToRgb(pp, q, h) * 255),
      clamp8(hueToRgb(pp, q, h - 1 / 3) * 255),
    ];
  }
  function hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
  function hexToRgb(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return [0, 0, 0];
    var n = parseInt(m[1], 16);
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }

  var order = ['brightnessContrast', 'levels', 'curves', 'exposure', 'vibrance', 'hueSaturation',
    'colorBalance', 'blackWhite', 'photoFilter', 'invert', 'posterize', 'threshold'];
  var list = order.map(function (k) { return A[k]; });
  var byId = {};
  list.forEach(function (a) { byId[a.id] = a; });

  return { list: list, byId: byId, hexToRgb: hexToRgb, rgbToHex: function (c) {
    return '#' + c.map(function (v) { return ('0' + Math.round(v).toString(16)).slice(-2); }).join('');
  } };
})();