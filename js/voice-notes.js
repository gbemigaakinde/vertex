/* ============================================================
   js/voice-notes.js — Voice Note Recording & Playback
   Uses MediaRecorder + Base64 (works with your existing Firebase)
   ============================================================ */

(function () {
  'use strict';

  const MAX_DURATION_SEC = 30;
  const MAX_BASE64_CHARS = 1_200_000; // ~900KB safety limit for Firestore

  let _recorder = null;
  let _chunks = [];
  let _stream = null;
  let _recordInterval = null;
  let _recordStart = 0;
  let _isRecording = false;
  let _pendingSendCallback = null; // Stores callback so auto-send works on timeout

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
          // Capture callback before _stopRecording clears state
          const cb = _pendingSendCallback;
          _pendingSendCallback = cb; // keep it alive through _stopRecording
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

      const finalize = () => {
        const blob = new Blob(_chunks, { type: _recorder.mimeType || 'audio/webm' });
        this._cleanup();
        if (blob.size < 800) return; // Too short — discard accidental blips

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result;
          if (base64.length > MAX_BASE64_CHARS) {
            UI.toast('Voice note too long. Keep it under 25 seconds.', 'warning');
            return;
          }
          const dur = Math.min(MAX_DURATION_SEC, Math.round(((Date.now() - _recordStart) / 1000) * 10) / 10);
          if (_pendingSendCallback) {
            _pendingSendCallback({ data: base64, duration: dur, mimeType: blob.type || 'audio/webm' });
          }
          _pendingSendCallback = null;
        };
        reader.readAsDataURL(blob);
      };

      if (_recorder.state !== 'inactive') { _recorder.onstop = finalize; _recorder.stop(); }
      else { finalize(); }
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
        ">Send ✔</button>
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
      const id = 'vnPlayer-' + Math.random().toString(36).slice(2, 9);
      const dur = this._fmtTime(voiceNote.duration || 0);
      return `<div class="vn-audio-player" id="${_escAttr(id)}" data-src="${_escAttr(voiceNote.data)}" data-mime="${_escAttr(voiceNote.mimeType || 'audio/webm')}">
        <button class="vn-play-btn" onclick="VoiceNotes.togglePlay('${_escAttr(id)}')" title="Play">
          <svg class="vn-icon-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <svg class="vn-icon-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="display:none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        </button>
        <div class="vn-progress-wrap"><div class="vn-progress-bar"><div class="vn-progress-fill" style="width:0%"></div></div></div>
        <span class="vn-duration">${dur}</span>
      </div>`;
    },

    togglePlay(playerId) {
      const player = document.getElementById(playerId);
      if (!player) return;
      let audio = player.querySelector('audio');
      if (!audio) {
        audio = document.createElement('audio');
        audio.src = player.dataset.src;
        audio.style.display = 'none';
        player.appendChild(audio);
        audio.addEventListener('timeupdate', () => {
          const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
          const fill = player.querySelector('.vn-progress-fill');
          if (fill) fill.style.width = pct + '%';
        });
        audio.addEventListener('ended', () => {
          this._setPlay(player, false);
          const fill = player.querySelector('.vn-progress-fill');
          if (fill) fill.style.width = '0%';
        });
      }
      if (audio.paused) {
        document.querySelectorAll('.vn-audio-player audio').forEach(a => { if (a !== audio && !a.paused) { a.pause(); a.currentTime = 0; } });
        document.querySelectorAll('.vn-audio-player').forEach(p => { if (p !== player) this._setPlay(p, false); });
        audio.play().catch(() => {});
        this._setPlay(player, true);
      } else {
        audio.pause();
        this._setPlay(player, false);
      }
    },

    _setPlay(player, playing) {
      const p = player.querySelector('.vn-icon-play');
      const a = player.querySelector('.vn-icon-pause');
      if (p) p.style.display = playing ? 'none' : 'block';
      if (a) a.style.display = playing ? 'block' : 'none';
      player.classList.toggle('is-playing', playing);
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
