/* ============================================================
   js/speech.js — SpeechEngine  v4
   Handles TTS (text-to-speech) and STT (speech-to-text) for
   the exam screen using the native Web Speech API.

   KEY CHANGES FROM v3:
   ─────────────────────────────────────────────────────────
   • Mic stays ON continuously until user clicks to stop.
     On browsers where continuous mode cuts out, the engine
     auto-restarts the recognition session transparently.
   • Hands-free commands: once mic is active, saying any
     recognised command works without touching anything.
   • "A" / "C" recognition fixed: phoneme aliases added
     ("aye"→A, "eye"→A, "see"→C, "sea"→C, etc.)
   • "Read" / "Stop reading" as spoken commands.
   • "Submit exam" / "Submit" as a spoken command.
   • Timer ring circumference mismatch fixed.
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
  /* Voice loading                                           */
  /* ─────────────────────────────────────────────────────── */
  var _voices      = [];
  var _voicesReady = false;

  function _loadVoices() {
    if (!_synth) return;
    var list = _synth.getVoices();
    if (list && list.length > 0) { _voices = list; _voicesReady = true; }
    _synth.onvoiceschanged = function () {
      var updated = _synth.getVoices();
      if (updated && updated.length > 0) { _voices = updated; _voicesReady = true; }
    };
  }

  if (ttsSupported) {
    _loadVoices();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _loadVoices);
    }
  }

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
    return null;
  }

  /* ─────────────────────────────────────────────────────── */
  /* TTS — chunked speaker (unchanged from v3)               */
  /* ─────────────────────────────────────────────────────── */
  var _ttsActive = false;
  var _ttsQueue  = [];

  function _chunkText(text) {
    var MAX = 180;
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length <= MAX) return [text];
    var chunks    = [];
    var sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    var current   = '';
    for (var i = 0; i < sentences.length; i++) {
      var s = sentences[i].trim();
      if (!s) continue;
      if ((current + ' ' + s).trim().length <= MAX) {
        current = (current + ' ' + s).trim();
      } else {
        if (current) chunks.push(current);
        if (s.length > MAX) {
          var words     = s.split(' ');
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

  function _speakNext() {
    if (_ttsQueue.length === 0) {
      _ttsActive = false;
      _setTtsBtn(false);
      return;
    }
    var chunk = _ttsQueue.shift();
    var utt   = new SpeechSynthesisUtterance(chunk);
    var voice = _pickVoice();
    if (voice) utt.voice = voice;
    utt.rate   = 0.92;
    utt.pitch  = 1.0;
    utt.volume = 1.0;
    utt.lang   = (voice && voice.lang) || 'en-US';
    utt.onend  = function () { setTimeout(_speakNext, 80); };
    utt.onerror = function (e) {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn('[SpeechEngine] TTS chunk error:', e.error);
      setTimeout(_speakNext, 100);
    };
    _synth.speak(utt);
  }

  function speak(rawText) {
    if (!ttsSupported) {
      if (window.UI) UI.toast('Text-to-speech is not supported in your browser.', 'warning', 4000);
      return;
    }
    var clean = rawText
      .replace(/<[^>]*>/g, ' ')
      .replace(/%%MATH_\d+%%/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, ' (math expression) ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) return;
    cancel();
    _ttsQueue  = _chunkText(clean);
    _ttsActive = true;
    _setTtsBtn(true);
    if (!_voicesReady && _voices.length === 0) {
      setTimeout(_speakNext, 250);
    } else {
      _speakNext();
    }
  }

  function cancel() {
    if (!ttsSupported) return;
    _ttsQueue  = [];
    _ttsActive = false;
    _synth.cancel();
    _setTtsBtn(false);
  }

  function _setTtsBtn(speaking) {
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
  /* STT — continuous mode with auto-restart                 */
  /*                                                         */
  /* How it works:                                           */
  /*   _sttActive = user WANTS the mic on                   */
  /*   _sttRunning = a recognition session is open right now */
  /*                                                         */
  /* When the browser ends a session (which it will on many  */
  /* mobile browsers even in continuous mode), we restart    */
  /* immediately as long as _sttActive is still true.        */
  /* A short cooldown (300 ms) prevents restart loops.       */
  /* ─────────────────────────────────────────────────────── */
  var _recognition  = null;
  var _sttActive    = false;   /* user-intent: mic should be on */
  var _sttRunning   = false;   /* a session is currently open */
  var _sttRestartId = null;    /* setTimeout handle for restart */
  var _sttCallbacks = { onResult: null, onError: null };

  /* Check whether we are in a context where Safari PWA kills the mic */
  function _isStandaloneSafari() {
    return (
      (window.navigator.standalone === true ||
       (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)) &&
      /Safari/i.test(navigator.userAgent) &&
      !/Chrome/i.test(navigator.userAgent)
    );
  }

  /* Internal: open one recognition session */
  function _openSession() {
    if (!sttSupported || !_sttActive) return;
    if (_sttRunning) return;

    try { _recognition = new _SpeechR(); } catch (e) {
      console.error('[SpeechEngine] Could not create SpeechRecognition:', e);
      _sttActive  = false;
      _setSttBtn(false);
      if (_sttCallbacks.onError) _sttCallbacks.onError('Could not start the microphone. Please reload and try again.');
      return;
    }

    /*
      Use continuous=true where possible.
      On iOS Safari continuous is unreliable, so we use single-shot
      there and rely on the auto-restart loop below.
    */
    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    _recognition.continuous      = !isIOS;
    _recognition.interimResults  = false;
    _recognition.maxAlternatives = 3;   /* ask for up to 3 alternatives — helps with A/C */
    _recognition.lang            = 'en-US';

    _recognition.onstart = function () {
      _sttRunning = true;
      _setSttBtn(true);
    };

    _recognition.onresult = function (event) {
      /* Collect ALL alternatives from ALL new results */
      var transcripts = [];
      for (var i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          for (var a = 0; a < event.results[i].length; a++) {
            var t = event.results[i][a].transcript.trim();
            if (t) transcripts.push(t);
          }
        }
      }
      if (transcripts.length > 0 && _sttCallbacks.onResult) {
        /* Pass the best transcript; the handler will try all alternatives */
        _sttCallbacks.onResult(transcripts[0], transcripts);
      }
    };

    _recognition.onend = function () {
      _sttRunning = false;
      /* Auto-restart if the user hasn't clicked stop */
      if (_sttActive) {
        _sttRestartId = setTimeout(function () {
          if (_sttActive) _openSession();
        }, 300);
      } else {
        _setSttBtn(false);
      }
    };

    _recognition.onerror = function (event) {
      _sttRunning = false;

      /* 'aborted' and 'no-speech' are not fatal — keep going */
      if (event.error === 'aborted') {
        if (_sttActive) { _sttRestartId = setTimeout(function () { if (_sttActive) _openSession(); }, 300); }
        return;
      }
      if (event.error === 'no-speech') {
        /* User just didn't say anything — restart silently */
        if (_sttActive) { _sttRestartId = setTimeout(function () { if (_sttActive) _openSession(); }, 200); }
        return;
      }

      /* Fatal errors — stop and tell the user */
      var msg;
      switch (event.error) {
        case 'not-allowed':
        case 'permission-denied':
          msg = 'Microphone access was denied. Please allow microphone permission and try again.'; break;
        case 'network':
          msg = 'Voice recognition needs an internet connection. Please check your connection.'; break;
        case 'audio-capture':
          msg = 'No microphone found. Please connect a microphone and try again.'; break;
        case 'service-not-allowed':
          msg = 'Voice recognition is not allowed in this context. Try using Chrome or Edge.'; break;
        default:
          msg = 'Voice recognition stopped (' + event.error + '). Tap the mic to restart.';
      }

      console.warn('[SpeechEngine] STT fatal error:', event.error);
      _sttActive = false;
      _setSttBtn(false);
      if (_sttCallbacks.onError) _sttCallbacks.onError(msg);
    };

    try {
      _recognition.start();
    } catch (e) {
      console.error('[SpeechEngine] recognition.start() threw:', e);
      _sttRunning = false;
      _sttActive  = false;
      _setSttBtn(false);
      if (_sttCallbacks.onError) _sttCallbacks.onError('Could not start the microphone. Please reload and try again.');
    }
  }

  /* Public: start continuous STT. Stays on until stopSTT() is called. */
  function startSTT(onResult, onEnd, onError) {
    if (!sttSupported) {
      if (typeof onError === 'function') {
        onError('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      }
      return;
    }
    if (_isStandaloneSafari()) {
      if (typeof onError === 'function') {
        onError('Voice commands are not supported when installed as a home screen app on iOS. Please open in Safari.');
      }
      return;
    }

    /* Store callbacks so the auto-restart can re-use them */
    _sttCallbacks.onResult = onResult;
    _sttCallbacks.onError  = onError;
    /* onEnd is kept for API compatibility but not needed in continuous mode */

    stopSTT();           /* clean up any previous session first */
    _sttActive = true;
    _openSession();
  }

  /* Public: stop STT completely. */
  function stopSTT() {
    _sttActive = false;
    if (_sttRestartId) { clearTimeout(_sttRestartId); _sttRestartId = null; }
    if (_recognition) {
      try { _recognition.stop(); }  catch (e) {}
      try { _recognition.abort(); } catch (e) {}
      _recognition = null;
    }
    _sttRunning = false;
    _setSttBtn(false);
  }

  function _setSttBtn(listening) {
    var btn  = document.getElementById('seSttBtn');
    var pill = document.querySelector('.vtx-speech-pill');
    if (btn) {
      if (listening) {
        btn.classList.add('is-listening');
        btn.title = 'Mic is ON — tap to stop (M)';
      } else {
        btn.classList.remove('is-listening');
        btn.title = 'Voice command (M)';
      }
    }
    /* drives the blinking dot CSS via data attribute */
    if (pill) pill.setAttribute('data-mic-on', listening ? 'true' : 'false');
  }

  /* ─────────────────────────────────────────────────────── */
  /* Letter alias map — fixes A and C recognition            */
  /*                                                         */
  /* Why A and C fail:                                       */
  /*   "A"  is heard as: "aye", "eye", "I", "hey", "a"      */
  /*   "C"  is heard as: "see", "sea", "si", "the"          */
  /*   "B"  is heard as: "be", "bee" — works fine           */
  /*   "D"  is heard as: "dee", "the" — usually fine        */
  /*                                                         */
  /* Solution: map every known homophone to the letter index */
  /* ─────────────────────────────────────────────────────── */
  var _letterAliases = {
    /* A = index 0 */
    'a':    0, 'aye':  0, 'eye':  0, 'i':    0, 'hey':  0,
    'eh':   0, 'ay':   0, 'ai':   0,
    /* B = index 1 */
    'b':    1, 'be':   1, 'bee':  1, 'bi':   1,
    /* C = index 2 */
    'c':    2, 'see':  2, 'sea':  2, 'si':   2, 'key':  2,
    'ce':   2, 'the c': 2,
    /* D = index 3 */
    'd':    3, 'dee':  3, 'de':   3, 'di':   3,
    /* E = index 4 */
    'e':    4, 'ee':   4, 'eh e': 4,
    /* F = index 5 */
    'f':    5, 'ef':   5, 'eff':  5,
  };

  /*
    Try to find a letter match anywhere in the transcript.
    We check the full transcript first (e.g. "option see"),
    then word by word, then try all alternatives passed in.
  */
  function _extractLetter(transcript, allTranscripts) {
    var candidates = allTranscripts ? allTranscripts.slice() : [transcript];
    /* Put the original at front if not already there */
    if (candidates.indexOf(transcript) === -1) candidates.unshift(transcript);

    for (var c = 0; c < candidates.length; c++) {
      var t = (candidates[c] || '').toLowerCase().trim();

      /* Strip common preamble words: "option A", "answer B", "pick C", "choose D", "select E" */
      t = t.replace(/^(option|answer|pick|choose|select|letter)\s+/i, '');

      /* Direct full-string match */
      if (_letterAliases[t] !== undefined) return _letterAliases[t];

      /* Word-by-word match */
      var words = t.split(/\s+/);
      for (var w = 0; w < words.length; w++) {
        if (_letterAliases[words[w]] !== undefined) return _letterAliases[words[w]];
      }
    }
    return -1;  /* no match */
  }

  /* ─────────────────────────────────────────────────────── */
  /* Voice command handler                                   */
  /* ─────────────────────────────────────────────────────── */
  function _handleVoiceCommand(transcript, allTranscripts, exam) {
    var t = (transcript || '').toLowerCase().trim();
    console.log('[SpeechEngine] voice command:', t, '| alternatives:', allTranscripts);

    /* ── Navigation ── */
    if (/\b(next|forward|move on|continue)\b/.test(t)) {
      UI.toast('Going to next question…', 'info', 1500);
      if (window.Exam && typeof Exam.nextQuestion === 'function') Exam.nextQuestion();
      return;
    }
    if (/\b(previous|prev|back|go back)\b/.test(t)) {
      UI.toast('Going to previous question…', 'info', 1500);
      if (window.Exam && typeof Exam.prevQuestion === 'function') Exam.prevQuestion();
      return;
    }

    /* ── TTS: read aloud ── */
    if (/\b(read|listen|read (the )?question|read (it )?out|speak)\b/.test(t)) {
      var ttsBtn = document.getElementById('seTtsBtn');
      if (ttsBtn) ttsBtn.click();
      return;
    }

    /* ── TTS: stop reading ── */
    if (/\b(stop( reading| speaking)?|quiet|silence|shut up)\b/.test(t)) {
      if (_ttsActive) {
        cancel();
        UI.toast('Stopped reading.', 'info', 1500);
      }
      return;
    }

    /* ── Submit exam ── */
    if (/\b(submit( exam| test| now)?|finish( exam| test)?|end exam)\b/.test(t)) {
      UI.toast('Submit command received — confirming…', 'info', 2000);
      if (window.Exam && typeof Exam.submitExam === 'function') {
        /* Give user a moment to hear the toast, then trigger with confirm dialog */
        setTimeout(function () { Exam.submitExam(false); }, 1500);
      }
      return;
    }

    /* ── Answer selection ── */
    if (!exam) return;
    var subj     = exam.currentSubject;
    var qList    = exam.questions[subj];
    var optCount = (qList[exam.currentIndex].opts || []).length;

    var letterIdx = _extractLetter(t, allTranscripts);
    if (letterIdx >= 0 && letterIdx < optCount) {
      var letterName = String.fromCharCode(65 + letterIdx);
      UI.toast('Selecting option ' + letterName + '…', 'info', 1500);
      var labels = document.querySelectorAll('.option-label');
      if (labels[letterIdx]) labels[letterIdx].click();
      return;
    }

    /* ── Didn't understand ── */
    UI.toast(
      'Not understood: "' + transcript + '". Try: A B C D, next, previous, read, stop, submit exam.',
      'info', 4000
    );
  }

  /* ─────────────────────────────────────────────────────── */
  /* Keyboard shortcuts (R = read, M = mic toggle)           */
  /* ─────────────────────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
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
  /* Called by exam.js after renderExam() mounts the UI      */
  /* ─────────────────────────────────────────────────────── */
  function wireExamButtons(exam) {

    /* ── TTS button ── */
    var ttsBtn = document.getElementById('seTtsBtn');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', function () {
        if (_ttsActive) {
          cancel();
          return;
        }
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

    /* ── STT button — toggle continuous mic on/off ── */
    var sttBtn = document.getElementById('seSttBtn');
    if (sttBtn) {
      sttBtn.addEventListener('click', function () {

        /* If mic is already on, turn it off */
        if (_sttActive) {
          stopSTT();
          UI.toast('Microphone off.', 'info', 1500);
          return;
        }

        /* Not in standalone Safari */
        if (!sttSupported) {
          UI.toast('Voice commands are not supported in your browser. Please use Chrome or Edge.', 'warning', 5000);
          return;
        }

        UI.toast('Microphone is ON. Say A, B, C, D, "next", "previous", "read", "stop", or "submit exam".', 'info', 4000);

        startSTT(
          /* onResult */
          function (bestTranscript, allTranscripts) {
            _handleVoiceCommand(bestTranscript, allTranscripts, exam);
          },
          /* onEnd — not used in continuous mode */
          null,
          /* onError */
          function (msg) { UI.toast(msg, 'warning', 5000); }
        );
      });
    }
  }

  /* ─────────────────────────────────────────────────────── */
  /* Public API                                              */
  /* ─────────────────────────────────────────────────────── */
  window.SpeechEngine = {
    speak:           speak,
    cancel:          cancel,
    startSTT:        startSTT,
    stopSTT:         stopSTT,
    wireExamButtons: wireExamButtons,
    ttsSupported:    ttsSupported,
    sttSupported:    sttSupported,
    /* Exposed for the keyboard shortcut in index.html's inline script */
    readCurrentQuestion: function () {
      var ttsBtn = document.getElementById('seTtsBtn');
      if (ttsBtn) ttsBtn.click();
    },
    startListening: function () {
      var sttBtn = document.getElementById('seSttBtn');
      if (sttBtn) sttBtn.click();
    },
  };

})();
