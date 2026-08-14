/* ============================================================
   js/speech.js — SpeechEngine  v4
   Handles TTS (text-to-speech) and STT (speech-to-text) for
   the exam screen using the native Web Speech API.
   ============================================================ */

(function () {
  'use strict';

  var _synth   = window.speechSynthesis || null;
  var _SpeechR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

  var ttsSupported = !!_synth;
  var sttSupported = !!_SpeechR;

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

  /* ── TTS ── */
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
      _hookTtsBtnState(false);
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

  function speak(rawText, onDone) {
    if (!ttsSupported) {
      if (window.UI) UI.toast('Text-to-speech is not supported in your browser.', 'warning', 4000);
      if (typeof onDone === 'function') onDone();
      return;
    }
    var clean = rawText
      .replace(/<[^>]*>/g, ' ')
      .replace(/%%MATH_\d+%%/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, ' (math expression) ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) { if (typeof onDone === 'function') onDone(); return; }
    cancel();
    _ttsQueue  = _chunkText(clean);
    _ttsActive = true;
    _setTtsBtn(true);
    _hookTtsBtnState(true);

    if (typeof onDone === 'function') {
      var origQueue = _ttsQueue.slice();
      var interval  = setInterval(function () {
        if (!_ttsActive && _ttsQueue.length === 0) {
          clearInterval(interval);
          onDone();
        }
      }, 300);
    }

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
    _hookTtsBtnState(false);
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

  function _hookTtsBtnState(speaking) {
    var pill = document.querySelector('.vtx-speech-pill');
    if (pill) pill.setAttribute('data-tts-on', speaking ? 'true' : 'false');
    var srBtn = document.querySelector('.se-tts-btn');
    if (srBtn) {
      if (speaking) srBtn.classList.add('sr-se-speaking');
      else srBtn.classList.remove('sr-se-speaking');
    }
  }

  /* ── STT ── */
  var _recognition  = null;
  var _sttActive    = false;
  var _sttRunning   = false;
  var _sttRestartId = null;
  var _sttCallbacks = { onResult: null, onError: null };

  function _isStandaloneSafari() {
    return (
      (window.navigator.standalone === true ||
       (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)) &&
      /Safari/i.test(navigator.userAgent) &&
      !/Chrome/i.test(navigator.userAgent)
    );
  }

  function _openSession() {
    if (!sttSupported || !_sttActive) return;
    if (_sttRunning) return;

    try { _recognition = new _SpeechR(); } catch (e) {
      console.error('[SpeechEngine] Could not create SpeechRecognition:', e);
      _sttActive = false;
      _setSttBtn(false);
      if (_sttCallbacks.onError) _sttCallbacks.onError('Could not start the microphone. Please reload and try again.');
      return;
    }

    var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    _recognition.continuous      = !isIOS;
    _recognition.interimResults  = false;
    _recognition.maxAlternatives = 3;
    _recognition.lang            = 'en-US';

    _recognition.onstart = function () {
      _sttRunning = true;
      _setSttBtn(true);
    };

    _recognition.onresult = function (event) {
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
        _sttCallbacks.onResult(transcripts[0], transcripts);
      }
    };

    _recognition.onend = function () {
      _sttRunning = false;
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
      if (event.error === 'aborted') {
        if (_sttActive) { _sttRestartId = setTimeout(function () { if (_sttActive) _openSession(); }, 300); }
        return;
      }
      if (event.error === 'no-speech') {
        if (_sttActive) { _sttRestartId = setTimeout(function () { if (_sttActive) _openSession(); }, 200); }
        return;
      }
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
    _sttCallbacks.onResult = onResult;
    _sttCallbacks.onError  = onError;
    stopSTT();
    _sttActive = true;
    _openSession();
  }

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
    if (pill) pill.setAttribute('data-mic-on', listening ? 'true' : 'false');
  }

  /* ── Letter aliases ── */
  var _letterAliases = {
    'a': 0, 'aye': 0, 'eye': 0, 'i': 0, 'hey': 0, 'eh': 0, 'ay': 0, 'ai': 0,
    'b': 1, 'be':  1, 'bee': 1, 'bi': 1,
    'c': 2, 'see': 2, 'sea': 2, 'si': 2, 'key': 2, 'ce': 2,
    'd': 3, 'dee': 3, 'de':  3, 'di': 3,
    'e': 4, 'ee':  4,
    'f': 5, 'ef':  5, 'eff': 5,
  };

  function _extractLetter(transcript, allTranscripts) {
    var candidates = allTranscripts ? allTranscripts.slice() : [transcript];
    if (candidates.indexOf(transcript) === -1) candidates.unshift(transcript);
    for (var c = 0; c < candidates.length; c++) {
      var t = (candidates[c] || '').toLowerCase().trim();
      t = t.replace(/^(option|answer|pick|choose|select|letter)\s+/i, '');
      if (_letterAliases[t] !== undefined) return _letterAliases[t];
      var words = t.split(/\s+/);
      for (var w = 0; w < words.length; w++) {
        if (_letterAliases[words[w]] !== undefined) return _letterAliases[words[w]];
      }
    }
    return -1;
  }

  /* ── Parse question number from transcript ── */
  function _extractQuestionNumber(t) {
    var wordNums = {
      'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
      'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
      'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
      'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    };
    var digitMatch = t.match(/\b(\d+)\b/);
    if (digitMatch) return parseInt(digitMatch[1], 10);
    var words = t.split(/\s+/);
    for (var w = 0; w < words.length; w++) {
      if (wordNums[words[w]] !== undefined) return wordNums[words[w]];
    }
    return -1;
  }

  /* ── Parse subject name from transcript ── */
  function _extractSubject(t, subjects) {
    if (!Array.isArray(subjects)) return null;
    var tl = t.toLowerCase();
    var best = null, bestLen = 0;
    for (var i = 0; i < subjects.length; i++) {
      var sl = subjects[i].toLowerCase();
      if (tl.indexOf(sl) !== -1 && sl.length > bestLen) {
        best = subjects[i];
        bestLen = sl.length;
      }
    }
    return best;
  }

  /* ════════════════════════════════════════════════════════
     RESULTS PAGE — explanation modal
     ════════════════════════════════════════════════════════ */

  var _resultsExam   = null;
  var _resultsResult = null;

  /* Store reference so voice commands on results page can access exam data */
  function setResultsContext(exam, result) {
    _resultsExam   = exam;
    _resultsResult = result;
  }

  /* Strip HTML tags and LaTeX for clean spoken/displayed text */
  function _cleanText(str) {
    if (!str) return '';
    return String(str)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim();
  }

  /* Fetch a Wikipedia summary for a topic — free, no key */
  function _fetchWikipediaSummary(topic, callback) {
    var encoded = encodeURIComponent(topic.replace(/\s+/g, '_'));
    var url     = 'https://en.wikipedia.org/api/rest_v1/page/summary/' + encoded;
    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.extract && data.extract.length > 40) {
          callback(null, data.extract, data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page);
        } else {
          callback('not_found', null, null);
        }
      })
      .catch(function (err) { callback('error', null, null); });
  }

  /* Search Wikipedia for best article matching a topic */
  function _searchWikipedia(query, callback) {
    var url = 'https://en.wikipedia.org/w/rest.php/v1/search/page?q=' +
              encodeURIComponent(query) + '&limit=3';
    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.pages && data.pages.length > 0) {
          callback(null, data.pages[0].title, data.pages);
        } else {
          callback('not_found', null, null);
        }
      })
      .catch(function (err) { callback('error', null, null); });
  }

  /* Build a plain-English topic string from a question */
  function _buildSearchTopic(q, subj) {
    var text = _cleanText(q.q || '');
    var words = text.split(/\s+/).filter(function (w) { return w.length > 3; });
    var keywords = words.slice(0, 6).join(' ');
    return (subj || '') + ' ' + keywords;
  }

  /* Show the deep-explanation modal */
  function _showExplanationModal(questionNumber, subjectName) {
    var exam   = _resultsExam;
    var result = _resultsResult;
    if (!exam || !result) return;

    var subj = subjectName || exam.subjects[0];
    if (!exam.questions[subj]) {
      var found = exam.subjects.find(function (s) {
        return s.toLowerCase().indexOf((subjectName || '').toLowerCase()) !== -1;
      });
      subj = found || exam.subjects[0];
    }

    var qList = exam.questions[subj];
    if (!qList) { UI.toast('Subject not found.', 'warning'); return; }

    var idx = (questionNumber >= 1 && questionNumber <= qList.length) ? questionNumber - 1 : 0;
    var q   = qList[idx];
    if (!q) { UI.toast('Question not found.', 'warning'); return; }

    var userAns   = exam.answers[subj + '-' + idx];
    var isCorrect = userAns === q.ans;
    var chosenTxt = userAns !== undefined ? _cleanText(q.opts[userAns]) : 'Not answered';
    var correctTxt = _cleanText(q.opts[q.ans]);
    var questionTxt = _cleanText(q.q);
    var expTxt      = _cleanText(q.exp || '');

    var existing = document.getElementById('seExplainModal');
    if (existing) existing.remove();

    var modal = document.createElement('div');
    modal.id        = 'seExplainModal';
    modal.className = 'se-explain-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Question Explanation');

    modal.innerHTML =
      '<div class="se-explain-modal-box">' +
        '<div class="se-explain-modal-hdr">' +
          '<div class="se-explain-modal-title">' +
            '<span class="se-explain-q-badge">' + subj + ' — Q' + questionNumber + '</span>' +
            '<span class="se-explain-status ' + (isCorrect ? 'is-correct' : 'is-wrong') + '">' +
              (isCorrect ? '✓ Correct' : '✗ Incorrect') +
            '</span>' +
          '</div>' +
          '<button class="se-explain-close-btn" id="seExplainClose" aria-label="Close">✕</button>' +
        '</div>' +

        '<div class="se-explain-body" id="seExplainBody">' +
          '<p class="se-explain-question">' + questionTxt + '</p>' +

          '<div class="se-explain-answers">' +
            '<div class="se-explain-ans-row ' + (isCorrect ? 'is-correct' : 'is-wrong') + '">' +
              '<span class="se-explain-ans-lbl">Your answer:</span>' +
              '<span>' + chosenTxt + '</span>' +
            '</div>' +
            '<div class="se-explain-ans-row is-correct">' +
              '<span class="se-explain-ans-lbl">Correct answer:</span>' +
              '<span>' + correctTxt + '</span>' +
            '</div>' +
          '</div>' +

          '<div class="se-explain-section">' +
            '<div class="se-explain-section-title">Explanation</div>' +
            '<div class="se-explain-exp-text" id="seExplainExpText">' + (expTxt || 'No explanation provided.') + '</div>' +
          '</div>' +

          '<div class="se-explain-deeper-wrap" id="seExplainDeeperWrap">' +
            '<button class="se-explain-deeper-btn" id="seExplainDeeperBtn">' +
              '<span class="se-explain-deeper-icon">🔍</span>' +
              'Get deeper explanation' +
            '</button>' +
            '<p class="se-explain-deeper-hint">Uses Wikipedia — free, no account needed</p>' +
          '</div>' +

          '<div class="se-explain-deep-result" id="seExplainDeepResult" style="display:none;"></div>' +
        '</div>' +

        '<div class="se-explain-modal-ftr">' +
          '<button class="se-explain-read-btn" id="seExplainReadBtn">' +
            '<i class="ph ph-speaker-high"></i> Read explanation' +
          '</button>' +
          '<button class="se-explain-close-btn2" id="seExplainClose2">Close</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    requestAnimationFrame(function () { modal.classList.add('is-visible'); });

    /* Close handlers */
    function _closeModal() {
      cancel();
      modal.classList.remove('is-visible');
      setTimeout(function () { if (modal.parentNode) modal.remove(); }, 280);
    }

    document.getElementById('seExplainClose').addEventListener('click', _closeModal);
    document.getElementById('seExplainClose2').addEventListener('click', _closeModal);
    modal.addEventListener('click', function (e) {
      if (e.target === modal) _closeModal();
    });

    /* Read explanation button */
    var readBtn = document.getElementById('seExplainReadBtn');
    readBtn.addEventListener('click', function () {
      if (_ttsActive) { cancel(); return; }
      var text = 'Question ' + questionNumber + '. ' + questionTxt + '. ';
      text += 'Your answer was: ' + chosenTxt + '. ';
      text += 'The correct answer is: ' + correctTxt + '. ';
      if (expTxt) text += 'Explanation: ' + expTxt;
      var deepEl = document.getElementById('seExplainDeepResult');
      if (deepEl && deepEl.style.display !== 'none') {
        text += '. Additional information: ' + deepEl.getAttribute('data-plain') || '';
      }
      speak(text);
    });

    /* Deeper explanation button */
    var deeperBtn = document.getElementById('seExplainDeeperBtn');
    deeperBtn.addEventListener('click', function () {
      _loadDeeperExplanation(q, subj, idx);
    });

    /* Auto-read the built-in explanation */
    setTimeout(function () {
      var text = 'Question ' + questionNumber + ' in ' + subj + '. ';
      text += questionTxt + '. ';
      text += 'The correct answer is: ' + correctTxt + '. ';
      if (expTxt) text += 'Explanation: ' + expTxt + '. ';
      text += 'Would you like a deeper explanation? Say "yes" or click the button below.';
      speak(text, function () {
        if (!_sttActive) return;
        _awaitYesNoForDeeper(q, subj, idx);
      });
    }, 400);
  }

  function _awaitYesNoForDeeper(q, subj, idx) {
    var _yesNo = null;
    var prevResult = _sttCallbacks.onResult;
    _yesNo = function (transcript) {
      var t = transcript.toLowerCase().trim();
      if (/\b(yes|yeah|sure|ok|okay|more|deeper|explain more|further|go ahead|please)\b/.test(t)) {
        _sttCallbacks.onResult = prevResult;
        _loadDeeperExplanation(q, subj, idx);
      } else if (/\b(no|nope|skip|close|done|stop|enough)\b/.test(t)) {
        _sttCallbacks.onResult = prevResult;
        speak('Alright. You can close this panel or ask me to explain another question.');
      }
    };
    _sttCallbacks.onResult = function (best, all) {
      _yesNo(best);
      if (prevResult) prevResult(best, all);
    };
  }

  function _loadDeeperExplanation(q, subj, idx) {
    var deepResult = document.getElementById('seExplainDeepResult');
    var deeperWrap = document.getElementById('seExplainDeeperWrap');
    if (!deepResult) return;

    deepResult.style.display = 'block';
    deepResult.innerHTML     =
      '<div class="se-explain-loading">' +
        '<span class="se-explain-spinner"></span>' +
        'Searching Wikipedia…' +
      '</div>';
    if (deeperWrap) deeperWrap.style.display = 'none';

    var searchTopic = _buildSearchTopic(q, subj);

    _searchWikipedia(searchTopic, function (err, title, pages) {
      if (err || !title) {
        var fallbackTopic = _cleanText(q.q || '').split(/\s+/).slice(0, 4).join(' ');
        _searchWikipedia(fallbackTopic, function (err2, title2) {
          if (err2 || !title2) {
            _showDeeperFallback(deepResult, q, subj);
          } else {
            _fetchAndShowDeep(title2, deepResult, q, subj);
          }
        });
      } else {
        _fetchAndShowDeep(title, deepResult, q, subj);
      }
    });
  }

  function _fetchAndShowDeep(title, deepResult, q, subj) {
    _fetchWikipediaSummary(title, function (err, extract, pageUrl) {
      if (err || !extract) {
        _showDeeperFallback(deepResult, q, subj);
        return;
      }

      var plain = extract.replace(/\s+/g, ' ').trim();
      if (plain.length > 600) plain = plain.slice(0, 600) + '…';

      deepResult.setAttribute('data-plain', plain);
      deepResult.innerHTML =
        '<div class="se-explain-deep-content">' +
          '<div class="se-explain-deep-src">' +
            '<span class="se-explain-wiki-badge">Wikipedia</span>' +
            '<strong>' + _escHtml(title) + '</strong>' +
          '</div>' +
          '<p class="se-explain-deep-text">' + _escHtml(plain) + '</p>' +
          (pageUrl
            ? '<a class="se-explain-wiki-link" href="' + pageUrl + '" target="_blank" rel="noopener">' +
              'Read full article ↗</a>'
            : '') +
        '</div>';

      speak('Here is additional information. ' + plain);
    });
  }

  function _showDeeperFallback(deepResult, q, subj) {
    var opts  = Array.isArray(q.opts) ? q.opts : [];
    var extra = 'The correct answer is: ' + _cleanText(opts[q.ans] || '') + '. ';
    if (q.exp) extra += _cleanText(q.exp);
    var expanded = _expandExplanation(q, subj);
    var plain    = expanded || extra;

    deepResult.setAttribute('data-plain', plain);
    deepResult.innerHTML =
      '<div class="se-explain-deep-content se-explain-deep-local">' +
        '<div class="se-explain-deep-src">' +
          '<span class="se-explain-wiki-badge se-explain-wiki-badge--local">Vertex AI</span>' +
          '<strong>Extended explanation</strong>' +
        '</div>' +
        '<p class="se-explain-deep-text">' + _escHtml(plain) + '</p>' +
      '</div>';

    speak('Here is an extended explanation. ' + plain);
  }

  /* Locally expand an explanation using question context */
  function _expandExplanation(q, subj) {
    var question = _cleanText(q.q || '');
    var exp      = _cleanText(q.exp || '');
    var correct  = _cleanText((q.opts || [])[q.ans] || '');
    var parts    = [];

    if (exp)     parts.push(exp);
    if (correct) parts.push('The correct answer, ' + correct + ', is the best response to this question.');
    parts.push('In ' + (subj || 'this subject') + ', it is important to understand the key concept being tested here.');
    if (question.length > 10) {
      parts.push('The question asks: ' + question);
    }

    return parts.join(' ');
  }

  function _escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ── Exam voice commands ── */
  function _handleVoiceCommand(transcript, allTranscripts, exam) {
    var t = (transcript || '').toLowerCase().trim();

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

    /* Jump to question number */
    var goMatch = t.match(/\b(?:go to|jump to|question|number|q)\s+(\w+)/i);
    if (goMatch) {
      var num = _extractQuestionNumber(goMatch[1] + ' ' + (goMatch[2] || ''));
      if (num === -1) num = _extractQuestionNumber(t);
      if (num >= 1 && exam && exam.questions[exam.currentSubject]) {
        var qLen = exam.questions[exam.currentSubject].length;
        if (num <= qLen) {
          UI.toast('Jumping to question ' + num + '…', 'info', 1500);
          if (window.Exam && typeof Exam.goTo === 'function') Exam.goTo(num - 1);
          return;
        } else {
          UI.toast('Question ' + num + ' does not exist. This subject has ' + qLen + ' questions.', 'warning', 3000);
          return;
        }
      }
    }

    /* Jump to subject */
    if (/\b(switch to|go to|open|next subject|subject)\b/.test(t) && exam) {
      var targetSubj = _extractSubject(t, exam.subjects);
      if (targetSubj) {
        UI.toast('Switching to ' + targetSubj + '…', 'info', 1500);
        if (window.Exam && typeof Exam.switchSubject === 'function') Exam.switchSubject(targetSubj);
        return;
      }
      if (/\bnext subject\b/.test(t)) {
        var curIdx = exam.subjects.indexOf(exam.currentSubject);
        if (curIdx < exam.subjects.length - 1) {
          var ns = exam.subjects[curIdx + 1];
          UI.toast('Switching to ' + ns + '…', 'info', 1500);
          if (window.Exam && typeof Exam.switchSubject === 'function') Exam.switchSubject(ns);
          return;
        } else {
          UI.toast('You are already on the last subject.', 'info', 2500);
          return;
        }
      }
    }

    if (/\b(read|listen|read (the )?question|read (it )?out|speak)\b/.test(t)) {
      var ttsBtn = document.getElementById('seTtsBtn');
      if (ttsBtn) ttsBtn.click();
      return;
    }
    if (/\b(stop( reading| speaking)?|quiet|silence|shut up)\b/.test(t)) {
      if (_ttsActive) { cancel(); UI.toast('Stopped reading.', 'info', 1500); }
      return;
    }

    if (/\b(submit( exam| test| now)?|finish( exam| test)?|end exam|confirm( exam| submission)?)\b/.test(t)) {
      UI.toast('Submit command received — confirming…', 'info', 2000);
      if (window.Exam && typeof Exam.submitExam === 'function') {
        setTimeout(function () { Exam.submitExam(false); }, 1500);
      }
      return;
    }

    if (!exam) return;
    var subj2    = exam.currentSubject;
    var qList2   = exam.questions[subj2];
    var optCount = (qList2[exam.currentIndex].opts || []).length;
    var letterIdx = _extractLetter(t, allTranscripts);
    if (letterIdx >= 0 && letterIdx < optCount) {
      var letterName = String.fromCharCode(65 + letterIdx);
      UI.toast('Selecting option ' + letterName + '…', 'info', 1500);
      var labels = document.querySelectorAll('.option-label');
      if (labels[letterIdx]) labels[letterIdx].click();
      return;
    }

    UI.toast(
      'Not understood: "' + transcript + '". Try: A B C D, next, previous, question 3, next subject, read, stop, submit.',
      'info', 4000
    );
  }

  /* ── Results page voice commands ── */
  function _handleResultsCommand(transcript, allTranscripts) {
    var t = (transcript || '').toLowerCase().trim();
    var exam   = _resultsExam;
    var result = _resultsResult;

    /* Close explanation modal */
    if (/\b(close|dismiss|exit|hide|go back)\b/.test(t)) {
      var modal = document.getElementById('seExplainModal');
      if (modal) {
        cancel();
        modal.classList.remove('is-visible');
        setTimeout(function () { if (modal.parentNode) modal.remove(); }, 280);
        return;
      }
    }

    /* Back to dashboard */
    if (/\b(dashboard|back|home|start over|new exam)\b/.test(t)) {
      cancel();
      if (window.Exam && typeof Exam.renderSubjectSelection === 'function') {
        UI.toast('Going back to dashboard…', 'info', 1500);
        setTimeout(function () { Exam.renderSubjectSelection(); }, 600);
      }
      return;
    }

    /* Share on WhatsApp */
    if (/\b(whatsapp|share|send|send to whatsapp)\b/.test(t)) {
      if (window.Exam && typeof Exam._shareWhatsApp === 'function') {
        UI.toast('Opening WhatsApp…', 'info', 1500);
        Exam._shareWhatsApp();
      }
      return;
    }

    /* Copy result */
    if (/\b(copy|copy result|clipboard)\b/.test(t)) {
      if (window.Exam && typeof Exam._copyResult === 'function') {
        Exam._copyResult();
      }
      return;
    }

    /* Stop reading */
    if (/\b(stop( reading| speaking)?|quiet|silence|shut up)\b/.test(t)) {
      if (_ttsActive) { cancel(); UI.toast('Stopped.', 'info', 1200); }
      return;
    }

    /* Read overall result */
    if (/\b(read( result)?|read( my)? score|what( is|'s) my (score|result|grade))\b/.test(t)) {
      if (!result) return;
      var summary = 'Your overall score is ' + result.percentage + ' percent, Grade ' + result.grade + '. ';
      result.subjects.forEach(function (s) {
        summary += s + ': ' + result.scores[s] + ' percent. ';
      });
      speak(summary);
      return;
    }

    /* Explain a specific question: "explain question 5 in Mathematics" */
    var explainMatch =
      t.match(/\bexplain\s+(?:question\s+|q\s*|number\s*)?(\w+)(?:\s+in\s+(.+))?/i) ||
      t.match(/\b(?:question|number|q)\s*(\w+)(?:\s+(?:in|from|for)\s+(.+))?/i);

    if (explainMatch) {
      var rawNum  = explainMatch[1];
      var rawSubj = (explainMatch[2] || '').trim();
      var qNum    = _extractQuestionNumber(rawNum);
      if (qNum === -1) qNum = 1;

      var targetSubj2 = null;
      if (rawSubj && exam) {
        targetSubj2 = _extractSubject(rawSubj, exam.subjects);
      }
      if (!targetSubj2 && exam) targetSubj2 = exam.subjects[0];

      _showExplanationModal(qNum, targetSubj2);
      return;
    }

    /* Deeper explanation (yes/no inside modal context) */
    if (/\b(yes|yeah|sure|ok|okay|more|deeper|explain more|further|go ahead|please)\b/.test(t)) {
      var deepBtn = document.getElementById('seExplainDeeperBtn');
      if (deepBtn) { deepBtn.click(); return; }
    }

    UI.toast(
      'Not understood: "' + transcript + '". Try: "explain question 3 in Maths", "back to dashboard", "share on WhatsApp", "read result".',
      'info', 5000
    );
  }

  /* ── Keyboard shortcuts ── */
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

  /* ── Exam button wiring ── */
  function wireExamButtons(exam) {
    var ttsBtn = document.getElementById('seTtsBtn');
    if (ttsBtn) {
      ttsBtn.addEventListener('click', function () {
        if (_ttsActive) { cancel(); return; }
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

    var sttBtn = document.getElementById('seSttBtn');
    if (sttBtn) {
      sttBtn.addEventListener('click', function () {
        if (_sttActive) { stopSTT(); UI.toast('Microphone off.', 'info', 1500); return; }
        if (!sttSupported) {
          UI.toast('Voice commands are not supported in your browser. Please use Chrome or Edge.', 'warning', 5000);
          return;
        }
        UI.toast('Microphone is ON. Say A, B, C, D, "next", "previous", "question 3", "next subject", "read", "stop", or "submit exam".', 'info', 4000);
        startSTT(
          function (bestTranscript, allTranscripts) {
            _handleVoiceCommand(bestTranscript, allTranscripts, exam);
          },
          null,
          function (msg) { UI.toast(msg, 'warning', 5000); }
        );
      });
    }
  }

  /* ── Results page mic button wiring ── */
  function wireResultsButtons(exam, result) {
    setResultsContext(exam, result);

    var sttBtn = document.getElementById('seResultsSttBtn');
    if (!sttBtn) return;

    sttBtn.addEventListener('click', function () {
      if (_sttActive) {
        stopSTT();
        UI.toast('Microphone off.', 'info', 1500);
        return;
      }
      if (!sttSupported) {
        UI.toast('Voice commands are not supported in your browser.', 'warning', 4000);
        return;
      }
      UI.toast(
        'Listening… Try: "explain question 3 in Maths", "back to dashboard", "share on WhatsApp", "read result".',
        'info', 5000
      );
      startSTT(
        function (best, all) { _handleResultsCommand(best, all); },
        null,
        function (msg) { UI.toast(msg, 'warning', 5000); }
      );
    });
  }

  /* ── Public API ── */
  window.SpeechEngine = {
    speak:              speak,
    cancel:             cancel,
    startSTT:           startSTT,
    stopSTT:            stopSTT,
    wireExamButtons:    wireExamButtons,
    wireResultsButtons: wireResultsButtons,
    setResultsContext:  setResultsContext,
    showExplanationModal: _showExplanationModal,
    ttsSupported:       ttsSupported,
    sttSupported:       sttSupported,
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
