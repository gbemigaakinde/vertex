/* ============================================================
   js/vendor/mp3-worker.js — converts recorded voice audio to MP3
   Runs in a Web Worker so the screen never freezes while encoding.
   Input : { samples: Int16Array (mono PCM), rate: Hz, kbps }
   Output: { ok: true, parts: [Int8Array, ...] }  (MP3 file chunks)
   Encoder: lamejs (LGPL), bundled as lame.min.js in this folder.
   ============================================================ */
importScripts('lame.min.js');

self.onmessage = function (e) {
  try {
    var d = e.data;
    var enc = new lamejs.Mp3Encoder(1, d.rate, d.kbps);
    var parts = [];
    var BLOCK = 1152;
    for (var i = 0; i < d.samples.length; i += BLOCK) {
      var buf = enc.encodeBuffer(d.samples.subarray(i, i + BLOCK));
      if (buf.length) parts.push(buf);
    }
    var end = enc.flush();
    if (end.length) parts.push(end);
    self.postMessage({ ok: true, parts: parts });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
