/* PixelForge Studio — the worker that runs filters and direct adjustments
 * off the main thread. Classic worker (no modules) so it works from file://
 * and everywhere else; it loads the same pure libraries by importScripts.
 */
'use strict';

importScripts('/adjust.js', '/filters.js');

self.onmessage = function (e) {
  var msg = e.data;
  try {
    if (msg.op === 'filter') {
      var f = PF_FILTERS.byId[msg.filterId];
      if (!f) throw new Error('unknown filter ' + msg.filterId);
      var data = new Uint8ClampedArray(msg.buffer);
      var out = f.apply(data, msg.width, msg.height, msg.params || {});
      self.postMessage({ op: 'filter', id: msg.id, buffer: out.buffer, width: msg.width, height: msg.height }, [out.buffer]);
    } else if (msg.op === 'adjust') {
      var a = PF_ADJUST.byId[msg.adjustId];
      if (!a) throw new Error('unknown adjustment ' + msg.adjustId);
      var d = new Uint8ClampedArray(msg.buffer);
      a.apply(d, msg.width, msg.height, msg.params || {});
      self.postMessage({ op: 'adjust', id: msg.id, buffer: d.buffer, width: msg.width, height: msg.height }, [d.buffer]);
    }
  } catch (err) {
    self.postMessage({ op: 'error', id: msg && msg.id, message: String(err && err.message || err) });
  }
};