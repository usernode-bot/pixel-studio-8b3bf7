/* PixelForge Studio — document and layer model, multi-document store, history.
 *
 * A Doc is { id, name, width, height, layers (bottom to top), selection,
 * guides, activeLayerId, view { zoom, panX, panY }, original (canvas), dirty }.
 * A Layer is the base record plus kind-specific fields; pixel data lives on
 * HTMLCanvasElement (raster.canvas, mask.canvas) so drawing stays cheap and
 * history can share canvases instead of copying pixels.
 */
'use strict';

var PF_CORE = (function () {
  var nextId = 1;
  function uid(prefix) { return prefix + (nextId++); }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0);
    return c;
  }

  function baseLayer(name, kind) {
    return {
      id: uid('l'), name: name || 'Layer', kind: kind,
      visible: true, locked: false, opacity: 1, blend: 'normal', clipped: false,
      mask: null,               // { canvas, enabled, inverted }
      filters: [],              // [{ id, filterId, params, enabled }]
    };
  }

  function createDoc(name, width, height, background) {
    var doc = {
      id: uid('d'), name: name || 'Untitled', width: width, height: height,
      layers: [], selection: null, guides: [],
      activeLayerId: null, view: { zoom: 1, panX: 0, panY: 0 },
      original: null, dirty: false, demo: false,
      antsPath: null, antsBounds: null,
    };
    if (background === 'white') {
      var l = baseLayer(name === 'Untitled' ? 'Background' : name, 'raster');
      l.name = 'Background';
      l.canvas = makeCanvas(width, height);
      var ctx = l.canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      doc.layers.push(l);
      doc.activeLayerId = l.id;
    }
    return doc;
  }

  // ── Layer tree helpers ────────────────────────────────────────────────
  // flatLayers walks groups; each returned item is { layer, parent (array), index }.
  function walk(layers, parentArr, out) {
    for (var i = 0; i < layers.length; i++) {
      out.push({ layer: layers[i], parent: layers, index: i });
      if (layers[i].kind === 'group' && layers[i].children) walk(layers[i].children, layers[i].children, out);
    }
    return out;
  }
  function flat(doc) { return walk(doc.layers, doc.layers, []); }
  function findLayer(doc, id) {
    var all = flat(doc);
    for (var i = 0; i < all.length; i++) if (all[i].layer.id === id) return all[i];
    return null;
  }
  function activeEntry(doc) {
    return doc.activeLayerId ? findLayer(doc, doc.activeLayerId) : (flat(doc)[0] || null);
  }

  // Copy layer metadata without copying pixels (canvases are shared).
  function cloneLayerMeta(l) {
    var c = {};
    for (var k in l) c[k] = l[k];
    if (l.children) c.children = l.children.map(cloneLayerMeta);
    if (l.mask) c.mask = { canvas: l.mask.canvas, enabled: l.mask.enabled, inverted: l.mask.inverted };
    if (l.filters) c.filters = l.filters.map(function (f) { return { id: f.id, filterId: f.filterId, params: JSON.parse(JSON.stringify(f.params)), enabled: f.enabled }; });
    return c;
  }
  function snapshotTree(doc) {
    return doc.layers.map(cloneLayerMeta);
  }

  // ── History ───────────────────────────────────────────────────────────
  // Budget across all documents, oldest entries dropped first.
  var historyBudget = (function () {
    var gb = (navigator.deviceMemory || 4) * 64;
    return Math.max(128, Math.min(1024, gb)) * 1024 * 1024;
  })();
  var usedBytes = 0;

  function makeStore() {
    var entries = [];        // newest last
    var index = -1;          // which entry is applied (points at redo tip)
    var droppedNote = false;
    return {
      entries: entries,
      get index() { return index; },
      set index(v) { index = v; },
      dropped: function () { return droppedNote; },
      markDropped: function () { droppedNote = true; },
      push: function (entry) {
        // drop any redo tail
        while (entries.length > index + 1) {
          usedBytes -= entries.pop().bytes || 0;
        }
        entries.push(entry);
        index = entries.length - 1;
        usedBytes += entry.bytes || 0;
        while (usedBytes > historyBudget && entries.length > 1) {
          usedBytes -= entries.shift().bytes || 0;
          index--;
          droppedNote = true;
        }
        if (index < 0) index = -1;
      },
      undo: function () { if (index >= 0) { entries[index].undo(); index--; return true; } return false; },
      redo: function () { if (index < entries.length - 1) { index++; entries[index].redo(); return true; } return false; },
      jumpTo: function (i) {
        while (index > i) { entries[index].undo(); index--; }
        while (index < i) { index++; entries[index].redo(); }
      },
    };
  }

  // pushHistory(doc, label, {undo, redo, bytes})
  function pushHistory(doc, label, undoFn, redoFn, bytes) {
    if (!doc.history) doc.history = makeStore();
    doc.history.push({ label: label, undo: undoFn, redo: redoFn, bytes: bytes || 0 });
    doc.dirty = true;
  }

  // A pixel edit history entry: dirty-rect before/after ImageData patches.
  function pushPixelHistory(doc, layer, rect, before, after, label) {
    var bytes = before.data.length + after.data.length;
    pushHistory(doc, label, function () {
      layer.canvas.getContext('2d').putImageData(before, rect.x, rect.y);
    }, function () {
      layer.canvas.getContext('2d').putImageData(after, rect.x, rect.y);
    }, bytes);
  }

  // A structural history entry: swap the whole layer tree (pixels shared).
  function pushStructHistory(doc, beforeTree, afterTree, label) {
    pushHistory(doc, label, function () {
      doc.layers = beforeTree.map(cloneLayerMeta);
      fixActive(doc);
    }, function () {
      doc.layers = afterTree.map(cloneLayerMeta);
      fixActive(doc);
    }, 4096);
  }
  function fixActive(doc) {
    if (!findLayer(doc, doc.activeLayerId)) {
      var first = flat(doc)[0];
      doc.activeLayerId = first ? first.layer.id : null;
    }
  }

  function create() {
    return {
      uid: uid, makeCanvas: makeCanvas, baseLayer: baseLayer,
      createDoc: createDoc, flat: flat, findLayer: findLayer, activeEntry: activeEntry,
      cloneLayerMeta: cloneLayerMeta, snapshotTree: snapshotTree,
      makeStore: makeStore, pushHistory: pushHistory,
      pushPixelHistory: pushPixelHistory, pushStructHistory: pushStructHistory,
      fixActive: fixActive, historyBudget: historyBudget,
    };
  }
  return create();
})();