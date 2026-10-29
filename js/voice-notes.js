/* ============================================================
   js/voice-notes.js — Voice Note Recording & Playback
   Uses MediaRecorder + Base64 (works with your existing Firebase)
   ============================================================ */

(function () {
  'use strict';

  const MAX_DURATION_SEC = 30;
  const MAX_BASE64_CHARS = 900_000;   // Firestore docs max out at 1 MiB (1,048,576 bytes) — stay safely under

  let _recorder = null;
  let _chunks = [];
  let _stream = null;
  let _recordInterval = null;
  let _recordStart = 0;
  let _isRecording = false;
  let _pendingSendCallback = null; // Stores callback so auto-send works on timeout

  // One shared audio engine. Chats re-draw their bubbles on every snapshot; keeping the
  // <audio> outside the bubbles lets a playing note survive those re-draws.
  let _audio = null;
  let _curId = null;   // id of the player currently loaded in _audio

  function _hashStr(s) {   // cheap, stable id from the note's data
    s = String(s || '');
    const step = Math.max(1, Math.floor(s.length / 400));
    let h = 5381;
    for (let i = 0; i < s.length; i += step) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36) + s.length.toString(36);
  }
  function _toast(msg, type) { if (window.UI && UI.toast) UI.toast(msg, type || 'warning'); }

  const VoiceNotes = {
    isSupported: !!(navigator.mediaDevices && window.MediaRecorder),

    /* ══════════════════════════════════════════════════════
       UI INJECTION — adds mic button next to chat inputs
       Works like WhatsApp: hold to record, release to send
    ══════════════════════════════════════════════════════ */
    injectRecorderButton(inputId, onSendCallback) {
      const input = document.getElementById(inputId);
      if (!input) return;
      const wrap = input.parentElement;
      if (!wrap || wrap.querySelector('.vn-recorder-btn')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'vn-recorder-btn';
      btn.title = 'Hold to record voice note';
      btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`;

      // Prevent the mobile "copy/paste" menu from appearing on long-press
      btn.addEventListener('contextmenu', (e) => e.preventDefault());

      let holdTimer = null;
      let didStart = false;

      const startRec = async () => {
        if (_isRecording) return;
        didStart = false;
        // 80ms delay prevents accidental taps; WhatsApp feels instant but still needs a beat
        holdTimer = setTimeout(async () => {
          didStart = true;
          _pendingSendCallback = onSendCallback; // Remember so we can auto-send later
          await this._startRecording();
          if (_isRecording) this._showPanel();
        }, 80);
      };

      const stopRec = () => {
        clearTimeout(holdTimer);
        if (didStart && _isRecording) {
          this._hidePanel();
          this._stopRecording();
        }
        didStart = false;
      };

      const abortRec = () => {
        clearTimeout(holdTimer);
        if (_isRecording) {
          this._abortRecording();
          this._hidePanel();
        }
        didStart = false;
      };

      // Pointer Events + setPointerCapture guarantees pointerup fires
      // even if the finger slides off the button while speaking
      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch (_) {}
        startRec();
      });

      btn.addEventListener('pointerup', (e) => {
        e.preventDefault();
        stopRec();
      });

      btn.addEventListener('pointercancel', (e) => {
        e.preventDefault();
        abortRec();
      });

      wrap.insertBefore(btn, input);
    },

    /* ══════════════════════════════════════════════════════
       RECORDING ENGINE
    ══════════════════════════════════════════════════════ */
    _getMime() {
      const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus'
      ];
      for (const t of types) if (MediaRecorder.isTypeSupported(t)) return t;
      return '';
    },

    async _startRecording() {
      if (!this.isSupported) { UI.toast('Voice notes not supported on this device.', 'warning'); return; }
      try {
        _stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = this._getMime();
        _recorder = mime ? new MediaRecorder(_stream, { mimeType: mime }) : new MediaRecorder(_stream);
        _chunks = [];

        _recorder.ondataavailable = (e) => { if (e.data.size > 0) _chunks.push(e.data); };
        _recorder.start(100);
        _isRecording = true;
        _recordStart = Date.now();

        _recordInterval = setInterval(() => {
        this._updateTimer();
        const sec = (Date.now() - _recordStart) / 1000;
        if (sec >= MAX_DURATION_SEC) {
          clearInterval(_recordInterval);
          _recordInterval = null;
          this._hidePanel();
          this._stopRecording();
        }
      }, 400);
      } catch (err) {
        console.error('[VoiceNotes]', err);
        UI.toast('Microphone blocked. Please allow permission in your browser.', 'error');
        _isRecording = false;
        _pendingSendCallback = null;
      }
    },

    _stopRecording() {
      if (!_isRecording || !_recorder) return;
      _isRecording = false;
      if (_recordInterval) { clearInterval(_recordInterval); _recordInterval = null; }

      // Capture these NOW — a new recording could overwrite them while the file is being read
      const cb  = _pendingSendCallback;
      _pendingSendCallback = null;
      const dur = Math.min(MAX_DURATION_SEC, Math.round(((Date.now() - _recordStart) / 1000) * 10) / 10);

      const finalize = async () => {
        const rawBlob = new Blob(_chunks, { type: _recorder.mimeType || 'audio/webm' });
        this._cleanup();
        if (rawBlob.size < 800) return; // Too short — discard accidental blips

        // Chrome/Android record WebM, which older iPhones cannot play. Convert to MP3,
        // which plays on every phone and browser. If conversion fails we keep the original.
        let blob = rawBlob;
        let duration = dur;
        try {
          const out = await this._toPlayableBlob(rawBlob);
          blob = out.blob;
          if (out.duration) duration = Math.min(MAX_DURATION_SEC, Math.round(out.duration * 10) / 10);
        } catch (convErr) {
          console.warn('[VoiceNotes] MP3 conversion failed, sending original format:', convErr);
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result;
          if (base64.length > MAX_BASE64_CHARS) {
            UI.toast('Voice note is too large to send. Please record a shorter one.', 'warning');
            return;
          }
          if (cb) cb({ data: base64, duration, mimeType: blob.type || 'audio/webm' });
        };
        reader.readAsDataURL(blob);
      };

      if (_recorder.state !== 'inactive') { _recorder.onstop = finalize; _recorder.stop(); }
      else { finalize(); }
    },

    /* ══════════════════════════════════════════════════════
       FORMAT CONVERSION — WebM/Ogg  →  MP3 (plays everywhere)
    ══════════════════════════════════════════════════════ */
    async _toPlayableBlob(blob) {
      if (!/webm|ogg/i.test(blob.type || '')) return { blob, duration: null };   // MP4/AAC etc. already play everywhere
      return this._transcodeToMp3(blob);
    },

    async _transcodeToMp3(blob) {
      const RATE = 22050, KBPS = 40;           // clear speech, ~5 KB per second of audio
      const AC = window.AudioContext || window.webkitAudioContext;
      const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!AC || !OAC || !window.Worker) throw new Error('Audio conversion not supported here');

      // 1. Decode the recording into raw audio
      const arrayBuf = await blob.arrayBuffer();
      const ctx = new AC();
      let decoded;
      try {
        decoded = await new Promise((res, rej) => ctx.decodeAudioData(arrayBuf, res, rej));
      } finally { if (ctx.close) ctx.close().catch(() => {}); }

      // 2. Mix down to mono at 22.05 kHz
      const frames = Math.max(1, Math.ceil(decoded.duration * RATE));
      const off = new OAC(1, frames, RATE);
      const src = off.createBufferSource();
      src.buffer = decoded;
      src.connect(off.destination);
      src.start();
      const rendered = await off.startRendering();
      const f32 = rendered.getChannelData(0);
      const pcm = new Int16Array(f32.length);
      for (let i = 0; i < f32.length; i++) {
        const v = Math.max(-1, Math.min(1, f32[i]));
        pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }

      // 3. Encode to MP3 in a background thread
      const parts = await new Promise((resolve, reject) => {
        let w;
        try { w = new Worker('/js/vendor/mp3-worker.js'); } catch (e) { reject(e); return; }
        const timer = setTimeout(() => { w.terminate(); reject(new Error('MP3 encoding timed out')); }, 20000);
        w.onmessage = (e) => {
          clearTimeout(timer); w.terminate();
          e.data && e.data.ok ? resolve(e.data.parts) : reject(new Error((e.data && e.data.error) || 'MP3 encoding failed'));
        };
        w.onerror = (e) => { clearTimeout(timer); w.terminate(); reject(new Error(e.message || 'MP3 worker error')); };
        w.postMessage({ samples: pcm, rate: RATE, kbps: KBPS }, [pcm.buffer]);
      });

      return { blob: new Blob(parts, { type: 'audio/mpeg' }), duration: decoded.duration };
    },

    _abortRecording() {
      if (!_isRecording) return;
      _isRecording = false;
      _pendingSendCallback = null;
      if (_recordInterval) { clearInterval(_recordInterval); _recordInterval = null; }
      if (_recorder && _recorder.state !== 'inactive') _recorder.stop();
      this._cleanup();
    },

    _cleanup() {
      if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
      _recorder = null;
    },

    /* ── Recording Panel ── */
    _showPanel() {
  let panel = document.getElementById('vnRecordingPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'vnRecordingPanel';
    panel.className = 'vn-recording-panel';
    panel.innerHTML = `
      <div class="vn-waveform"><span></span><span></span><span></span><span></span><span></span></div>
      <div class="vn-recording-timer">0:00</div>
      <div class="vn-recording-label">Recording voice note</div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:4px;">
        <button class="vn-recording-cancel" id="vnCancelRec">Cancel</button>
        <button class="vn-recording-send" id="vnSendRec" style="
          font-size: var(--text-xs);
          font-family: var(--font);
          font-weight: 600;
          padding: 6px 16px;
          border-radius: var(--r-sm);
          border: none;
          cursor: pointer;
          background: var(--accent);
          color: #fff;
          transition: all 120ms;
        ">Send</button>
      </div>`;
    document.body.appendChild(panel);

    document.getElementById('vnCancelRec').addEventListener('click', () => {
      this._abortRecording();
      this._hidePanel();
    });

    document.getElementById('vnSendRec').addEventListener('click', () => {
      this._hidePanel();
      this._stopRecording();
    });
  }
  panel.classList.add('is-visible');
  this._updateTimer();
},

    _hidePanel() {
      const panel = document.getElementById('vnRecordingPanel');
      if (panel) panel.classList.remove('is-visible');
    },

    _updateTimer() {
      const sec = Math.floor((Date.now() - _recordStart) / 1000);
      const m = Math.floor(sec / 60);
      const s = String(sec % 60).padStart(2, '0');
      const el = document.querySelector('.vn-recording-timer');
      if (el) el.textContent = m + ':' + s;
    },

    /* ══════════════════════════════════════════════════════
       PLAYBACK RENDERER (returns HTML string for bubbles)
    ══════════════════════════════════════════════════════ */
renderPlayer(voiceNote) {
  // Purged after 3 days (data removed) — show a clear message instead of a dead player
  if (!voiceNote || voiceNote.expired || !voiceNote.data) {
    return `<div class="vn-audio-player vn-expired" style="display:flex;align-items:center;gap:.4rem;font-size:.75rem;font-style:italic;opacity:.75;padding:.25rem 0;">
      <i class="ph ph-microphone" style="font-size:14px;"></i>
      Voice note expired</div>`;
  }
  const id = 'vnPlayer-' + _hashStr(voiceNote.data);
  const active  = _curId === id && !!_audio;
  const playing = active && !_audio.paused;
  const total   = Number(voiceNote.duration) || 0;
  const pct     = active && total ? Math.min(1, _audio.currentTime / total) : 0;
  const dur = this._fmtTime(active && _audio.currentTime > 0 ? Math.max(0, total - _audio.currentTime) : total);

  // Generate consistent pseudo-random waveform bars from the audio data
  // Uses a simple hash of the data string so the same note always looks the same
  const BAR_COUNT = 30;
  const bars = this._generateWaveBars(voiceNote.data || '', BAR_COUNT);
  const playedN = Math.floor(pct * BAR_COUNT);
  const barsHtml = bars.map((h, i) =>
    `<span class="vn-wave-bar${i < playedN ? ' vn-wave-bar--played' : ''}" data-idx="${i}" style="height:${h}px;"></span>`
  ).join('');

  return `<div class="vn-audio-player${playing ? ' is-playing' : ''}" id="${_escAttr(id)}"
    data-src="${_escAttr(voiceNote.data)}"
    data-mime="${_escAttr(voiceNote.mimeType || 'audio/webm')}"
    data-duration="${voiceNote.duration || 0}"
    data-bars="${_escAttr(JSON.stringify(bars))}">
    <button class="vn-play-btn" onclick="VoiceNotes.togglePlay('${_escAttr(id)}')" title="Play">
      <svg class="vn-icon-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:${playing ? 'none' : 'block'}"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <svg class="vn-icon-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:${playing ? 'block' : 'none'}"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
    </button>
    <div class="vn-progress-wrap">
      <div class="vn-waveform-bars">${barsHtml}</div>
    </div>
    <span class="vn-duration">${dur}</span>
  </div>`;
},

_ensureAudio() {
  if (_audio) return _audio;
  _audio = new Audio();
  _audio.preload = 'auto';
  _audio.addEventListener('timeupdate', () => this._paint());
  _audio.addEventListener('ended', () => { const id = _curId; _curId = null; this._resetPlayer(id); });
  _audio.addEventListener('error', () => {
    if (!_curId) return;                                   // already handled by play() rejection
    const id = _curId; _curId = null; this._resetPlayer(id);
    _toast("This voice note can't be played on this device.");
  });
  return _audio;
},

// Chrome's recorded .webm reports duration = Infinity, so fall back to the saved duration
_totalDur(player) {
  const d = _audio && _audio.duration;
  if (isFinite(d) && d > 0) return d;
  return parseFloat(player.dataset.duration) || 0;
},

_paint() {
  const player = _curId && document.getElementById(_curId);   // looked up fresh: survives chat re-draws
  if (!player || !_audio) return;
  const total   = this._totalDur(player);
  const pct     = total ? Math.min(1, _audio.currentTime / total) : 0;
  const bars    = player.querySelectorAll('.vn-wave-bar');
  const elapsed = Math.floor(pct * bars.length);
  bars.forEach((bar, i) => bar.classList.toggle('vn-wave-bar--played', i < elapsed));
  const dur = player.querySelector('.vn-duration');
  if (dur) dur.textContent = VoiceNotes._fmtTime(Math.max(0, total - _audio.currentTime));
},

_resetPlayer(id) {
  const p = id && document.getElementById(id);
  if (!p) return;
  this._setPlay(p, false);
  p.querySelectorAll('.vn-wave-bar').forEach(bar => bar.classList.remove('vn-wave-bar--played'));
  const dur = p.querySelector('.vn-duration');
  if (dur) dur.textContent = VoiceNotes._fmtTime(parseFloat(p.dataset.duration) || 0);
},

togglePlay(playerId) {
  const player = document.getElementById(playerId);
  if (!player || !player.dataset.src) return;
  const audio = this._ensureAudio();

  // Same note: pause / resume
  if (_curId === playerId) {
    if (audio.paused) { audio.play().catch(() => {}); this._setPlay(player, true); }
    else { audio.pause(); this._setPlay(player, false); }
    return;
  }

  // Different note: stop the old one, load this one
  if (_curId) this._resetPlayer(_curId);
  audio.pause();
  _curId = playerId;
  audio.src = player.dataset.src;
  this._setPlay(player, true);
  audio.play().catch(err => {
    if (err && err.name === 'AbortError') return;          // user switched notes — ignore
    if (_curId !== playerId) return;                       // already handled by the error event
    const id = _curId; _curId = null; this._resetPlayer(id);
    _toast("This voice note can't be played on this device.");
  });
},

    _setPlay(player, playing) {
      const p = player.querySelector('.vn-icon-play');
      const a = player.querySelector('.vn-icon-pause');
      if (p) p.style.display = playing ? 'none' : 'block';
      if (a) a.style.display = playing ? 'block' : 'none';
      player.classList.toggle('is-playing', playing);
    },

_generateWaveBars(dataStr, count) {
  // Build a simple numeric seed from the data string
  // so the same voice note always renders the same bars
  let seed = 0;
  const sample = dataStr ? dataStr.slice(20, 200) : 'default';
  for (let i = 0; i < sample.length; i++) {
    seed = (seed * 31 + sample.charCodeAt(i)) & 0xffffffff;
  }

  const MIN_H = 3;
  const MAX_H = 20;
  const bars  = [];

  for (let i = 0; i < count; i++) {
    // LCG pseudo-random from seed
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const t = (seed >>> 0) / 0xffffffff; // 0..1

    // Shape the distribution: push values toward extremes for
    // a more natural-looking waveform (fewer mid-height bars)
    const shaped = Math.pow(Math.sin(t * Math.PI), 0.6);
    bars.push(Math.round(MIN_H + shaped * (MAX_H - MIN_H)));
  }
  return bars;
},

    _fmtTime(s) {
      const m = Math.floor(s / 60);
      const sec = Math.floor(s % 60);
      return m + ':' + String(sec).padStart(2, '0');
    }
  };

  function _escAttr(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  }

  window.VoiceNotes = VoiceNotes;
})();
