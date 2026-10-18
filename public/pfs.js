/* PixelForge Studio — the .pfs project format.
 *
 * Container: 8-byte magic "PFS1\0\0\0\1", uint32 LE manifest length, UTF-8
 * JSON manifest (the document tree, pixel canvases referenced by index),
 * then for each buffer: uint32 LE byte length, uint32 LE ref index, bytes.
 * Buffers are PNG-encoded canvases (layer pixels and masks).
 */
'use strict';

var PF_PFS = (function () {
  var MAGIC = 'PFS1\x00\x00\x00\x01';

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (b) { b ? resolve(b) : reject(new Error('toBlob failed')); }, 'image/png');
    });
  }

  function layerToManifest(l, buffers, collect) {
    var out = {};
    for (var k in l) {
      if (k === 'canvas') { out.canvasRef = collect(l.canvas, buffers); continue; }
      if (k === 'children') { out.children = l.children.map(function (c) { return layerToManifest(c, buffers, collect); }); continue; }
      if (k === 'mask') {
        out.mask = l.mask ? {
          enabled: l.mask.enabled, inverted: l.mask.inverted,
          canvasRef: collect(l.mask.canvas, buffers),
        } : null;
        continue;
      }
      if (k === 'filters') { out.filters = l.filters; continue; }
      out[k] = l[k];
    }
    return out;
  }

  function manifestToLayer(m, buffers) {
    var l = {};
    for (var k in m) {
      if (k === 'canvasRef') { l.canvas = buffers[m.canvasRef].canvas; continue; }
      if (k === 'children') { l.children = m.children.map(function (c) { return manifestToLayer(c, buffers); }); continue; }
      if (k === 'mask') {
        l.mask = m.mask ? { canvas: buffers[m.mask.canvasRef].canvas, enabled: !!m.mask.enabled, inverted: !!m.mask.inverted } : null;
        continue;
      }
      l[k] = m[k];
    }
    if (!('visible' in l)) l.visible = true;
    return l;
  }

  function encode(doc) {
    var buffers = [];   // [{ref, blob}]
    var seen = new Map();
    function collect(canvas) {
      if (!canvas) return -1;
      if (seen.has(canvas)) return seen.get(canvas);
      var ref = buffers.length;
      seen.set(canvas, ref);
      buffers.push({ ref: ref, canvas: canvas });
      return ref;
    }
    var manifest = {
      version: 1,
      name: doc.name,
      width: doc.width,
      height: doc.height,
      view: doc.view,
      guides: doc.guides,
      layers: doc.layers.map(function (l) { return layerToManifest(l, buffers, collect); }),
    };
    var json = JSON.stringify(manifest);
    var enc = new TextEncoder();
    var mbytes = enc.encode(json);
    var head = new ArrayBuffer(8 + 4);
    new Uint8Array(head, 0, 8).set(new Uint8Array(enc.encode(MAGIC)));
    new DataView(head, 8, 4).setUint32(0, mbytes.length, true);
    return Promise.all(buffers.map(function (b) { return canvasToBlob(b.canvas); })).then(function (blobs) {
      var parts = [head, mbytes];
      var lens = [];
      var refs = [];
      blobs.forEach(function (b, i) {
        lens.push(new Uint8Array(new ArrayBuffer(4)));
        new DataView(lens[i].buffer).setUint32(0, b.size, true);
        refs.push(new Uint8Array(new ArrayBuffer(4)));
        new DataView(refs[i].buffer).setUint32(0, i, true);
      });
      blobs.forEach(function (b, i) {
        parts.push(lens[i], refs[i], b);
      });
      return new Blob(parts, { type: 'application/octet-stream' });
    });
  }

  function decode(blob, PFCore) {
    return blob.arrayBuffer().then(function (ab) {
      var u8 = new Uint8Array(ab);
      var magic = String.fromCharCode.apply(null, u8.subarray(0, 8));
      if (magic !== MAGIC) throw new Error('bad magic');
      var dv = new DataView(ab);
      var mlen = dv.getUint32(8, true);
      var manifest = JSON.parse(new TextDecoder().decode(u8.subarray(12, 12 + mlen)));
      if (manifest.version > 1) throw new Error('too-new');
      var off = 12 + mlen;
      var buffers = [];
      while (off + 8 <= ab.byteLength) {
        var len = dv.getUint32(off, true);
        var ref = dv.getUint32(off + 4, true);
        var bytes = u8.subarray(off + 8, off + 8 + len);
        buffers[ref] = { bytes: bytes };
        off += 8 + len;
      }
      return Promise.all(buffers.map(function (b) {
        return createImageBitmap(new Blob([b.bytes], { type: 'image/png' }));
      })).then(function (bitmaps) {
        var canvases = bitmaps.map(function (bm) {
          var c = PFCore.makeCanvas(bm.width, bm.height);
          c.getContext('2d').drawImage(bm, 0, 0);
          bm.close && bm.close();
          return c;
        });
        var doc = PFCore.createDoc(manifest.name, manifest.width, manifest.height, null);
        doc.name = manifest.name || doc.name;
        doc.view = manifest.view || doc.view;
        doc.guides = manifest.guides || [];
        doc.layers = manifest.layers.map(function (l) { return manifestToLayer(l, canvases); });
        PFCore.fixActive(doc);
        return doc;
      });
    });
  }

  return { encode: encode, decode: decode };
})();