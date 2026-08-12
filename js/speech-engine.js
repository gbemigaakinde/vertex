/* ============================================================
   js/speech-engine.js — Text-to-Speech + Voice Commands
   Web Speech API wrapper for Vertex CBT
   ============================================================ */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     How this works:
     - Speaker button (TTS): reads the current question + options
       aloud using the browser's built-in text-to-speech engine.
       No internet needed. Works on Chrome, Edge, Safari, Firefox.
     - Mic button (STT): activates the browser's speech recognition.
       The browser records your voice and sends it to Google's servers
       (in Chrome) to convert speech to text. Requires internet +
       microphone permission. Works on Chrome and Edge. Safari partial.
       Firefox not supported by default.
  ---------------------------------------------------------- */

  var SpeechEngine = {
    synth: window.speechSynthesis || null,
    recognition: null,
    isListening: false,
    isSpeaking: false,
    preferredVoice: null,
    _voiceLoadAttempts: 0,

    /* ── Init ── */
    init: function () {
      var self = this;

      if (self.synth) {
        // Voices load asynchronously — keep retrying until they appear
        if (self.synth.onvoiceschanged !== undefined) {
          self.synth.onvoiceschanged = function () { self._loadVoice(); };
        }
        self._loadVoice();
      }

      self._initRecognition();
    },

    _loadVoice: function () {
      var self = this;
      if (!self.synth) return;

      var voices = self.synth.getVoices();

      if (voices.length === 0 && self._voiceLoadAttempts < 20) {
        // Voices not ready yet — retry
        self._voiceLoadAttempts++;
        setTimeout(function () { self._loadVoice(); }, 200);
        return;
      }

      // Prefer a Nigerian English or British English voice, then any English
      self.preferredVoice =
        voices.find(function (v) { return v.lang === 'en-GB' && v.localService; }) ||
        voices.find(function (v) { return v.lang === 'en-US' && v.localService; }) ||
        voices.find(function (v) { return v.lang === 'en-GB'; }) ||
        voices.find(function (v) { return v.lang && v.lang.startsWith('en'); }) ||
        voices[0] ||
        null;
    },

    /* ══════════════════════════════════════════════════════
       TEXT-TO-SPEECH (Speaker button — reads question aloud)
    ══════════════════════════════════════════════════════ */
    speak: function (text, rate, pitch) {
      var self = this;

      if (!self.synth) {
        if (window.UI) UI.toast('Text-to-speech is not supported in your browser.', 'warning');
        return;
      }

      // Stop anything already playing
      self.cancel();

      var cleaned = self._cleanText(text);
      if (!cleaned) return;

      // Chrome has a bug where speak() silently fails if voices aren't loaded
      // We retry once if voices still empty
      if (!self.preferredVoice) {
        self._loadVoice();
      }

      var utter = new SpeechSynthesisUtterance(cleaned);

      if (self.preferredVoice) {
        utter.voice = self.preferredVoice;
        utter.lang  = self.preferredVoice.lang;
      } else {
        utter.lang = 'en-US';
      }

      utter.rate   = typeof rate  === 'number' ? rate  : 0.92;
      utter.pitch  = typeof pitch === 'number' ? pitch : 1;
      utter.volume = 1;

      utter.onstart = function () {
        self.isSpeaking = true;
        var btn = document.getElementById('seTtsBtn');
        if (btn) btn.classList.add('is-speaking');
      };

      utter.onend = function () {
        self.isSpeaking = false;
        var btn = document.getElementById('seTtsBtn');
        if (btn) btn.classList.remove('is-speaking');
      };

      utter.onerror = function (e) {
        self.isSpeaking = false;
        var btn = document.getElementById('seTtsBtn');
        if (btn) btn.classList.remove('is-speaking');
        // 'interrupted' is normal when cancel() is called — don't show error
        if (e.error && e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('[TTS] Error:', e.error);
        }
      };

      // Chrome workaround: resume context if paused
      if (self.synth.paused) self.synth.resume();

      self.synth.speak(utter);

      // Chrome bug: sometimes speak() queues but never fires — kick it
      setTimeout(function () {
        if (self.synth && self.synth.paused) self.synth.resume();
      }, 100);
    },

    cancel: function () {
      var self = this;
      if (self.synth) {
        self.synth.cancel();
      }
      self.isSpeaking = false;
      var btn = document.getElementById('seTtsBtn');
      if (btn) btn.classList.remove('is-speaking');
    },

    _cleanText: function (text) {
      if (!text) return '';
      return String(text)
        .replace(/\\\(([\s\S]*?)\\\)/g, ' $1 ')           // KaTeX \( ... \)
        .replace(/\\\[([\s\S]*?)\\\]/g, ' $1 ')            // KaTeX \[ ... \]
        .replace(/\$\$([\s\S]*?)\$\$/g, ' $1 ')            // $$ ... $$
        .replace(/\$([\s\S]*?)\$/g,     ' $1 ')            // $ ... $
        .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 over $2')
        .replace(/\\sqrt\{([^}]*)\}/g,  'square root of $1')
        .replace(/\\[a-zA-Z]+/g, ' ')                      // remaining LaTeX
        .replace(/[{}_^]/g, ' ')                           // braces + LaTeX operators
        .replace(/&amp;/g, 'and').replace(/&lt;/g, 'less than')
        .replace(/&gt;/g, 'greater than').replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'").replace(/&[a-z]+;/g, ' ')  // other HTML entities
        .replace(/<[^>]+>/g, ' ')                          // strip any HTML tags
        .replace(/\s+/g, ' ')
        .trim();
    },

    /* ══════════════════════════════════════════════════════
       SPEECH-TO-TEXT (Mic button — listens for voice commands)
       The browser records your voice via the microphone and
       converts it to text. Chrome sends audio to Google's
       servers. Requires: internet + microphone permission.
    ══════════════════════════════════════════════════════ */
    _initRecognition: function () {
      var self = this;

      // Check browser support
      var SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognitionAPI) {
        // Not supported — mic button will show a helpful message when clicked
        console.info('[STT] SpeechRecognition not available in this browser.');
        return;
      }

      self.recognition = new SpeechRecognitionAPI();

      // continuous: false = stops after one phrase (better for commands)
      self.recognition.continuous     = false;
      self.recognition.interimResults = false;
      self.recognition.lang           = 'en-US';
      self.recognition.maxAlternatives = 1;

      self.recognition.onresult = function (e) {
        var transcript = '';
        if (e.results && e.results.length > 0 && e.results[0].length > 0) {
          transcript = e.results[0][0].transcript.toLowerCase().trim();
        }
        if (transcript) {
          if (window.UI) UI.toast('Heard: "' + transcript + '"', 'info', 2000);
          self._handleCommand(transcript);
        }
      };

      self.recognition.onerror = function (e) {
        self.isListening = false;
        self._updateListeningUI(false);

        var msg = '';
        switch (e.error) {
          case 'not-allowed':
          case 'permission-denied':
            msg = 'Microphone access was denied. Please allow it in your browser settings.';
            break;
          case 'no-speech':
            msg = 'No speech detected. Please try again.';
            break;
          case 'network':
            msg = 'Voice recognition needs an internet connection.';
            break;
          case 'aborted':
            // User or code cancelled — silent
            break;
          case 'audio-capture':
            msg = 'No microphone found. Please plug one in.';
            break;
          case 'service-not-allowed':
            msg = 'Voice recognition is not allowed on this page. Try on HTTPS.';
            break;
          default:
            msg = 'Voice error: ' + e.error;
        }

        if (msg && window.UI) UI.toast(msg, 'warning', 5000);
      };

      self.recognition.onend = function () {
        self.isListening = false;
        self._updateListeningUI(false);
      };

      self.recognition.onnomatch = function () {
        self.isListening = false;
        self._updateListeningUI(false);
        if (window.UI) UI.toast('Could not understand. Please try again.', 'warning', 3000);
      };
    },

    startListening: function () {
      var self = this;

      // Browser doesn't support it at all
      if (!self.recognition) {
        var SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionAPI) {
          if (window.UI) UI.toast('Voice commands require Chrome or Edge browser.', 'warning', 5000);
          return;
        }
        // Try re-initialising (in case it failed on load)
        self._initRecognition();
        if (!self.recognition) return;
      }

      // Toggle: if already listening, stop
      if (self.isListening) {
        self.stopListening();
        return;
      }

      // Request microphone permission explicitly first so the user
      // sees the browser prompt before recognition tries to start
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(function (stream) {
            // Permission granted — stop the stream (recognition manages its own)
            stream.getTracks().forEach(function (t) { t.stop(); });
            self._startRecognition();
          })
          .catch(function (err) {
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              if (window.UI) UI.toast('Microphone access denied. Please allow it in your browser settings and try again.', 'warning', 6000);
            } else {
              if (window.UI) UI.toast('Could not access microphone: ' + err.message, 'warning', 5000);
            }
          });
      } else {
        // Older browser — try direct start (may prompt for mic)
        self._startRecognition();
      }
    },

    _startRecognition: function () {
      var self = this;
      try {
        self.recognition.start();
        self.isListening = true;
        self._updateListeningUI(true);
        if (window.UI) UI.toast('Listening… Say: Next, Back, Read, Select A–E, or Submit.', 'info', 3000);
      } catch (err) {
        // "already started" error — stop first then retry
        if (err.name === 'InvalidStateError') {
          try { self.recognition.abort(); } catch (e2) {}
          setTimeout(function () { self._startRecognition(); }, 300);
        } else {
          console.warn('[STT] start error:', err);
          self.isListening = false;
          self._updateListeningUI(false);
          if (window.UI) UI.toast('Could not start voice recognition. Please try again.', 'warning');
        }
      }
    },

    stopListening: function () {
      var self = this;
      if (self.recognition) {
        try { self.recognition.stop(); } catch (e) {}
      }
      self.isListening = false;
      self._updateListeningUI(false);
    },

    _updateListeningUI: function (active) {
      var btn = document.getElementById('seSttBtn');
      if (btn) btn.classList.toggle('is-listening', active);
    },

    _handleCommand: function (cmd) {
      var self = this;

      // Stop TTS first
      if (cmd.includes('stop') || cmd.includes('quiet') ||
          cmd.includes('shut up') || cmd.includes('cancel') || cmd.includes('silence')) {
        self.cancel();
        return;
      }

      if (!window.Exam) return;

      // Navigation
      if (cmd.includes('next') || cmd.includes('forward')) {
        if (Exam.nextQuestion) {
          Exam.nextQuestion();
          if (window.VtxSound) try { VtxSound.info(); } catch (e) {}
        }

      } else if (cmd.includes('back') || cmd.includes('previous') || cmd.includes('prev')) {
        if (Exam.prevQuestion) {
          Exam.prevQuestion();
          if (window.VtxSound) try { VtxSound.info(); } catch (e) {}
        }

      } else if (cmd.includes('submit') || cmd.includes('finish') || cmd.includes('end exam')) {
        if (Exam.submitExam) Exam.submitExam();

      } else if (cmd.includes('read') || cmd.includes('speak') ||
                 cmd.includes('question') || cmd.includes('repeat')) {
        self.readCurrentQuestion();

      } else {
        // Select option: "select A", "choose B", "option C", "answer 1", "pick 2"
        var match = cmd.match(/(?:select|choose|option|answer|pick)\s*([a-e1-5])/i);
        if (!match) {
          // Also handle just saying the letter/number alone
          match = cmd.match(/^([a-e])$/) || cmd.match(/^([1-5])$/);
        }

        if (match) {
          var map = { a:0, b:1, c:2, d:3, e:4, '1':0, '2':1, '3':2, '4':3, '5':4 };
          var idx = map[match[1].toLowerCase()];
          if (idx !== undefined) {
            var labels = document.querySelectorAll('.option-label');
            if (labels && labels[idx]) {
              labels[idx].click();
              if (window.VtxSound) try { VtxSound.success(); } catch (e) {}
            }
          }
        } else {
          if (window.UI) UI.toast('Command not recognised. Try: Next, Back, Read, Select A–E.', 'warning', 3000);
        }
      }
    },

    /* ══════════════════════════════════════════════════════
       EXAM INTEGRATION
       Called after renderExam() mounts the buttons into the DOM.
       Wires the speaker and mic buttons to their actions.
    ══════════════════════════════════════════════════════ */
    injectExamButtons: function () {
      var self = this;

      var ttsBtn = document.getElementById('seTtsBtn');
      var sttBtn = document.getElementById('seSttBtn');

      if (ttsBtn) {
        // Remove any old listener by replacing with clone
        var newTts = ttsBtn.cloneNode(true);
        ttsBtn.parentNode.replaceChild(newTts, ttsBtn);
        newTts.addEventListener('click', function (e) {
          e.stopPropagation();
          if (self.isSpeaking) {
            self.cancel();
          } else {
            self.readCurrentQuestion();
          }
        });
      }

      if (sttBtn) {
        var newStt = sttBtn.cloneNode(true);
        sttBtn.parentNode.replaceChild(newStt, sttBtn);
        newStt.addEventListener('click', function (e) {
          e.stopPropagation();
          self.startListening();
        });
      }
    },

    readCurrentQuestion: function () {
      var self = this;

      // Check there is an active exam (step property may or may not exist)
      if (!window.AppState || !AppState.exam) {
        if (window.UI) UI.toast('No active question to read.', 'warning');
        return;
      }

      // Build the text from the DOM directly — most reliable approach
      // since the question is already rendered
      var qWrap = document.querySelector('.vtx-question-wrap');
      if (!qWrap) {
        if (window.UI) UI.toast('Question not found on screen.', 'warning');
        return;
      }

      // Get the question paragraph (the one with the question number + text)
      var qPara = qWrap.querySelector('p');
      var questionText = qPara ? qPara.textContent.trim() : '';

      // Get all options
      var optionLabels = Array.from(document.querySelectorAll('.option-label'));
      var optionsText = '';

      if (optionLabels.length > 0) {
        var optParts = optionLabels.map(function (lbl, i) {
          var letter = String.fromCharCode(65 + i); // A, B, C...
          // .flex-1 span holds the option text
          var textSpan = lbl.querySelector('.flex-1') || lbl;
          return letter + ': ' + textSpan.textContent.trim();
        });
        optionsText = '. Options are: ' + optParts.join('. ');
      }

      var fullText = questionText + optionsText;

      if (!fullText.trim()) {
        if (window.UI) UI.toast('Nothing to read.', 'warning');
        return;
      }

      self.speak(fullText, 0.9, 1);
    },
  };

  window.SpeechEngine = SpeechEngine;

  // Init after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { SpeechEngine.init(); });
  } else {
    SpeechEngine.init();
  }

}());
