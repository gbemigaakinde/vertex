/* ============================================================
   js/speech.js — SpeechEngine  v3
   Handles TTS (text-to-speech) and STT (speech-to-text) for
   the exam screen using the native Web Speech API.

   KEY FACTS this implementation is built around:
   ─────────────────────────────────────────────────────────
   TTS (SpeechSynthesis):
     • Chrome cuts off any single utterance that takes longer
       than ~15 seconds to speak (~200-250 chars). Fix: split
       text into short chunks and chain them via the 'end' event.
     • getVoices() returns [] on first call in Chrome/Edge/Firefox.
       Must wait for the 'voiceschanged' event, then call again.
     • speak() is silently ignored in Safari/iOS unless called
       inside a direct user-gesture handler (button click, etc.).
     • Background tab playback is unreliable — Chrome/Safari
       throttle or stop synthesis when the tab loses focus.

   STT (SpeechRecognition):
     • Chrome, Edge, Opera: full support.
     • Safari 14.1+ macOS / 14.5+ iOS: works via webkitSpeechRecognition.
     • Firefox: disabled by default (behind a flag). Treat as unsupported.
     • Safari PWA / WebView: triggers an immediate error without asking
       for mic permission — no fix, warn the user.
     • Requires internet — Chrome sends audio to Google's servers.
     • continuous mode is unreliable on iOS — use single-shot mode only.
   ─────────────────────────────────────────────────────────
   Public API (window.SpeechEngine):
     SpeechEngine.speak(text)   — reads text aloud
     SpeechEngine.cancel()      — stops TTS immediately
     SpeechEngine.startSTT(onResult, onEnd, onError) — starts mic
     SpeechEngine.stopSTT()     — stops mic
     SpeechEngine.ttsSupported  — boolean
     SpeechEngine.sttSupported  — boolean
   ============================================================ */

