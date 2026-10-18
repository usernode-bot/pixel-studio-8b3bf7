/* PixelForge Studio — English and Bahasa Indonesia dictionaries.
 * `en` is the source of truth; `id` is typed to the same keys by the
 * parity test in the i18n check below (run on load in dev and by tests).
 */
'use strict';

var PF_I18N = (function () {
  var en = {
    appName: 'PixelForge Studio',
    undo: 'Undo', redo: 'Redo', panels: 'Panels', export: 'Export',
    file: 'File', edit: 'Edit', image: 'Image', layer: 'Layer', select: 'Select',
    filter: 'Filter', view: 'View', help: 'Help',
    new: 'New', open: 'Open', saveProject: 'Save project', closeDoc: 'Close',
    emptyHint: 'Nothing is open yet. Create a new document or open an image. Everything you edit stays on your device.',
    original: 'Original',
    layers: 'Layers', adjustments: 'Adjustments', history: 'History', color: 'Color',
    histogram: 'Histogram', navigator: 'Navigator',
    swatches: 'Swatches', recentColors: 'Recent colors', hue: 'Hue', saturation: 'Saturation', value: 'Value',
    clip: 'Clip', unclip: 'Unclip', addMask: 'Mask', duplicate: 'Duplicate', delete: 'Delete',
    layerBlend: 'Blend mode', opacity: 'Opacity',
    locked: 'Locked', hidden: 'Hidden',
    // layer kinds
    kindRaster: 'Pixel layer', kindText: 'Text layer', kindShape: 'Shape layer',
    kindFill: 'Fill layer', kindAdjustment: 'Adjustment layer', kindGroup: 'Group',
    adjHint: 'Click an adjustment to add it as an editable adjustment layer. It stays live: change its settings any time.',
    historyDropped: 'Older steps were removed to save memory',
    // tools
    toolMove: 'Move', toolMarqueeRect: 'Rectangular marquee', toolMarqueeEllipse: 'Elliptical marquee',
    toolLasso: 'Lasso', toolLassoPoly: 'Polygonal lasso', toolWand: 'Magic wand',
    toolCrop: 'Crop', toolEyedropper: 'Eyedropper', toolBrush: 'Brush', toolPencil: 'Pencil',
    toolEraser: 'Eraser', toolBucket: 'Paint bucket', toolGradient: 'Gradient', toolClone: 'Clone stamp',
    toolHeal: 'Spot healing', toolBlur: 'Blur', toolSmudge: 'Smudge', toolDodge: 'Dodge', toolBurn: 'Burn',
    toolText: 'Text', toolShape: 'Shape', toolPen: 'Pen', toolPathSelect: 'Path selection',
    toolHand: 'Hand', toolZoom: 'Zoom',
    holdToCompare: 'Hold to compare',
    // options bar
    size: 'Size', hardness: 'Hardness', flow: 'Flow', tolerance: 'Tolerance',
    contiguous: 'Contiguous', feather: 'Feather', mode: 'Mode', add: 'Add', subtract: 'Subtract', intersect: 'Intersect',
    font: 'Font', weight: 'Weight', style: 'Style', align: 'Align', letterSpacing: 'Letter spacing',
    lineHeight: 'Line height', fontSize: 'Font size', color: 'Color',
    shapeKind: 'Shape', fill: 'Fill', stroke: 'Stroke', strokeWidth: 'Stroke width',
    gradientType: 'Gradient type', linear: 'Linear', radial: 'Radial', solid: 'Solid',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', fit: 'Fit', zoom100: '100%',
    // menus
    mNew: 'New', mOpen: 'Open image', mOpenProject: 'Open project (.pfs)', mExport: 'Export',
    mSaveProject: 'Save project (.pfs)', mClose: 'Close document',
    mUndo: 'Undo', mRedo: 'Redo',
    mFill: 'Fill selection', mContentAware: 'Content-aware fill',
    mImageSize: 'Image size', mCanvasSize: 'Canvas size',
    mRotateCW: 'Rotate 90° CW', mRotateCCW: 'Rotate 90° CCW', mFlipH: 'Flip horizontal', mFlipV: 'Flip vertical',
    mCropToSelection: 'Crop to selection',
    mNewLayer: 'New pixel layer', mNewGroup: 'New group', mNewFill: 'New fill layer',
    mDuplicate: 'Duplicate layer', mMergeDown: 'Merge down', mMergeVisible: 'Merge visible', mFlatten: 'Flatten image',
    mRasterize: 'Rasterize layer', mDeleteLayer: 'Delete layer',
    mAddMask: 'Add layer mask', mDeleteMask: 'Delete mask', mApplyMask: 'Apply mask', mInvertMask: 'Invert mask',
    mDisableMask: 'Disable mask', mEnableMask: 'Enable mask',
    mSelectAll: 'Select all', mDeselect: 'Deselect', mInvertSel: 'Invert selection',
    mFeather: 'Feather', mGrow: 'Grow', mContract: 'Contract', mBorder: 'Border',
    mFilterGallery: 'Filter gallery',
    mZoomIn: 'Zoom in', mZoomOut: 'Zoom out', mFit: 'Fit on screen', mActual: 'Actual size',
    mDisplay: 'Display', mCompare: 'Hold to compare',
    mShortcuts: 'Keyboard shortcuts',
    displayPath: 'Display path',
    pathCanvas2d: 'Standard (Canvas2D)', pathWebgpu: 'Faster (WebGPU)',
    // dialogs
    newDocTitle: 'New document', name: 'Name', width: 'Width', height: 'Height', px: 'px',
    background: 'Background', white: 'White', transparent: 'Transparent',
    create: 'Create', cancel: 'Cancel', ok: 'OK', apply: 'Apply', reset: 'Reset',
    exportTitle: 'Export', format: 'Format', quality: 'Quality', scale: 'Scale',
    resultSize: 'Result', exportBtn: 'Export', exported: 'Exported',
    jpegTransparency: 'Transparency becomes white in a JPEG.',
    avifUnsupported: 'This browser cannot write AVIF files, so AVIF is turned off. PNG, JPEG and WebP still work.',
    exportTooBig: 'This export is over 16384 px on a side or 268 megapixels. Lower the scale.',
    imageSizeTitle: 'Image size', canvasSizeTitle: 'Canvas size', resample: 'Resample',
    filterTitle: 'Filter', previewOf: 'Preview',
    adjTitle: 'Adjustment', adjLayerAdd: 'Add as adjustment layer', adjApplyDirect: 'Apply to pixels',
    featherTitle: 'Feather selection', growTitle: 'Grow selection', contractTitle: 'Contract selection',
    borderTitle: 'Border selection', amount: 'Amount',
    restoreTitle: 'Restore unsaved work?', restoreBody: 'These documents were open when the app last closed. Autosave keeps them on this device only.',
    restoreAll: 'Restore all', discard: 'Discard',
    shortcutsTitle: 'Keyboard shortcuts',
    shortcutsBody: 'V Move · M Marquee · L Lasso · W Wand · C Crop · I Eyedropper · B Brush · E Eraser · G Bucket · T Text · U Shape · H Hand · Z Zoom · Ctrl Z Undo · Ctrl Shift Z Redo · Ctrl A Select all · Ctrl D Deselect · Ctrl Shift I Invert selection · Ctrl E Merge down · Ctrl Shift E Flatten · [ ] Brush size · \\ Hold to compare',
    // status / scope messages
    stAutosaveOn: 'Autosaved on this device', stAutosaveOff: 'Autosave is off on this device',
    stNoDoc: 'No document open',
    stLocked: 'This layer is locked', stHiddenLayer: 'This layer is hidden',
    scopeGif: 'Only the first frame of this GIF was opened.',
    scopeSvg: 'This SVG became pixels at the chosen size. The vector original is not kept.',
    scopeSvgSize: 'SVG size', scopeSvgBody: 'Choose how large to draw this SVG. It becomes pixels.',
    scopeOpenFailed: 'This file could not be opened. Try PNG, JPEG, WebP, GIF, BMP or SVG.',
    scopeNoSel: 'There is no selection. Make a selection first.',
    scopeInpaintBig: 'Content-aware fill works best on small areas. This selection is over 25% of the image, so it was not filled.',
    scopeInpaintDone: 'Area filled from its surroundings. It suits small areas such as specks, wires and small objects.',
    scopeInpaintTitle: 'Content-aware fill',
    contentAware: 'Content-aware fill…',
    fillTitle: 'Fill selection', fillColor: 'Fill with',
    fontMissing: 'A font in this document is not on this device; a similar one is used instead.',
    savedProject: 'Project saved as .pfs. Layers, masks, filters, text and shapes stay editable when reopened.',
    openedProject: 'Project opened',
    pfsTooNew: 'This project was written by a newer version and cannot be opened here.',
    pfsBad: 'This file is not a PixelForge project.',
    restore: 'Restore',
    toolActive: 'Tool',
    noSelectionPixels: 'Nothing selected',
    filterApplyTitle: 'Applying filter', cancel: 'Cancel',
    demoNote: 'Staging demo: a sample document, not yours',
    curContrast: 'Curves',
    staging: 'Staging demo',
  };

  var id = {
    appName: 'PixelForge Studio',
    undo: 'Urungkan', redo: 'Ulangi', panels: 'Panel', export: 'Ekspor',
    file: 'Berkas', edit: 'Sunting', image: 'Gambar', layer: 'Lapisan', select: 'Pilihan',
    filter: 'Filter', view: 'Tampilan', help: 'Bantuan',
    new: 'Baru', open: 'Buka', saveProject: 'Simpan proyek', closeDoc: 'Tutup',
    emptyHint: 'Belum ada yang terbuka. Buat dokumen baru atau buka gambar. Semua suntingan tetap di perangkat Anda.',
    original: 'Asli',
    layers: 'Lapisan', adjustments: 'Penyesuaian', history: 'Riwayat', color: 'Warna',
    histogram: 'Histogram', navigator: 'Navigator',
    swatches: 'Palet warna', recentColors: 'Warna terbaru', hue: 'Rona', saturation: 'Saturasi', value: 'Kecerahan',
    clip: 'Klip', unclip: 'Lepas klip', addMask: 'Masker', duplicate: 'Duplikat', delete: 'Hapus',
    layerBlend: 'Mode campur', opacity: 'Opasitas',
    locked: 'Terkunci', hidden: 'Tersembunyi',
    kindRaster: 'Lapisan piksel', kindText: 'Lapisan teks', kindShape: 'Lapisan bentuk',
    kindFill: 'Lapisan isian', kindAdjustment: 'Lapisan penyesuaian', kindGroup: 'Grup',
    adjHint: 'Klik penyesuaian untuk menambahkannya sebagai lapisan penyesuaian yang dapat disunting kapan saja.',
    historyDropped: 'Langkah yang lebih lama dihapus untuk menghemat memori',
    toolMove: 'Pindah', toolMarqueeRect: 'Marque persegi', toolMarqueeEllipse: 'Marque elips',
    toolLasso: 'Lasso', toolLassoPoly: 'Lasso poligonal', toolWand: 'Tongkat ajaib',
    toolCrop: 'Pangkas', toolEyedropper: 'Pipet', toolBrush: 'Kuas', toolPencil: 'Pensil',
    toolEraser: 'Penghapus', toolBucket: 'Ember cat', toolGradient: 'Gradien', toolClone: 'Cap klon',
    toolHeal: 'Perbaikan bercak', toolBlur: 'Kabur', toolSmudge: 'Usap', toolDodge: 'Terang', toolBurn: 'Gelap',
    toolText: 'Teks', toolShape: 'Bentuk', toolPen: 'Pena', toolPathSelect: 'Pilih jalur',
    toolHand: 'Tangan', toolZoom: 'Zoom',
    holdToCompare: 'Tahan untuk bandingkan',
    size: 'Ukuran', hardness: 'Kekerasan', flow: 'Aliran', tolerance: 'Toleransi',
    contiguous: 'Bersebelahan', feather: 'Bulamakan', mode: 'Mode', add: 'Tambah', subtract: 'Kurangi', intersect: 'Iris',
    font: 'Huruf', weight: 'Ketebalan', style: 'Gaya', align: 'Rata', letterSpacing: 'Jarak huruf',
    lineHeight: 'Tinggi baris', fontSize: 'Ukuran huruf', color: 'Warna',
    shapeKind: 'Bentuk', fill: 'Isian', stroke: 'Garis tepi', strokeWidth: 'Tebal garis tepi',
    gradientType: 'Jenis gradien', linear: 'Linear', radial: 'Radial', solid: 'Penuh',
    zoomIn: 'Perbesar', zoomOut: 'Perkecil', fit: 'Paskan', zoom100: '100%',
    mNew: 'Baru', mOpen: 'Buka gambar', mOpenProject: 'Buka proyek (.pfs)', mExport: 'Ekspor',
    mSaveProject: 'Simpan proyek (.pfs)', mClose: 'Tutup dokumen',
    mUndo: 'Urungkan', mRedo: 'Ulangi',
    mFill: 'Isi pilihan', mContentAware: 'Isi sadar-konten',
    mImageSize: 'Ukuran gambar', mCanvasSize: 'Ukuran kanvas',
    mRotateCW: 'Putar 90° searah jarum jam', mRotateCCW: 'Putar 90° berlawanan jarum jam',
    mFlipH: 'Balik horizontal', mFlipV: 'Balik vertikal',
    mCropToSelection: 'Pangkas ke pilihan',
    mNewLayer: 'Lapisan piksel baru', mNewGroup: 'Grup baru', mNewFill: 'Lapisan isian baru',
    mDuplicate: 'Duplikat lapisan', mMergeDown: 'Gabung ke bawah', mMergeVisible: 'Gabung yang terlihat', mFlatten: 'Ratakan gambar',
    mRasterize: 'Rastenisasi lapisan', mDeleteLayer: 'Hapus lapisan',
    mAddMask: 'Tambah masker lapisan', mDeleteMask: 'Hapus masker', mApplyMask: 'Terapkan masker', mInvertMask: 'Balik masker',
    mDisableMask: 'Matikan masker', mEnableMask: 'Nyalaikan masker',
    mSelectAll: 'Pilih semua', mDeselect: 'Batal pilih', mInvertSel: 'Balik pilihan',
    mFeather: 'Bulamakan', mGrow: 'Perbesar', mContract: 'Perkecil', mBorder: 'Bingkai',
    mFilterGallery: 'Galeri filter',
    mZoomIn: 'Perbesar', mZoomOut: 'Perkecil', mFit: 'Paskan ke layar', mActual: 'Ukuran asli',
    mDisplay: 'Tampilan', mCompare: 'Tahan untuk bandingkan',
    mShortcuts: 'Pintasan papan tombol',
    displayPath: 'Jalur tampilan',
    pathCanvas2d: 'Standar (Canvas2D)', pathWebgpu: 'Lebih cepat (WebGPU)',
    newDocTitle: 'Dokumen baru', name: 'Nama', width: 'Lebar', height: 'Tinggi', px: 'px',
    background: 'Latar', white: 'Putih', transparent: 'Transparan',
    create: 'Buat', cancel: 'Batal', ok: 'OK', apply: 'Terapkan', reset: 'Atur ulang',
    exportTitle: 'Ekspor', format: 'Format', quality: 'Kualitas', scale: 'Skala',
    resultSize: 'Hasil', exportBtn: 'Ekspor', exported: 'Terekspor',
    jpegTransparency: 'Transparansi menjadi putih dalam JPEG.',
    avifUnsupported: 'Peramban ini tidak dapat menulis AVIF, jadi AVIF dimatikan. PNG, JPEG dan WebP tetap berfungsi.',
    exportTooBig: 'Ekspor ini melebihi 16384 px pada satu sisi atau 268 megapiksel. Turunkan skalanya.',
    imageSizeTitle: 'Ukuran gambar', canvasSizeTitle: 'Ukuran kanvas', resample: 'Sampel ulang',
    filterTitle: 'Filter', previewOf: 'Pratinjau',
    adjTitle: 'Penyesuaian', adjLayerAdd: 'Tambah sebagai lapisan penyesuaian', adjApplyDirect: 'Terapkan ke piksel',
    featherTitle: 'Bulamakan pilihan', growTitle: 'Perbesar pilihan', contractTitle: 'Perkecil pilihan',
    borderTitle: 'Bingkai pilihan', amount: 'Jumlah',
    restoreTitle: 'Pulihkan pekerjaan yang belum tersimpan?',
    restoreBody: 'Dokumen-dokumen ini terbuka saat aplikasi terakhir ditutup. Simpan otomatis hanya menyimpannya di perangkat ini.',
    restoreAll: 'Pulihkan semua', discard: 'Buang',
    shortcutsTitle: 'Pintasan papan tombol',
    shortcutsBody: 'V Pindah · M Marque · L Lasso · W Tongkat ajaib · C Pangkas · I Pipet · B Kuas · E Penghapus · G Ember · T Teks · U Bentuk · H Tangan · Z Zoom · Ctrl Z Urungkan · Ctrl Shift Z Ulangi · Ctrl A Pilih semua · Ctrl D Batal pilih · Ctrl Shift I Balik pilihan · Ctrl E Gabung ke bawah · Ctrl Shift E Ratakan · [ ] Ukuran kuas · \\ Tahan untuk bandingkan',
    stAutosaveOn: 'Tersimpan otomatis di perangkat ini', stAutosaveOff: 'Simpan otomatis mati di perangkat ini',
    stNoDoc: 'Tidak ada dokumen terbuka',
    stLocked: 'Lapisan ini terkunci', stHiddenLayer: 'Lapisan ini tersembunyi',
    scopeGif: 'Hanya bingkai pertama GIF ini yang dibuka.',
    scopeSvg: 'SVG ini menjadi piksel pada ukuran yang dipilih. Aslinya yang vektor tidak disimpan.',
    scopeSvgSize: 'Ukuran SVG', scopeSvgBody: 'Pilih seberapa besar SVG ini digambar. Ia menjadi piksel.',
    scopeOpenFailed: 'Berkas ini tidak dapat dibuka. Coba PNG, JPEG, WebP, GIF, BMP atau SVG.',
    scopeNoSel: 'Tidak ada pilihan. Buat pilihan lebih dulu.',
    scopeInpaintBig: 'Isi sadar-konten paling cocok untuk area kecil. Pilihan ini lebih dari 25% gambar, jadi tidak diisi.',
    scopeInpaintDone: 'Area diisi dari sekitarnya. Cocok untuk area kecil seperti noda, kabel dan objek kecil.',
    scopeInpaintTitle: 'Isi sadar-konten',
    contentAware: 'Isi sadar-konten…',
    fillTitle: 'Isi pilihan', fillColor: 'Isi dengan',
    fontMissing: 'Sebuah huruf di dokumen ini tidak ada di perangkat ini; yang serupa dipakai sebagai gantinya.',
    savedProject: 'Proyek tersimpan sebagai .pfs. Lapisan, masker, filter, teks dan bentuk tetap dapat disunting saat dibuka kembali.',
    openedProject: 'Proyek dibuka',
    pfsTooNew: 'Proyek ini ditulis oleh versi yang lebih baru dan tidak dapat dibuka di sini.',
    pfsBad: 'Berkas ini bukan proyek PixelForge.',
    restore: 'Pulihkan',
    toolActive: 'Alat',
    noSelectionPixels: 'Tidak ada yang dipilih',
    filterApplyTitle: 'Menerapkan filter',
    demoNote: 'Demo pementasan: dokumen contoh, bukan milik Anda',
    curContrast: 'Kurva',
    staging: 'Demo pementasan',
  };

  function sameKeys() {
    var ek = Object.keys(en), ik = Object.keys(id);
    if (ek.length !== ik.length) return false;
    for (var i = 0; i < ek.length; i++) {
      if (!(ek[i] in id) || typeof id[ek[i]] !== 'string' || !id[ek[i]]) return false;
      if (typeof en[ek[i]] !== 'string' || !en[ek[i]]) return false;
    }
    return true;
  }
  if (!sameKeys() && window.console) console.error('i18n dictionaries differ in keys');

  var lang = 'en';
  function pickLang() {
    var stored = null;
    try { stored = window.localStorage.getItem('pf.lang'); } catch (e) {}
    if (stored === 'en' || stored === 'id') return stored;
    var un = window.usernode && window.usernode.getUserLocale && window.usernode.getUserLocale();
    var cands = [];
    if (un) cands.push(un);
    if (navigator.language) cands.push(navigator.language);
    for (var i = 0; i < cands.length; i++) {
      if (/^id(-|$)/i.test(cands[i]) || /^in(-|$)/i.test(cands[i])) return 'id';
      if (/^en(-|$)/i.test(cands[i])) return 'en';
    }
    return 'en';
  }
  lang = pickLang();
  window.addEventListener('usernode:locale-changed', function () {
    var next = pickLang();
    if (next !== lang) { lang = next; if (window.PFApp && window.PFApp.applyLang) window.PFApp.applyLang(); }
  });

  return {
    lang: function () { return lang; },
    setLang: function (l) {
      if (l === 'en' || l === 'id') { lang = l; try { window.localStorage.setItem('pf.lang', l); } catch (e) {} }
    },
    t: function (key) {
      var d = lang === 'id' ? id : en;
      return (key in d) ? d[key] : (key in en ? en[key] : key);
    },
    check: sameKeys,
  };
})();