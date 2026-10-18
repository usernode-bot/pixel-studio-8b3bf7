/* Pixel Studio — the editor.
 *
 * One photo at a time, entirely in the browser:
 *   empty -> loading -> ready (three sliders, hold-to-compare, Reset, Save)
 * with an open-error state (inline when a photo is already open) and a
 * save-error line. Nothing is uploaded or stored.
 */
'use strict';

(function () {
  var $ = function (id) { return document.getElementById(id); };

  var els = {
    demoNote: $('demo-note'),
    fileInfo: $('file-info'),
    fileInfoLoading: $('file-info-loading'),
    openBtn: $('open-btn'),
    openErrorInline: $('open-error-inline'),
    retryBtn: $('retry-btn'),
    retryBtnState: $('retry-btn-state'),
    stage: $('stage'),
    emptyState: $('empty-state'),
    openErrorState: $('open-error-state'),
    opening: $('opening'),
    canvas: $('preview-canvas'),
    chip: $('chip'),
    chipText: $('chip-text'),
    sliders: $('sliders'),
    bar: $('bar'),
    resetBtn: $('reset-btn'),
    saveBtn: $('save-btn'),
    saveBtnText: $('save-btn-text'),
    saveError: $('save-error'),
    fileInput: $('file-input'),
  };

  var SLIDERS = ['brightness', 'contrast', 'saturation'];
  var values = { brightness: 0, contrast: 0, saturation: 0 };

  // The open photo: { drawable, width, height, name, type, url }.
  // `drawable` is an ImageBitmap or HTMLImageElement, both fine for drawImage.
  var current = null;
  var state = 'empty';
  var holding = false;
  var saving = false;
  var filterRaf = 0;

  // ── State machine ──────────────────────────────────────────────────────
  // Shows exactly one stage state at a time; the header, sliders and bar
  // follow the same state.
  function setState(next) {
    state = next;
    var ready = next === 'ready';
    var noPhoto = next === 'empty' || next === 'error' || next === 'loading';

    els.emptyState.hidden = next !== 'empty';
    els.openErrorState.hidden = next !== 'error';
    els.opening.hidden = next !== 'loading';
    els.canvas.hidden = !ready;
    els.chip.hidden = !ready;
    els.sliders.hidden = !ready;
    els.bar.hidden = !ready;
    els.saveError.hidden = true;
    // The header Open button appears only once a photo is open, so on the
    // empty screen "Open a photo" is the single call to action.
    els.openBtn.hidden = !current;

    els.fileInfo.hidden = !(ready && current);
    els.fileInfoLoading.hidden = next !== 'loading';
    if (ready && current) {
      els.fileInfo.textContent = current.name + ' · ' + current.width + ' × ' + current.height;
    }
  }

  function showOpenError() {
    // A photo already open keeps it and its edits; the message is a line
    // above the stage. With no photo, the message fills the stage.
    if (current) {
      els.openErrorInline.hidden = false;
    } else {
      setState('error');
    }
  }

  // ── Sliders ────────────────────────────────────────────────────────────
  function filterString() {
    return 'brightness(' + (1 + values.brightness / 200) + ')' +
      ' contrast(' + (1 + values.contrast / 200) + ')' +
      ' saturate(' + (1 + values.saturation / 100) + ')';
  }

  function formatValue(v) { return v > 0 ? '+' + v : String(v); }

  function updateSlider(name) {
    var v = values[name];
    var input = $('slider-' + name);
    var label = $('val-' + name);
    if (label) label.textContent = formatValue(v);
    if (input) {
      input.value = v;
      // The accent fill runs from the 0 mark (50%) to the knob.
      var pct = (v + 100) / 2;
      input.style.setProperty('--from', Math.min(50, pct) + '%');
      input.style.setProperty('--to', Math.max(50, pct) + '%');
    }
  }

  function updateReset() {
    var changed = SLIDERS.some(function (n) { return values[n] !== 0; });
    els.resetBtn.disabled = !changed;
  }

  // Only the canvas's CSS filter changes while dragging, never pixel work:
  // updates are throttled to one per animation frame.
  function scheduleFilter() {
    if (filterRaf) return;
    filterRaf = requestAnimationFrame(function () {
      filterRaf = 0;
      if (state === 'ready' && !holding) els.canvas.style.filter = filterString();
    });
  }

  SLIDERS.forEach(function (name) {
    $('slider-' + name).addEventListener('input', function () {
      values[name] = Number(this.value);
      updateSlider(name);
      scheduleFilter();
      updateReset();
    });
  });

  function setSliders(next) {
    SLIDERS.forEach(function (name) {
      values[name] = next ? (next[name] || 0) : 0;
      updateSlider(name);
    });
    updateReset();
    scheduleFilter();
  }

  els.resetBtn.addEventListener('click', function () { setSliders(null); });

  // ── Preview canvas ─────────────────────────────────────────────────────
  function drawPreview() {
    if (!current) return;
    var stage = els.stage;
    var cssW = stage.clientWidth;
    var cssH = stage.clientHeight;
    if (!cssW || !cssH) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var canvas = els.canvas;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';

    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // The whole photo, contained: never crop what came off the camera.
    var scale = Math.min(cssW / current.width, cssH / current.height);
    var dw = current.width * scale;
    var dh = current.height * scale;
    ctx.drawImage(current.drawable, (cssW - dw) / 2 * dpr, (cssH - dh) / 2 * dpr, dw * dpr, dh * dpr);

    canvas.style.filter = filterString();
  }

  window.addEventListener('resize', function () {
    if (state === 'ready') requestAnimationFrame(drawPreview);
  });

  // ── Hold to compare ────────────────────────────────────────────────────
  function startHold() {
    if (state !== 'ready' || holding) return;
    holding = true;
    els.canvas.style.filter = 'none';
    els.chipText.textContent = 'Original';
  }

  function endHold() {
    if (!holding) return;
    holding = false;
    els.canvas.style.filter = filterString();
    els.chipText.textContent = 'Hold to see the original';
  }

  els.stage.addEventListener('pointerdown', function (e) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    if (els.stage.setPointerCapture) {
      try { els.stage.setPointerCapture(e.pointerId); } catch (_) {}
    }
    startHold();
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (type) {
    els.stage.addEventListener(type, endHold);
  });
  els.stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  els.stage.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      startHold();
    }
  });
  els.stage.addEventListener('keyup', function (e) {
    if (e.key === ' ' || e.key === 'Spacebar') endHold();
  });

  // ── Opening a photo ────────────────────────────────────────────────────
  // createImageBitmap keeps the file's EXIF orientation. Where it cannot
  // read a format (SVG, some older browsers), fall back to an <img>.
  function decodeFile(file) {
    return new Promise(function (resolve, reject) {
      function tryBitmap(opts) {
        createImageBitmap(file, opts).then(function (bitmap) {
          resolve({ drawable: bitmap, width: bitmap.width, height: bitmap.height });
        }).catch(function () { next(); });
      }
      var step = 0;
      function next() {
        step += 1;
        if (step === 1 && typeof createImageBitmap === 'function') {
          try { tryBitmap({ imageOrientation: 'from-image' }); return; } catch (_) { }
        }
        if (step === 2 && typeof createImageBitmap === 'function') {
          try { tryBitmap(undefined); return; } catch (_) { }
        }
        if (step === 3) {
          var url = URL.createObjectURL(file);
          var img = new Image();
          img.onload = function () {
            resolve({ drawable: img, width: img.naturalWidth, height: img.naturalHeight, url: url });
          };
          img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
          img.src = url;
          return;
        }
        reject(new Error('decode failed'));
      }
      next();
    });
  }

  function closeCurrent() {
    if (!current) return;
    if (current.url) URL.revokeObjectURL(current.url);
    if (current.drawable && current.drawable.close) current.drawable.close();
    current = null;
  }

  function usePhoto(decoded, name, type) {
    closeCurrent();
    current = {
      drawable: decoded.drawable,
      width: decoded.width,
      height: decoded.height,
      url: decoded.url,
      name: name || 'photo',
      type: type || '',
    };
    setSliders(null);
    drawPreview();
    setState('ready');
  }

  function openFile(file) {
    if (!file) return; // a cancelled picker changes nothing
    els.openErrorInline.hidden = true;
    setState('loading');
    decodeFile(file).then(function (decoded) {
      usePhoto(decoded, file.name, file.type);
    }).catch(function () {
      // The old photo stays open with its edits; only the message shows.
      if (current) {
        setState('ready');
        showOpenError();
      } else {
        setState('error');
      }
    });
  }

  function pickFile() {
    els.fileInput.value = '';
    els.fileInput.click();
  }

  els.fileInput.addEventListener('change', function () {
    openFile(this.files && this.files[0]);
  });
  els.openBtn.addEventListener('click', pickFile);
  els.emptyState.querySelector('button').addEventListener('click', pickFile);
  els.retryBtn.addEventListener('click', pickFile);
  els.retryBtnState.addEventListener('click', pickFile);

  // ── Save photo ─────────────────────────────────────────────────────────
  // Draws the photo at its full size, applies the same maths as the preview
  // (applyAdjust), and downloads the blob. The original file never changes.
  function saveEdited() {
    if (!current || saving) return;
    saving = true;
    els.saveBtn.disabled = true;
    els.saveBtnText.textContent = 'Saving…';
    els.saveError.hidden = true;

    var finish = function () {
      saving = false;
      els.saveBtn.disabled = false;
      els.saveBtnText.textContent = 'Save photo';
    };

    try {
      var canvas = document.createElement('canvas');
      canvas.width = current.width;
      canvas.height = current.height;
      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(current.drawable, 0, 0, current.width, current.height);
      var imgData = ctx.getImageData(0, 0, current.width, current.height);
      applyAdjust(imgData, values);
      ctx.putImageData(imgData, 0, 0);
    } catch (err) {
      finish();
      els.saveError.hidden = false;
      return;
    }

    // JPEG stays JPEG, PNG stays PNG, anything else saves as PNG.
    var type = current.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';

    var fail = function () {
      finish();
      els.saveError.hidden = false;
    };

    try {
      canvas.toBlob(function (blob) {
      finish();
      if (!blob) { els.saveError.hidden = false; return; }
      var base = current.name.replace(/\.[^.]+$/, '') || 'photo';
      var a = document.createElement('a');
      var href = URL.createObjectURL(blob);
      a.href = href;
      a.download = base + '-edited.' + (type === 'image/jpeg' ? 'jpg' : 'png');
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(href); }, 1000);
    }, type, type === 'image/jpeg' ? 0.92 : undefined);
    } catch (err) {
      fail();
    }
  }

  els.saveBtn.addEventListener('click', saveEdited);

  // ── Staging demo (?demo=1) ─────────────────────────────────────────────
  // A made-up drawn photo with three adjustments already applied. Stores
  // nothing and works anywhere the app is opened with ?demo=1.
  function loadDemo() {
    els.demoNote.hidden = false;
    setState('loading');
    var img = new Image();
    img.onload = function () {
      usePhoto({ drawable: img, width: 4032, height: 3024 }, 'harbour-sunrise.jpg', 'image/jpeg');
      setSliders({ brightness: 12, contrast: 8, saturation: 24 });
    };
    img.onerror = function () { setState('error'); };
    img.src = '/demo/harbour-sunrise.svg';
  }

  if (new URLSearchParams(location.search).get('demo') === '1') loadDemo();
  else setState('empty');
})();