(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────── */
  /* Feature detection                                       */
  /* ─────────────────────────────────────────────────────── */
  var _synth   = window.speechSynthesis || null;
  var _SpeechR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  var ttsSupported = !!_synth;
  var sttSupported = !!_SpeechR;

  /* ─────────────────────────────────────────────────────── */
  /* Voice loading (async in Chrome/Edge/Firefox)            */
  /* ─────────────────────────────────────────────────────── */
  var _voices     = [];
  var _voicesReady = false;

  function _loadVoices() {
    if (!_synth) return;

    // Safari returns voices synchronously; Chrome/Edge/Firefox fire voiceschanged.
    var list = _synth.getVoices();
    if (list && list.length > 0) {
      _voices      = list;
      _voicesReady = true;
    }

    // Always wire up the event too — Chrome fires it once voices are ready.
    _synth.onvoiceschanged = function () {
      var updated = _synth.getVoices();
      if (updated && updated.length > 0) {
        _voices      = updated;
        _voicesReady = true;
      }
    };
  }

  if (ttsSupported) {
    // Run immediately — Safari may already have them.
    _loadVoices();
    // Also run once the DOM is ready, in case the page loaded quickly.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _loadVoices);
    }
  }

  /* Pick the best English voice available.
     Priority: local en-GB or en-US → any local English → any English → default */
  function _pickVoice() {
    if (_voices.length === 0) return null;

    var preferred = [
      function (v) { return v.localService && v.lang === 'en-GB'; },
      function (v) { return v.localService && v.lang === 'en-US'; },
      function (v) { return v.localService && v.lang.startsWith('en'); },
      function (v) { return v.lang.startsWith('en'); },
    ];

    for (var i = 0; i < preferred.length; i++) {
      var match = _voices.filter(preferred[i]);
      if (match.length > 0) return match[0];
    }

    // Fall back to the browser default (return null = use whatever the browser picks).
    return null;
  }

  /* ─────────────────────────────────────────────────────── */
  /* TTS — chunked speaker                                   */
  /* Chrome's ~15-second / ~200-char utterance limit means   */
  /* we must split long strings and chain them via 'end'.    */
  /* ─────────────────────────────────────────────────────── */
  var _ttsActive  = false;
  var _ttsQueue   = [];       // array of string chunks
  var _ttsBtnEl   = null;     // reference to the TTS button (for icon toggling)

  /* Split text on sentence boundaries, keeping chunks ≤ 180 chars. */
  function _chunkText(text) {
    var MAX = 180;
    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length <= MAX) return [text];

    var chunks  = [];
    // Split on sentence-ending punctuation, keeping the delimiter.
    var sentences = text.match(/[^.!?]+[.!?]*/g) || [text];

    var current = '';
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i].trim();
      if (!s) continue;
      if ((current + ' ' + s).trim().length <= MAX) {
        current = (current + ' ' + s).trim();
      } else {
        if (current) chunks.push(current);
        // If even a single sentence is too long, split it on commas or spaces.
        if (s.length > MAX) {
          var words    = s.split(' ');
          var wordChunk = '';
          for (var w = 0; w < words.length; w++) {
            if ((wordChunk + ' ' + words[w]).trim().length <= MAX) {
              wordChunk = (wordChunk + ' ' + words[w]).trim();
            } else {
              if (wordChunk) chunks.push(wordChunk);
              wordChunk = words[w];
            }
          }
          if (wordChunk) chunks.push(wordChunk);
          current = '';
        } else {
          current = s;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks.filter(function (c) { return c.trim().length > 0; });
  }

  /* Speak the next chunk in the queue. */
  function _speakNext() {
    if (_ttsQueue.length === 0) {
      _ttsActive = false;
      _setTtsBtn(false);
      return;
    }

    var chunk   = _ttsQueue.shift();
    var utt     = new SpeechSynthesisUtterance(chunk);

    // Apply voice (may be null = browser picks default, which is fine).
    var voice = _pickVoice();
    if (voice) utt.voice = voice;

    // Natural conversational settings.
    utt.rate   = 0.92;   // slightly slower than default (1.0) for clarity
    utt.pitch  = 1.0;
    utt.volume = 1.0;
    utt.lang   = (voice && voice.lang) || 'en-US';

    utt.onend = function () {
      // Small pause between chunks for natural flow.
      setTimeout(_speakNext, 80);
    };

    utt.onerror = function (e) {
      // 'interrupted' fires when cancel() is called — that is expected,
      // not a real error. Swallow it silently.
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn('[SpeechEngine] TTS chunk error:', e.error, '| chunk:', chunk);
      // Try to continue with the next chunk regardless.
      setTimeout(_speakNext, 100);
    };

    _synth.speak(utt);
  }

  /* Public: start speaking text. */
  function speak(rawText) {
    if (!ttsSupported) {
      if (window.UI) UI.toast('Text-to-speech is not supported in your browser.', 'warning', 4000);
      return;
    }

    // Strip HTML tags and LaTeX math markers before speaking.
    var clean = rawText
      .replace(/<[^>]*>/g, ' ')            // HTML tags
      .replace(/%%MATH_\d+%%/g, ' ')       // LaTeX placeholders
      .replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, ' (math expression) ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!clean) return;

    // Stop anything currently playing first.
    cancel();

    _ttsQueue  = _chunkText(clean);
    _ttsActive = true;
    _setTtsBtn(true);

    // If voices haven't loaded yet, wait briefly then try again.
    // (This handles the race condition on Chrome's first page load.)
    if (!_voicesReady && _voices.length === 0) {
      setTimeout(function () {
        _speakNext();
      }, 250);
    } else {
      _speakNext();
    }
  }

  /* Public: stop all TTS. */
  function cancel() {
    if (!ttsSupported) return;
    _ttsQueue  = [];
    _ttsActive = false;
    _synth.cancel();
    _setTtsBtn(false);
  }

  /* Toggle TTS button icon/state. */
  function _setTtsBtn(speaking) {
    // Find the TTS button in the exam UI if it exists.
    var btn = document.getElementById('seTtsBtn');
    if (!btn) return;
    if (speaking) {
      btn.classList.add('is-speaking');
      btn.title = 'Stop reading (R)';
    } else {
      btn.classList.remove('is-speaking');
      btn.title = 'Read question aloud (R)';
    }
  }

  /* ─────────────────────────────────────────────────────── */
  /* STT — single-shot voice command                         */
  /* ─────────────────────────────────────────────────────── */
  var _recognition = null;
  var _sttRunning  = false;

  /*
    onResult(transcript) — called with the recognised text string
    onEnd()              — called when recognition finishes (result or no result)
    onError(message)     — called with a human-readable error string
  */
  function startSTT(onResult, onEnd, onError) {
    if (!sttSupported) {
      if (typeof onError === 'function') {
        onError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      }
      return;
    }

    // Detect Safari PWA / WKWebView — these trigger an error immediately.
    var isStandaloneSafari = (
      window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
    ) && /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);

    if (isStandaloneSafari) {
      if (typeof onError === 'function') {
        onError('Voice commands are not supported when Vertex is installed as a home screen app on iOS. Please open it in Safari instead.');
      }
      return;
    }

    // Clean up any existing session.
    stopSTT();

    try {
      _recognition = new _SpeechR();
    } catch (e) {
      console.error('[SpeechEngine] Could not create SpeechRecognition:', e);
      if (typeof onError === 'function') onError('Could not start microphone. Please try again.');
      return;
    }

    // Single-shot mode (not continuous) — most reliable across all platforms.
    _recognition.continuous      = false;
    _recognition.interimResults  = false;
    _recognition.maxAlternatives = 1;
    _recognition.lang            = 'en-US'; // or 'en-GB' depending on your audience

    _recognition.onstart = function () {
      _sttRunning = true;
      _setSttBtn(true);
    };

    _recognition.onresult = function (event) {
      var transcript = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      transcript = transcript.trim();
      if (transcript && typeof onResult === 'function') {
        onResult(transcript);
      }
    };

    _recognition.onend = function () {
      _sttRunning = false;
      _setSttBtn(false);
      if (typeof onEnd === 'function') onEnd();
    };

    _recognition.onerror = function (event) {
      _sttRunning = false;
      _setSttBtn(false);

      var msg;
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          msg = 'Microphone access was denied. Please allow microphone permission and try again.';
          break;
        case 'no-speech':
          msg = 'No speech detected. Please try speaking again.';
          break;
        case 'network':
          msg = 'Voice recognition needs an internet connection. Please check your connection.';
          break;
        case 'audio-capture':
          msg = 'No microphone found. Please connect a microphone and try again.';
          break;
        case 'service-not-allowed':
          msg = 'Voice recognition is not allowed in this context. Try using Chrome browser.';
          break;
        case 'aborted':
          // Triggered by stopSTT() — not a real error.
          if (typeof onEnd === 'function') onEnd();
          return;
        default:
          msg = 'Voice recognition failed (' + event.error + '). Please try again.';
      }

      console.warn('[SpeechEngine] STT error:', event.error);
      if (typeof onError === 'function') onError(msg);
      if (typeof onEnd  === 'function') onEnd();
    };

    try {
      _recognition.start();
    } catch (e) {
      console.error('[SpeechEngine] recognition.start() threw:', e);
      _sttRunning = false;
      _setSttBtn(false);
      if (typeof onError === 'function') {
        onError('Could not start the microphone. Please reload the page and try again.');
      }
    }
  }

  /* Public: stop STT. */
  function stopSTT() {
    if (_recognition) {
      try { _recognition.stop(); } catch (e) {}
      try { _recognition.abort(); } catch (e) {}
      _recognition = null;
    }
    _sttRunning = false;
    _setSttBtn(false);
  }

  /* Toggle STT button icon/state. */
  function _setSttBtn(listening) {
    var btn = document.getElementById('seSttBtn');
    if (!btn) return;
    if (listening) {
      btn.classList.add('is-listening');
      btn.title = 'Listening… click to stop (M)';
    } else {
      btn.classList.remove('is-listening');
      btn.title = 'Voice command (M)';
    }
  }

  /* ─────────────────────────────────────────────────────── */
  /* Keyboard shortcuts (R = read aloud, M = microphone)     */
  /* Only active when the exam UI is visible.                */
  /* ─────────────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    // Ignore if focus is inside a text input.
    var tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'r' || e.key === 'R') {
      var ttsBtn = document.getElementById('seTtsBtn');
      if (!ttsBtn) return;
      e.preventDefault();
      ttsBtn.click();
    }

    if (e.key === 'm' || e.key === 'M') {
      var sttBtn = document.getElementById('seSttBtn');
      if (!sttBtn) return;
      e.preventDefault();
      sttBtn.click();
    }
  });

  /* ─────────────────────────────────────────────────────── */
  /* Exam button wiring                                      */
  /* Called by exam.js after renderExam() mounts the buttons */
  /* ─────────────────────────────────────────────────────── */
  function wireExamButtons(exam) {
    /* TTS button */
    var ttsBtn = document.getElementById('seTtsBtn');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', function () {
        if (_ttsActive) {
          cancel();
          return;
        }

        // Build the text to read: question + all options.
        var subj  = exam.currentSubject;
        var qList = exam.questions[subj];
        var q     = qList[exam.currentIndex];

        if (!q) return;

        var letters = ['A', 'B', 'C', 'D', 'E', 'F'];
        var text    = 'Question ' + (exam.currentIndex + 1) + '. ' + (q.q || '');
        if (Array.isArray(q.opts)) {
          q.opts.forEach(function (opt, i) {
            text += '. Option ' + (letters[i] || (i + 1)) + ': ' + opt;
          });
        }

        speak(text);
      });
    }

    /* STT button */
    var sttBtn = document.getElementById('seSttBtn');
    if (sttBtn) {
      sttBtn.addEventListener('click', function () {
        if (_sttRunning) {
          stopSTT();
          return;
        }

        if (!sttSupported) {
          UI.toast('Voice commands are not supported in your browser. Please use Chrome or Edge.', 'warning', 5000);
          return;
        }

        UI.toast('Listening… say A, B, C, D, "next", or "previous".', 'info', 3000);

        startSTT(
          /* onResult */ function (transcript) {
            _handleVoiceCommand(transcript, exam);
          },
          /* onEnd    */ function () {},
          /* onError  */ function (msg) {
            UI.toast(msg, 'warning', 5000);
          }
        );
      });
    }
  }

  /* Map spoken words to exam actions. */
  function _handleVoiceCommand(transcript, exam) {
    var t = transcript.toLowerCase().trim();
    console.log('[SpeechEngine] voice command:', t);

    // Answer selection — recognise "A", "option A", "answer A", etc.
    var letterMap = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 };
    var letterMatch = t.match(/\b([a-f])\b/);
    if (letterMatch) {
      var idx = letterMap[letterMatch[1]];
      var subj = exam.currentSubject;
      var qList = exam.questions[subj];
      if (idx !== undefined && idx < (qList[exam.currentIndex].opts || []).length) {
        UI.toast('Selecting option ' + letterMatch[1].toUpperCase() + '…', 'info', 1500);
        // Simulate clicking the option label.
        var labels = document.querySelectorAll('.option-label');
        if (labels[idx]) labels[idx].click();
        return;
      }
    }

    // Navigation commands.
    if (/\b(next|forward)\b/.test(t)) {
      if (window.Exam && typeof Exam.nextQuestion === 'function') Exam.nextQuestion();
      return;
    }
    if (/\b(previous|prev|back)\b/.test(t)) {
      if (window.Exam && typeof Exam.prevQuestion === 'function') Exam.prevQuestion();
      return;
    }
    if (/\bread\b/.test(t) || /\blisten\b/.test(t)) {
      var ttsBtn = document.getElementById('seTtsBtn');
      if (ttsBtn) ttsBtn.click();
      return;
    }

    // Didn't recognise it.
    UI.toast('Not understood: "' + transcript + '". Try saying A, B, C, D, next, or previous.', 'info', 3500);
  }

  /* ─────────────────────────────────────────────────────── */
  /* Public API                                              */
  /* ─────────────────────────────────────────────────────── */
  window.SpeechEngine = {
    speak:        speak,
    cancel:       cancel,
    startSTT:     startSTT,
    stopSTT:      stopSTT,
    wireExamButtons: wireExamButtons,
    ttsSupported: ttsSupported,
    sttSupported: sttSupported,
  };

})();
