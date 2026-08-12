/* ============================================================
   js/speech-engine.js — Text-to-Speech + Voice Commands
   Web Speech API wrapper for Vertex CBT
   ============================================================ */

(function () {
  'use strict';

  const SpeechEngine = {
    synth: window.speechSynthesis || null,
    recognition: null,
    isListening: false,
    isSpeaking: false,
    preferredVoice: null,

    /* ── Init ── */
    init() {
      if (this.synth) {
        if (this.synth.onvoiceschanged !== undefined) {
          this.synth.onvoiceschanged = () => this._loadVoice();
        }
        this._loadVoice();
      }
      this._initRecognition();
    },

    _loadVoice() {
      if (!this.synth) return;
      const voices = this.synth.getVoices();
      this.preferredVoice = voices.find(v => v.lang === 'en-GB') ||
                            voices.find(v => v.lang && v.lang.startsWith('en')) ||
                            voices[0];
    },

    /* ══════════════════════════════════════════════════════
       TEXT-TO-SPEECH (Read questions aloud)
    ══════════════════════════════════════════════════════ */
    speak(text, rate, pitch) {
      if (!this.synth) {
        if (window.UI) UI.toast('Text-to-speech is not supported in this browser.', 'warning');
        return;
      }
      this.cancel();
      const cleaned = this._cleanText(text);
      if (!cleaned) return;
      const utter = new SpeechSynthesisUtterance(cleaned);
      utter.voice = this.preferredVoice;
      utter.lang  = this.preferredVoice ? this.preferredVoice.lang : 'en-US';
      utter.rate  = rate  || 0.95;
      utter.pitch = pitch || 1;

      utter.onstart = () => { this.isSpeaking = true; };
      utter.onend   = () => { this.isSpeaking = false; };
      utter.onerror = () => { this.isSpeaking = false; };

      this.synth.speak(utter);
    },

    cancel() {
      if (this.synth) this.synth.cancel();
      this.isSpeaking = false;
    },

    _cleanText(text) {
      if (!text) return '';
      return text
        .replace(/\\\((.*?)\\\)/gs, ' $1 ')         // KaTeX inline
        .replace(/\\\[(.*?)\\\]/gs, ' $1 ')          // KaTeX block
        .replace(/\$\$(.*?)\$\$/gs, ' $1 ')          // Display math
        .replace(/\$(.*?)\$/gs, ' $1 ')              // Inline dollar math
        .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1 over $2')  // fractions
        .replace(/\\sqrt\{([^}]*)\}/g, 'square root of $1')       // sqrt
        .replace(/\\[a-zA-Z]+/g, '')                 // Remove remaining LaTeX commands
        .replace(/[{}]/g, '')                        // Remove braces
        .replace(/\s+/g, ' ')
        .trim();
    },

    /* ══════════════════════════════════════════════════════
       SPEECH-TO-TEXT (Voice commands during exam)
    ══════════════════════════════════════════════════════ */
    _initRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      this.recognition = new SpeechRecognition();
      this.recognition.continuous      = false;
      this.recognition.interimResults  = false;
      this.recognition.lang            = 'en-US';

      this.recognition.onresult = (e) => {
        const transcript = e.results[0][0].transcript.toLowerCase().trim();
        this._handleCommand(transcript);
      };

      this.recognition.onerror = (e) => {
        this.isListening = false;
        this._updateListeningUI(false);
        if (e.error !== 'aborted' && e.error !== 'no-speech' && window.UI) {
          UI.toast('Voice error: ' + e.error, 'warning');
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this._updateListeningUI(false);
      };
    },

    startListening() {
      if (!this.recognition) {
        if (window.UI) UI.toast('Voice commands require Chrome, Edge, or Safari.', 'warning');
        return;
      }
      /* Toggle: if already listening, stop instead */
      if (this.isListening) {
        this.stopListening();
        return;
      }
      try {
        this.recognition.start();
        this.isListening = true;
        this._updateListeningUI(true);
        if (window.UI) UI.toast('Listening… Say: Next, Back, Select A–E, Read, or Submit.', 'info', 2500);
      } catch (err) {
        console.warn('[STT] start error:', err);
        this.isListening = false;
        this._updateListeningUI(false);
      }
    },

    stopListening() {
      if (this.recognition && this.isListening) {
        this.recognition.stop();
        this.isListening = false;
        this._updateListeningUI(false);
      }
    },

    _updateListeningUI(active) {
      const btn = document.getElementById('seSttBtn');
      if (btn) btn.classList.toggle('is-listening', active);
    },

    _handleCommand(cmd) {
      if (window.UI) UI.toast('Heard: "' + cmd + '"', 'info', 1800);

      /* Global stop — check first so "stop reading" works even outside exam */
      if (cmd.includes('stop') || cmd.includes('shut up') || cmd.includes('cancel')) {
        this.cancel();
        return;
      }

      /* Exam navigation */
      if (window.Exam) {
        if (cmd.includes('next') || cmd.includes('forward')) {
          if (Exam.nextQuestion) { Exam.nextQuestion(); if (window.VtxSound) VtxSound.info(); }
        } else if (cmd.includes('back') || cmd.includes('previous') || cmd.includes('prev')) {
          if (Exam.prevQuestion) { Exam.prevQuestion(); if (window.VtxSound) VtxSound.info(); }
        } else if (cmd.includes('submit') || cmd.includes('finish') || cmd.includes('end exam')) {
          if (Exam.submitExam) Exam.submitExam();
        } else if (cmd.includes('read') || cmd.includes('speak') || cmd.includes('question')) {
          this.readCurrentQuestion();
        } else {
          /* Select A–E or 1–5 */
          const match = cmd.match(/select\s*([a-e1-5])/i);
          if (match) {
            const map = { a:0, b:1, c:2, d:3, e:4, '1':0, '2':1, '3':2, '4':3, '5':4 };
            const idx = map[match[1].toLowerCase()];
            const labels = document.querySelectorAll('.option-label');
            if (labels && labels[idx]) {
              labels[idx].click();
              if (window.VtxSound) VtxSound.success();
            }
          }
        }
      }
    },

    /* ══════════════════════════════════════════════════════
       EXAM INTEGRATION — Inject buttons & read question
    ══════════════════════════════════════════════════════ */
    injectExamButtons() {
      /* Only inject when a timer is present (i.e. we are in an active exam) */
      if (!document.getElementById('timerDisplay')) return;
      /* Don't inject twice */
      if (document.getElementById('seExamControls')) return;

      /* Target the sticky exam header specifically */
      const header = document.querySelector('.exam-header-sticky');
      if (!header) return;

      const wrap = document.createElement('div');
      wrap.id = 'seExamControls';

      /* Read-Aloud button */
      const ttsBtn = document.createElement('button');
      ttsBtn.id        = 'seTtsBtn';
      ttsBtn.className = 'se-tts-btn';
      ttsBtn.title     = 'Read question aloud (R)';
      ttsBtn.setAttribute('aria-label', 'Read question aloud');
      ttsBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`;
      ttsBtn.onclick = () => {
        /* If currently speaking, cancel — acts as a toggle */
        if (this.isSpeaking) { this.cancel(); return; }
        this.readCurrentQuestion();
      };

      /* Voice-Command button */
      const sttBtn = document.createElement('button');
      sttBtn.id        = 'seSttBtn';
      sttBtn.className = 'se-stt-btn';
      sttBtn.title     = 'Voice command (M)';
      sttBtn.setAttribute('aria-label', 'Start voice command');
      sttBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`;
      sttBtn.onclick = () => this.startListening();

      wrap.appendChild(ttsBtn);
      wrap.appendChild(sttBtn);
      header.appendChild(wrap);
    },

    readCurrentQuestion() {
      if (!window.AppState || !AppState.exam || AppState.exam.step !== 'exam') {
        if (window.UI) UI.toast('No active question to read.', 'warning');
        return;
      }

      /* Grab question text — ordered from most to least specific */
      const qEl = document.querySelector(
        '.vtx-question-wrap > p, ' +
        '.vtx-question-text, ' +
        '#questionText, ' +
        '.question-text, ' +
        '.vtx-question-wrap h3'
      );

      const opts = [...document.querySelectorAll('.option-label')];

      let text = qEl ? qEl.textContent.trim() : 'Question text not found.';

      if (opts.length) {
        text += '. Options: ' + opts.map((el, i) => {
          const letter = String.fromCharCode(65 + i);
          /* Get just the option text, not the letter prefix rendered in the DOM */
          const span = el.querySelector('.flex-1') || el;
          return letter + ': ' + span.textContent.trim();
        }).join('. ');
      }

      this.speak(text, 0.95, 1);
    },
  };

  window.SpeechEngine = SpeechEngine;
  document.addEventListener('DOMContentLoaded', function () { SpeechEngine.init(); });
}());
