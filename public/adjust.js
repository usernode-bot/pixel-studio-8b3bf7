/* Pixel Studio — the adjustment math.
 *
 * applyAdjust(imageData, {brightness, contrast, saturation}) applies the
 * three sliders to an ImageData buffer in place. It matches the CSS filter
 * chain used for the live preview,
 *   brightness(1 + b/200) contrast(1 + c/200) saturate(1 + s/100)
 * applied in that order, so the preview a person sees while dragging is the
 * file they download. Per the CSS Filter Effects shorthand, the maths runs
 * in sRGB: brightness multiplies, contrast pivots around mid-grey
 * ((x - 0.5) * k + 0.5), saturate is the feColorMatrix type="saturate"
 * matrix. Alpha is untouched; every value clamps to 0..255.
 *
 * Loaded as a plain script; app.js reads the global applyAdjust.
 */
'use strict';

function applyAdjust(imageData, adj) {
  var brightness = (adj && adj.brightness) || 0;
  var contrast = (adj && adj.contrast) || 0;
  var saturation = (adj && adj.saturation) || 0;
  if (!brightness && !contrast && !saturation) return imageData;

  var bm = 1 + brightness / 200;
  var cm = 1 + contrast / 200;
  var sm = 1 + saturation / 100;

  // feColorMatrix type="saturate", value sm (rows R, G, B).
  var m11 = 0.213 + 0.787 * sm, m12 = 0.715 - 0.715 * sm, m13 = 0.072 - 0.072 * sm;
  var m21 = 0.213 - 0.213 * sm, m22 = 0.715 + 0.285 * sm, m23 = 0.072 - 0.072 * sm;
  var m31 = 0.213 - 0.213 * sm, m32 = 0.715 - 0.715 * sm, m33 = 0.072 + 0.928 * sm;

  var data = imageData.data;
  for (var i = 0; i < data.length; i += 4) {
    var r = data[i] * bm;
    var g = data[i + 1] * bm;
    var b = data[i + 2] * bm;

    r = (r - 127.5) * cm + 127.5;
    g = (g - 127.5) * cm + 127.5;
    b = (b - 127.5) * cm + 127.5;

    var nr = r * m11 + g * m12 + b * m13;
    var ng = r * m21 + g * m22 + b * m23;
    var nb = r * m31 + g * m32 + b * m33;

    data[i] = nr < 0 ? 0 : nr > 255 ? 255 : nr;
    data[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng;
    data[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb;
  }
  return imageData;
}