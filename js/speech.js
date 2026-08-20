/* ============================================================
   js/speech.js — SpeechEngine  v7
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

  /* ── Persisted voice preference ── */
  var _PREF_KEY = 'vtx_tts_voice_pref';
  var _voicePref = (function () {
    try {
      var raw = localStorage.getItem(_PREF_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  })();

  function _savePref(pref) {
    _voicePref = pref;
    try {
      if (pref) {
        localStorage.setItem(_PREF_KEY, JSON.stringify(pref));
      } else {
        localStorage.removeItem(_PREF_KEY);
      }
    } catch (e) {}
  }

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

  /* ── Default English voice picker ── */
  function _pickDefaultVoice() {
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

  /* ── Voice picker: respects saved preference ── */
  function _pickVoice() {
    if (_voices.length === 0) return null;

    if (_voicePref) {
      if (_voicePref.voiceName) {
        var exact = _voices.filter(function (v) {
          return v.name === _voicePref.voiceName;
        });
        if (exact.length > 0) return exact[0];
      }
      if (_voicePref.lang) {
        var langMatch = _voices.filter(function (v) {
          return v.lang === _voicePref.lang || v.lang.startsWith(_voicePref.lang.split('-')[0]);
        });
        if (langMatch.length > 0) return langMatch[0];
      }
      _savePref(null);
    }

    return _pickDefaultVoice();
  }

  /* ════════════════════════════════════════════════════════
     VOICE SELECTION UI
     ════════════════════════════════════════════════════════ */

  function _inferGender(voice) {
    var n = (voice.name || '').toLowerCase();
    var femaleTokens = [
      'female', 'woman', 'girl',
      'samantha', 'victoria', 'karen', 'moira', 'tessa', 'fiona',
      'allison', 'ava', 'susan', 'zoe', 'kate', 'alice', 'emma',
      'emily', 'sarah', 'lisa', 'linda', 'julia', 'anna', 'eva',
      'amelie', 'joana', 'monica', 'paulina', 'lucia', 'silvia',
      'sara', 'camila', 'lekha', 'veena', 'kanya', 'damayanti',
      'mei-jia', 'sin-ji', 'ting-ting', 'yi-jia', 'yuna',
      'kyoko', 'o-ren', 'maged', 'laila', 'ioana', 'milena',
      'mariska', 'zosia', 'filiz', 'yelda', 'katya', 'irina',
      'melina', 'nora', 'sara', 'ellen',
    ];
    var maleTokens = [
      'male', 'man', 'boy',
      'daniel', 'alex', 'fred', 'ralph', 'albert', 'bruce',
      'junior', 'lee', 'xander', 'jorge', 'carlos', 'diego',
      'enrique', 'juan', 'luca', 'nicolas', 'felix', 'henrik',
      'thomas', 'yannick', 'damien', 'romain', 'pierre',
      'aaron', 'arthur', 'oliver', 'james', 'mark', 'paul',
      'gordon', 'krishna', 'ravi',
    ];

    var isFemale = femaleTokens.some(function (t) { return n.indexOf(t) !== -1; });
    var isMale   = maleTokens.some(function (t)   { return n.indexOf(t) !== -1; });

    if (/\bfemale\b/.test(n))  return 'female';
    if (/\bmale\b/.test(n))    return 'male';
    if (/google\s+\S+\s+english\s+female/i.test(voice.name)) return 'female';
    if (/google\s+\S+\s+english\s+male/i.test(voice.name))   return 'male';
    if (/microsoft\s+\S+\s+online.*female/i.test(voice.name)) return 'female';
    if (/microsoft\s+\S+\s+online.*male/i.test(voice.name))   return 'male';

    if (isFemale && !isMale) return 'female';
    if (isMale   && !isFemale) return 'male';
    return 'unknown';
  }

  function _genderLabel(gender) {
    if (gender === 'female') return ' (F)';
    if (gender === 'male')   return ' (M)';
    return '';
  }

  function _groupVoicesByLang() {
    var map = {};
    var seen = {};
    _voices.forEach(function (v) {
      if (seen[v.name]) return;
      seen[v.name] = true;
      var lang = v.lang || 'Unknown';
      if (!map[lang]) map[lang] = [];
      map[lang].push(v);
    });
    return map;
  }

  function _langLabel(langCode) {
    try {
      if (window.Intl && Intl.DisplayNames) {
        var dn = new Intl.DisplayNames(['en'], { type: 'language' });
        var label = dn.of(langCode);
        if (label && label !== langCode) return label + ' (' + langCode + ')';
      }
    } catch (e) {}
    return langCode;
  }

  function _openVoiceSelector() {
    var existing = document.getElementById('vtxVoicePanel');
    if (existing) { existing.remove(); return; }

    if (!ttsSupported) {
      if (window.UI) UI.toast('Text-to-speech is not supported in your browser.', 'warning', 4000);
      return;
    }

    if (!_voicesReady || _voices.length === 0) {
      var list = _synth.getVoices();
      if (list && list.length > 0) { _voices = list; _voicesReady = true; }
    }

    if (_voices.length === 0) {
      if (window.UI) UI.toast('Voices are still loading — please try again in a moment.', 'info', 3000);
      return;
    }

    var grouped   = _groupVoicesByLang();
    var langCodes = Object.keys(grouped).sort(function (a, b) {
      var aEn = a.startsWith('en') ? 0 : 1;
      var bEn = b.startsWith('en') ? 0 : 1;
      if (aEn !== bEn) return aEn - bEn;
      return a.localeCompare(b);
    });

    var activeLang  = (_voicePref && _voicePref.lang) || 'en-GB';
    if (!grouped[activeLang]) {
      var base = activeLang.split('-')[0];
      var found = langCodes.filter(function (l) { return l.startsWith(base); });
      activeLang = found.length > 0 ? found[0] : langCodes[0];
    }

    var panel = document.createElement('div');
    panel.id = 'vtxVoicePanel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Voice selection');
    panel.style.cssText = [
      'position:fixed',
      'bottom:72px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:var(--bg-base,#fff)',
      'border:1px solid var(--border,#e0e0e0)',
      'border-radius:14px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.18)',
      'z-index:100000',
      'width:min(420px,calc(100vw - 2rem))',
      'max-height:70vh',
      'display:flex',
      'flex-direction:column',
      'overflow:hidden',
      'font-family:var(--font,sans-serif)',
      'animation:vtxVPFadeIn 150ms ease',
    ].join(';');

    if (!document.getElementById('vtxVPStyle')) {
      var st = document.createElement('style');
      st.id = 'vtxVPStyle';
      st.textContent = '@keyframes vtxVPFadeIn{from{opacity:0;transform:translateX(-50%) translateY(8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}';
      document.head.appendChild(st);
    }

    var hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-bottom:1px solid var(--border,#e0e0e0);flex-shrink:0;';
    hdr.innerHTML =
      '<span style="display:flex;align-items:center;gap:.5rem;font-size:.875rem;font-weight:700;color:var(--text-1,#111);">' +
        '<i class="ph ph-speaker-high" style="font-size:1rem;"></i> Voice Settings' +
      '</span>' +
      '<button id="vtxVPClose" aria-label="Close" style="background:none;border:none;cursor:pointer;font-size:1.125rem;color:var(--text-3,#888);line-height:1;padding:2px 6px;border-radius:6px;">&#x2715;</button>';
    panel.appendChild(hdr);

    var body = document.createElement('div');
    body.style.cssText = 'flex:1;overflow-y:auto;padding:.75rem 1rem;display:flex;flex-direction:column;gap:.875rem;';

    /* Default option */
    var defaultRow = document.createElement('div');
    var isDefault  = !_voicePref;
    defaultRow.style.cssText = 'display:flex;align-items:center;gap:.625rem;padding:.5rem .75rem;border-radius:8px;cursor:pointer;border:1.5px solid ' + (isDefault ? 'var(--accent,#4f6ef7)' : 'var(--border,#e0e0e0)') + ';background:' + (isDefault ? 'var(--accent-subtle,#eef2ff)' : 'transparent') + ';transition:all 120ms;';
    defaultRow.innerHTML =
      '<i class="ph ph-globe" style="font-size:1rem;flex-shrink:0;color:var(--text-3,#888);"></i>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:.875rem;font-weight:600;color:var(--text-1,#111);">Default (English)</div>' +
        '<div style="font-size:.75rem;color:var(--text-3,#888);">Uses the best available English voice</div>' +
      '</div>' +
      (isDefault ? '<span style="font-size:.8125rem;font-weight:700;color:var(--accent,#4f6ef7);">&#10003;</span>' : '');
    defaultRow.addEventListener('click', function () {
      _savePref(null);
      panel.remove();
      if (window.UI) UI.toast('Voice reset to default English.', 'success', 2000);
    });
    body.appendChild(defaultRow);

    /* Language selector */
    var langSection = document.createElement('div');
    var langLabel   = document.createElement('div');
    langLabel.style.cssText = 'font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-4,#aaa);margin-bottom:.375rem;';
    langLabel.textContent = 'Language';
    langSection.appendChild(langLabel);

    var langSel = document.createElement('select');
    langSel.style.cssText = 'width:100%;padding:.5rem .625rem;border-radius:8px;border:1px solid var(--border,#e0e0e0);background:var(--bg-subtle,#f7f7f7);color:var(--text-1,#111);font-size:.875rem;font-family:inherit;cursor:pointer;appearance:auto;';
    langCodes.forEach(function (lc) {
      var opt = document.createElement('option');
      opt.value       = lc;
      opt.textContent = _langLabel(lc);
      if (lc === activeLang) opt.selected = true;
      langSel.appendChild(opt);
    });
    langSection.appendChild(langSel);
    body.appendChild(langSection);

    /* Voice list */
    var voiceSection = document.createElement('div');
    var voiceLbl     = document.createElement('div');
    voiceLbl.style.cssText = langLabel.style.cssText;
    voiceLbl.textContent = 'Voice';
    voiceSection.appendChild(voiceLbl);

    var voiceListEl = document.createElement('div');
    voiceListEl.id = 'vtxVoiceList';
    voiceListEl.style.cssText = 'display:flex;flex-direction:column;gap:.375rem;';
    voiceSection.appendChild(voiceListEl);
    body.appendChild(voiceSection);

    panel.appendChild(body);
    document.body.appendChild(panel);

    document.getElementById('vtxVPClose').addEventListener('click', function () { panel.remove(); });
    panel.addEventListener('click', function (e) { if (e.target === panel) panel.remove(); });

    function _onKey(e) {
      if (e.key === 'Escape') { panel.remove(); document.removeEventListener('keydown', _onKey); }
    }
    document.addEventListener('keydown', _onKey);

    function _renderVoices(langCode) {
      voiceListEl.innerHTML = '';
      var vList = grouped[langCode] || [];

      if (vList.length === 0) {
        var noV = document.createElement('p');
        noV.style.cssText = 'font-size:.8125rem;color:var(--text-3,#888);margin:0;';
        noV.textContent = 'No voices available for this language.';
        voiceListEl.appendChild(noV);
        return;
      }

      vList.forEach(function (v) {
        var gender     = _inferGender(v);
        var gLabel     = _genderLabel(gender);
        var isSelected = _voicePref && _voicePref.voiceName === v.name;
        var local      = v.localService ? ' · Local' : ' · Online';

        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:.625rem;padding:.5rem .75rem;border-radius:8px;cursor:pointer;border:1.5px solid ' + (isSelected ? 'var(--accent,#4f6ef7)' : 'var(--border,#e0e0e0)') + ';background:' + (isSelected ? 'var(--accent-subtle,#eef2ff)' : 'transparent') + ';transition:all 120ms;';

        var genderIconClass = gender === 'female' ? 'ph-gender-female' : gender === 'male' ? 'ph-gender-male' : 'ph-user';
        var genderColor     = gender === 'female' ? '#e879a0' : gender === 'male' ? '#4f8ef7' : 'var(--text-4,#aaa)';

        row.innerHTML =
          '<i class="ph ' + genderIconClass + '" style="font-size:1rem;color:' + genderColor + ';flex-shrink:0;width:1.25rem;text-align:center;"></i>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:.875rem;font-weight:600;color:var(--text-1,#111);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
              _escHtmlLocal(v.name) + (gLabel ? '<span style="color:' + genderColor + ';font-size:.8125rem;">' + gLabel + '</span>' : '') +
            '</div>' +
            '<div style="font-size:.6875rem;color:var(--text-4,#aaa);">' +
              _escHtmlLocal(v.lang) + local +
            '</div>' +
          '</div>' +
          (isSelected ? '<span style="font-size:.8125rem;font-weight:700;color:var(--accent,#4f6ef7);flex-shrink:0;">&#10003;</span>' : '');

        row.addEventListener('click', function () {
          _savePref({ lang: v.lang, voiceName: v.name });
          panel.remove();
          if (window.UI) UI.toast('Voice set to: ' + v.name, 'success', 2500);
          _previewVoice(v);
        });

        voiceListEl.appendChild(row);
      });
    }

    _renderVoices(activeLang);

    langSel.addEventListener('change', function () {
      _renderVoices(langSel.value);
    });
  }

  function _previewVoice(voice) {
    if (!_synth) return;
    cancel();
    var utt   = new SpeechSynthesisUtterance('Hello! This is how I sound.');
    utt.voice = voice;
    utt.rate  = 0.92;
    utt.lang  = voice.lang || 'en-US';
    _synth.speak(utt);
  }

  function _escHtmlLocal(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
      var interval = setInterval(function () {
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

  /* ── Submit confirmation state ── */
  var _awaitingSubmitConfirm = false;

  /* ── Deeper / student-question state ── */
  var _awaitingStudentQuestion = false;   // NEW: waiting for student's own question or a keyword
  var _awaitingDeeperAnswer    = false;   // kept for results-page back-compat
  var _deeperContext           = null;    // { q, subj, idx }

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
  _sttActive               = false;
  _awaitingSubmitConfirm   = false;
  _awaitingStudentQuestion = false;
  _awaitingDeeperAnswer    = false;
  // _deeperContext is intentionally NOT cleared here.
  // It is cleared in _showExplanationModal's close handler
  // and in wireExamButtons / wireResultsButtons where a real
  // context switch happens.
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
     WIKIPEDIA SEARCH
     ════════════════════════════════════════════════════════ */

  var _stopWords = new RegExp(
    '\\b(the|a|an|is|are|was|were|be|been|being|have|has|had|do|does|did|' +
    'will|would|could|should|may|might|shall|can|of|in|on|at|to|for|with|by|' +
    'from|as|into|through|during|before|after|above|below|between|each|' +
    'which|what|who|whom|whose|when|where|why|how|all|both|any|some|' +
    'this|that|these|those|it|its|they|their|them|he|she|his|her|we|our|' +
    'you|your|i|me|my|not|no|nor|so|yet|but|or|and|if|then|than|because|' +
    'following|correctly|describes|happens|during|preparation|process|' +
    'defined|definition|explain|example|type|types|kind|kinds|form|forms|' +
    'used|uses|use|called|known|result|results|produced|produces|cause|causes|' +
    'effect|effects|given|find|found|determine|calculate|solve|identify|' +
    'choose|select|best|correct|wrong|true|false|statement|statements|' +
    'option|options|answer|question|following|below|above|one|two|three|' +
    'four|five|six|seven|eight|nine|ten)\\b',
    'gi'
  );

  var _subjectBoosts = {
    'chemistry':          ['reaction', 'element', 'compound', 'bond', 'acid', 'base', 'salt', 'ion', 'molecule', 'atom', 'oxidation', 'reduction', 'electrolysis', 'organic', 'periodic'],
    'biology':            ['cell', 'organism', 'photosynthesis', 'respiration', 'genetics', 'enzyme', 'hormone', 'tissue', 'organ', 'evolution', 'dna', 'protein', 'osmosis', 'diffusion'],
    'physics':            ['force', 'energy', 'velocity', 'acceleration', 'momentum', 'wave', 'light', 'electric', 'magnetic', 'pressure', 'heat', 'thermodynamics', 'gravity', 'current'],
    'mathematics':        ['theorem', 'equation', 'function', 'derivative', 'integral', 'matrix', 'vector', 'probability', 'statistics', 'geometry', 'algebra', 'calculus', 'trigonometry'],
    'maths':              ['theorem', 'equation', 'function', 'derivative', 'integral', 'matrix', 'vector', 'probability', 'statistics', 'geometry', 'algebra', 'calculus', 'trigonometry'],
    'english':            ['grammar', 'syntax', 'clause', 'phrase', 'tense', 'figure of speech', 'rhetoric', 'literary', 'prose', 'poem', 'verb', 'noun', 'adjective', 'adverb'],
    'geography':          ['climate', 'landform', 'erosion', 'population', 'migration', 'ecosystem', 'biome', 'weathering', 'river', 'plate tectonics', 'soil', 'atmosphere'],
    'economics':          ['supply', 'demand', 'inflation', 'gdp', 'market', 'trade', 'fiscal', 'monetary', 'elasticity', 'opportunity cost', 'production', 'utility'],
    'government':         ['democracy', 'constitution', 'legislature', 'executive', 'judiciary', 'federalism', 'sovereignty', 'election', 'parliament', 'rights'],
    'history':            ['war', 'revolution', 'empire', 'colonialism', 'independence', 'treaty', 'civilization', 'dynasty', 'reform', 'nationalism'],
    'literature':         ['novel', 'poetry', 'drama', 'theme', 'character', 'plot', 'symbolism', 'metaphor', 'alliteration', 'irony'],
    'further mathematics':['calculus', 'differential', 'complex number', 'matrix', 'vector', 'series', 'proof', 'binomial', 'statistics'],
  };

  function _buildSmartSearchQuery(q, subj) {
    var questionText = _cleanText(q.q || '');
    var correctOpt   = _cleanText((q.opts || [])[q.ans] || '');
    var expText      = _cleanText(q.exp || '');

    var combined = correctOpt + ' ' + questionText + ' ' + expText;
    var stripped = combined.replace(_stopWords, ' ').replace(/\s+/g, ' ').trim();
    var tokens = stripped.split(/\s+/).filter(function (w) { return w.length >= 4; });

    var seen   = {};
    var unique = [];
    for (var i = 0; i < tokens.length; i++) {
      var lw = tokens[i].toLowerCase();
      if (!seen[lw]) { seen[lw] = true; unique.push(tokens[i]); }
    }

    var subjKey = (subj || '').toLowerCase().trim();
    var boosts  = _subjectBoosts[subjKey] || [];
    unique.sort(function (a, b) {
      var aBoost = boosts.indexOf(a.toLowerCase()) !== -1 ? 1 : 0;
      var bBoost = boosts.indexOf(b.toLowerCase()) !== -1 ? 1 : 0;
      if (bBoost !== aBoost) return bBoost - aBoost;
      return b.length - a.length;
    });

    var keywords = unique.slice(0, 5);
    var correctWords = correctOpt.split(/\s+/).filter(function (w) { return w.length >= 3; });
    if (correctWords.length >= 2 && correctWords.length <= 5) {
      return correctOpt + ' ' + keywords.slice(0, 3).join(' ');
    }

    return keywords.join(' ');
  }

  function _cleanText(str) {
    if (!str) return '';
    return String(str)
      .replace(/<[^>]*>/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$|\$[^$]*?\$/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
      .replace(/\s+/g, ' ').trim();
  }

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
      .catch(function () { callback('error', null, null); });
  }

  function _searchWikipedia(query, callback) {
    var url = 'https://en.wikipedia.org/w/rest.php/v1/search/page?q=' +
              encodeURIComponent(query) + '&limit=5';
    fetch(url, { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.pages && data.pages.length > 0) {
          callback(null, data.pages[0].title, data.pages);
        } else {
          callback('not_found', null, null);
        }
      })
      .catch(function () { callback('error', null, null); });
  }

  /* ════════════════════════════════════════════════════════
     RESULTS PAGE — explanation modal
     ════════════════════════════════════════════════════════ */

  var _resultsExam   = null;
  var _resultsResult = null;

  function setResultsContext(exam, result) {
    _resultsExam   = exam;
    _resultsResult = result;
  }

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

  var userAns    = exam.answers[subj + '-' + idx];
  var isCorrect  = userAns === q.ans;
  var chosenTxt  = userAns !== undefined ? _cleanText(q.opts[userAns]) : 'Not answered';
  var correctTxt = _cleanText(q.opts[q.ans]);
  var questionTxt = _cleanText(q.q);
  var expTxt      = _cleanText(q.exp || '');

  var existing = document.getElementById('seExplainModal');
  if (existing) existing.remove();

  /* Reset explain-interaction states, but preserve _deeperContext
     only after we set it fresh below. */
  _awaitingStudentQuestion = false;
  _awaitingDeeperAnswer    = false;
  _deeperContext = { q: q, subj: subj, idx: idx };

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
            (isCorrect
              ? '<i class="ph ph-check-circle"></i> Correct'
              : '<i class="ph ph-x-circle"></i> Incorrect') +
          '</span>' +
        '</div>' +
        '<button class="se-explain-close-btn" id="seExplainClose" aria-label="Close">&#x2715;</button>' +
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

        '<div class="se-explain-ask-wrap" id="seExplainAskWrap">' +
          '<div class="se-explain-ask-label">' +
            '<i class="ph ph-chat-circle-text"></i> Do you have a question about this topic?' +
          '</div>' +
          '<div class="se-explain-ask-row">' +
            '<input type="text" id="seExplainAskInput" class="se-explain-ask-input"' +
              ' placeholder="Type your question here…" autocomplete="off" />' +
            '<button class="se-explain-ask-btn" id="seExplainAskBtn" aria-label="Search">' +
              '<i class="ph ph-magnifying-glass"></i>' +
            '</button>' +
          '</div>' +
          '<p class="se-explain-deeper-hint">Or say your question aloud if the microphone is on</p>' +
        '</div>' +

        '<div class="se-explain-deeper-wrap" id="seExplainDeeperWrap">' +
          '<button class="se-explain-deeper-btn" id="seExplainDeeperBtn">' +
            '<i class="ph ph-book-open-text"></i>' +
            'Get a fuller explanation from Wikipedia' +
          '</button>' +
          '<p class="se-explain-deeper-hint">Searches Wikipedia automatically based on this question</p>' +
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

  function _closeModal() {
    cancel();
    // Stop any modal-local STT session
    if (_modalSttActive) {
      stopSTT();
      _modalSttActive = false;
    }
    _awaitingStudentQuestion = false;
    _awaitingDeeperAnswer    = false;
    _deeperContext = null;
    modal.classList.remove('is-visible');
    setTimeout(function () { if (modal.parentNode) modal.remove(); }, 280);
  }

  document.getElementById('seExplainClose').addEventListener('click', _closeModal);
  document.getElementById('seExplainClose2').addEventListener('click', _closeModal);
  modal.addEventListener('click', function (e) {
    if (e.target === modal) _closeModal();
  });

  var readBtn = document.getElementById('seExplainReadBtn');
  readBtn.addEventListener('click', function () {
    if (_ttsActive) { cancel(); return; }
    var text = 'Question ' + questionNumber + '. ' + questionTxt + '. ';
    text += 'Your answer was: ' + chosenTxt + '. ';
    text += 'The correct answer is: ' + correctTxt + '. ';
    if (expTxt) text += 'Explanation: ' + expTxt;
    var deepEl = document.getElementById('seExplainDeepResult');
    if (deepEl && deepEl.style.display !== 'none') {
      var plain = deepEl.getAttribute('data-plain') || '';
      if (plain) text += '. Additional information: ' + plain;
    }
    speak(text);
  });

  var askBtn   = document.getElementById('seExplainAskBtn');
  var askInput = document.getElementById('seExplainAskInput');
  function _handleStudentQuery(queryText) {
    var q2 = (queryText || '').trim();
    if (!q2) return;
    _awaitingStudentQuestion = false;
    _loadDeeperExplanation(null, subj, idx, q2);
  }
  askBtn.addEventListener('click', function () {
    _handleStudentQuery(askInput.value);
  });
  askInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); _handleStudentQuery(askInput.value); }
  });

  var deeperBtn = document.getElementById('seExplainDeeperBtn');
  deeperBtn.addEventListener('click', function () {
    _awaitingStudentQuestion = false;
    _loadDeeperExplanation(q, subj, idx, null);
  });

  // Track whether we started STT from inside this modal, so we can
  // stop it cleanly without killing a pre-existing results-page session.
  var _modalSttActive = false;

  setTimeout(function () {
    if (!document.getElementById('seExplainModal')) return;

    var text = 'Question ' + questionNumber + ' in ' + subj + '. ';
    text += questionTxt + '. ';
    text += 'The correct answer is: ' + correctTxt + '. ';
    if (expTxt) text += 'Explanation: ' + expTxt + '. ';
    text += 'Do you have a question about this topic? Say it now and I will search for it. ' +
            'Or say "deeper" if you want me to find a fuller explanation from Wikipedia. ' +
            'Say "no" to skip.';

    speak(text, function () {
      // Guard: modal may have been closed while TTS was playing
      if (!document.getElementById('seExplainModal')) return;

      _awaitingStudentQuestion = true;

      // Auto-start STT so the student can actually speak the question
      // they were just prompted to say. Only start if not already listening.
      if (sttSupported && !_sttActive) {
        _modalSttActive = true;
        startSTT(
          function (bestTranscript, allTranscripts) {
            // Route through the results handler which already checks
            // _awaitingStudentQuestion correctly.
            _handleResultsCommand(bestTranscript, allTranscripts);
          },
          null,
          function (msg) {
            _modalSttActive = false;
            UI.toast(msg, 'warning', 4000);
          }
        );
      }
    });
  }, 400);
}

  /*
   * _loadDeeperExplanation
   * If studentQuery is a non-empty string, search Wikipedia using the student's
   * own question. Otherwise fall back to the auto-built query from the question data.
   * q may be null when called from a student query.
   */
  function _loadDeeperExplanation(q, subj, idx, studentQuery) {
    var deepResult = document.getElementById('seExplainDeepResult');
    var deeperWrap = document.getElementById('seExplainDeeperWrap');
    var askWrap    = document.getElementById('seExplainAskWrap');
    if (!deepResult) return;

    _awaitingStudentQuestion = false;
    _awaitingDeeperAnswer    = false;

    deepResult.style.display = 'block';
    deepResult.innerHTML =
      '<div class="se-explain-loading">' +
        '<span class="se-explain-spinner"></span>' +
        'Searching Wikipedia…' +
      '</div>';
    if (deeperWrap) deeperWrap.style.display = 'none';
    if (askWrap)    askWrap.style.display    = 'none';

    /* Choose the search query */
    var searchQuery;
    if (studentQuery && studentQuery.trim().length > 2) {
      searchQuery = studentQuery.trim();
      console.log('[SpeechEngine] Student question search query:', searchQuery);
    } else {
      /* q must be valid here — fall back gracefully if not */
      if (!q) {
        _showDeeperFallback(deepResult, { q: '', opts: [], ans: 0, exp: '' }, subj);
        return;
      }
      searchQuery = _buildSmartSearchQuery(q, subj);
      console.log('[SpeechEngine] Auto Wikipedia search query:', searchQuery);
    }

    _searchWikipedia(searchQuery, function (err, title, pages) {
      if (err || !title) {
        /* If student query failed, try a shorter version; else show fallback */
        if (studentQuery) {
          /* Try just the first 3 words of the student's question */
          var shorter = studentQuery.split(/\s+/).slice(0, 3).join(' ');
          if (shorter !== studentQuery && shorter.length > 3) {
            _searchWikipedia(shorter, function (err2, title2) {
              if (err2 || !title2) {
                _showStudentQueryFallback(deepResult, studentQuery);
              } else {
                _fetchAndShowDeep(title2, deepResult, q, subj, studentQuery);
              }
            });
          } else {
            _showStudentQueryFallback(deepResult, studentQuery);
          }
        } else {
          var fallback = q ? _cleanText((q.opts || [])[q.ans] || '') : '';
          if (fallback.length < 4) {
            _showDeeperFallback(deepResult, q || {}, subj);
            return;
          }
          _searchWikipedia(fallback, function (err2, title2) {
            if (err2 || !title2) {
              _showDeeperFallback(deepResult, q || {}, subj);
            } else {
              _fetchAndShowDeep(title2, deepResult, q, subj, null);
            }
          });
        }
      } else {
        _fetchAndShowDeep(title, deepResult, q, subj, studentQuery);
      }
    });
  }

  function _fetchAndShowDeep(title, deepResult, q, subj, studentQuery) {
  _fetchWikipediaSummary(title, function (err, extract, pageUrl) {
    if (err || !extract) {
      if (studentQuery) {
        _showStudentQueryFallback(deepResult, studentQuery);
      } else {
        _showDeeperFallback(deepResult, q || {}, subj);
      }
      return;
    }

    var plain = extract.replace(/\s+/g, ' ').trim();

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
            'Read full article <i class="ph ph-arrow-square-out" style="font-size:.8em;vertical-align:middle;"></i></a>'
          : '') +
      '</div>';

    // Guard: only speak if the modal is still open
    if (document.getElementById('seExplainModal')) {
      speak('Here is information from Wikipedia about ' + title + '. ' + plain);
    }
  });
}

  /* Fallback when the student's typed/spoken question yields no Wikipedia result */
  function _showStudentQueryFallback(deepResult, query) {
  var msg = 'Sorry, I could not find a Wikipedia article matching your question: "' + query + '". ' +
            'Try rephrasing it or use the fuller explanation button below.';
  deepResult.setAttribute('data-plain', '');
  deepResult.innerHTML =
    '<div class="se-explain-deep-content se-explain-deep-local">' +
      '<div class="se-explain-deep-src">' +
        '<span class="se-explain-wiki-badge se-explain-wiki-badge--local">' +
          '<i class="ph ph-warning" style="font-size:.75rem;vertical-align:middle;"></i> Not found' +
        '</span>' +
        '<strong>No result</strong>' +
      '</div>' +
      '<p class="se-explain-deep-text">' + _escHtml(msg) + '</p>' +
      '<button class="se-explain-deeper-btn" id="seExplainDeeperBtnRetry" style="margin-top:.5rem;">' +
        '<i class="ph ph-book-open-text"></i> Try automatic explanation' +
      '</button>' +
    '</div>';

  var retryBtn = document.getElementById('seExplainDeeperBtnRetry');
  if (retryBtn && _deeperContext) {
    retryBtn.addEventListener('click', function () {
      _loadDeeperExplanation(_deeperContext.q, _deeperContext.subj, _deeperContext.idx, null);
    });
  }

  // Guard: only speak if the modal is still open
  if (document.getElementById('seExplainModal')) {
    speak(msg);
  }
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
        '<span class="se-explain-wiki-badge se-explain-wiki-badge--local">Extended</span>' +
        '<strong>Extended explanation</strong>' +
      '</div>' +
      '<p class="se-explain-deep-text">' + _escHtml(plain) + '</p>' +
    '</div>';

  // Guard: only speak if the modal is still open
  if (document.getElementById('seExplainModal')) {
    speak('Here is an extended explanation. ' + plain);
  }
}

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

  /* ════════════════════════════════════════════════════════
     EXAM VOICE COMMANDS
     ════════════════════════════════════════════════════════ */

  function _voiceConfirmSubmit() {
    _awaitingSubmitConfirm = true;
    speak(
      'Are you sure you want to submit your exam? This cannot be undone. Say "confirm" to submit, or "cancel" to go back.',
      function () {}
    );
    UI.toast('Say "confirm" to submit or "cancel" to go back.', 'info', 8000);
  }

  function _handleVoiceCommand(transcript, allTranscripts, exam) {
    var t = (transcript || '').toLowerCase().trim();

    if (_awaitingSubmitConfirm) {
      if (/\b(confirm|yes|submit|go ahead|proceed|do it|okay|ok|sure)\b/.test(t)) {
        _awaitingSubmitConfirm = false;
        UI.toast('Submitting your exam…', 'info', 2000);
        speak('Submitting your exam now.', function () {
          if (window.Exam && typeof Exam.submitExam === 'function') {
            Exam.submitExam(true);
          }
        });
        return;
      }
      if (/\b(cancel|no|stop|back|don't|do not|abort)\b/.test(t)) {
        _awaitingSubmitConfirm = false;
        UI.toast('Submission cancelled.', 'info', 2000);
        speak('Okay, submission cancelled. You can continue the exam.');
        return;
      }
      speak('Please say "confirm" to submit or "cancel" to go back.');
      return;
    }

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

    var goMatch = t.match(/\b(?:go to|jump to|question|number|q)\s+(\w+)/i);
    if (goMatch) {
      var num = _extractQuestionNumber(t);
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

    if (exam && exam.subjects) {
      if (/\bnext subject\b/.test(t)) {
        var curIdx = exam.subjects.indexOf(exam.currentSubject);
        if (curIdx < exam.subjects.length - 1) {
          var ns = exam.subjects[curIdx + 1];
          UI.toast('Switching to ' + ns + '…', 'info', 1500);
          if (window.Exam && typeof Exam.switchSubject === 'function') Exam.switchSubject(ns);
        } else {
          UI.toast('You are already on the last subject.', 'info', 2500);
          speak('You are already on the last subject.');
        }
        return;
      }

      if (/\b(switch to|go to|open|subject)\b/.test(t)) {
        var targetSubj = _extractSubject(t, exam.subjects);
        if (targetSubj) {
          UI.toast('Switching to ' + targetSubj + '…', 'info', 1500);
          if (window.Exam && typeof Exam.switchSubject === 'function') Exam.switchSubject(targetSubj);
          return;
        }
      }

      var directSubj = _extractSubject(t, exam.subjects);
      if (directSubj && t.split(/\s+/).length <= 4) {
        UI.toast('Switching to ' + directSubj + '…', 'info', 1500);
        if (window.Exam && typeof Exam.switchSubject === 'function') Exam.switchSubject(directSubj);
        return;
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

    if (/\b(submit( exam| test| now)?|finish( exam| test)?|end exam)\b/.test(t)) {
      _voiceConfirmSubmit();
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

  /* ════════════════════════════════════════════════════════
     RESULTS PAGE VOICE COMMANDS
     ════════════════════════════════════════════════════════ */

  function _handleResultsCommand(transcript, allTranscripts) {
    var t = (transcript || '').toLowerCase().trim();
    var exam   = _resultsExam;

    /* ── Student question / deeper-explanation state ── */
    if (_awaitingStudentQuestion && _deeperContext) {
      /* "no / skip" → dismiss */
      if (/\b(no|nope|skip|close|done|stop|enough|not now|that's fine|that is fine|nothing)\b/.test(t)) {
        _awaitingStudentQuestion = false;
        speak('Alright. You can type a question in the box or tap the fuller explanation button below.');
        return;
      }
      /* "deeper / yes / more" → run auto-query */
      if (/\b(deeper|yes|yeah|sure|ok|okay|more|explain more|further|go ahead|please|want|need|fuller)\b/.test(t)) {
        _awaitingStudentQuestion = false;
        var dc = _deeperContext;
        _loadDeeperExplanation(dc.q, dc.subj, dc.idx, null);
        return;
      }
      /* Anything else is treated as the student's own question */
      _awaitingStudentQuestion = false;
      var studentQ = transcript.trim();
      UI.toast('Searching Wikipedia for: "' + studentQ + '"', 'info', 2500);
      var dc2 = _deeperContext;
      _loadDeeperExplanation(dc2.q, dc2.subj, dc2.idx, studentQ);
      return;
    }

    /* Back-compat: old _awaitingDeeperAnswer (kept for safety) */
    if (_awaitingDeeperAnswer && _deeperContext) {
      if (/\b(yes|yeah|sure|ok|okay|more|deeper|explain more|further|go ahead|please|want|need)\b/.test(t)) {
        _awaitingDeeperAnswer = false;
        var dc3 = _deeperContext;
        _loadDeeperExplanation(dc3.q, dc3.subj, dc3.idx, null);
        return;
      }
      if (/\b(no|nope|skip|close|done|stop|enough|not now|that's fine|that is fine)\b/.test(t)) {
        _awaitingDeeperAnswer = false;
        speak('Alright. You can close this panel or ask me to explain another question.');
        return;
      }
    }

    if (/\b(close|dismiss|exit|hide)\b/.test(t)) {
      var modal = document.getElementById('seExplainModal');
      if (modal) {
        cancel();
        _awaitingStudentQuestion = false;
        _awaitingDeeperAnswer    = false;
        _deeperContext = null;
        modal.classList.remove('is-visible');
        setTimeout(function () { if (modal.parentNode) modal.remove(); }, 280);
        return;
      }
    }

    if (/\b(dashboard|back|home|start over|new exam|go back)\b/.test(t)) {
      cancel();
      _awaitingStudentQuestion = false;
      _awaitingDeeperAnswer    = false;
      if (window.Exam && typeof Exam.renderSubjectSelection === 'function') {
        UI.toast('Going back to dashboard…', 'info', 1500);
        setTimeout(function () { Exam.renderSubjectSelection(); }, 600);
      }
      return;
    }

    if (/\b(whatsapp|share|send|send to whatsapp)\b/.test(t)) {
      if (window.Exam && typeof Exam._shareWhatsApp === 'function') {
        UI.toast('Opening WhatsApp…', 'info', 1500);
        Exam._shareWhatsApp();
      }
      return;
    }

    if (/\b(copy|copy result|clipboard)\b/.test(t)) {
      if (window.Exam && typeof Exam._copyResult === 'function') {
        Exam._copyResult();
      }
      return;
    }

    if (/\b(stop( reading| speaking)?|quiet|silence|shut up)\b/.test(t)) {
      if (_ttsActive) { cancel(); UI.toast('Stopped.', 'info', 1200); }
      return;
    }

    if (/\b(read( result)?|read( my)? score|what( is|'?s) my (score|result|grade))\b/.test(t)) {
      var result = _resultsResult;
      if (!result) return;
      var summary = 'Your overall score is ' + result.percentage + ' percent, Grade ' + result.grade + '. ';
      result.subjects.forEach(function (s) {
        summary += s + ': ' + result.scores[s] + ' percent. ';
      });
      speak(summary);
      return;
    }

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
      var newTtsBtn = ttsBtn.cloneNode(true);
      ttsBtn.parentNode.replaceChild(newTtsBtn, ttsBtn);

      newTtsBtn.addEventListener('click', function () {
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

      newTtsBtn.addEventListener('contextmenu', function (e) {
        e.preventDefault();
        _openVoiceSelector();
      });

      var _lpTimer = null;
      newTtsBtn.addEventListener('touchstart', function () {
        _lpTimer = setTimeout(function () {
          _lpTimer = null;
          _openVoiceSelector();
        }, 600);
      }, { passive: true });
      newTtsBtn.addEventListener('touchend', function () {
        if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
      });
      newTtsBtn.addEventListener('touchmove', function () {
        if (_lpTimer) { clearTimeout(_lpTimer); _lpTimer = null; }
      });
    }

    _injectVoiceSettingsBtn();

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

  function _injectVoiceSettingsBtn() {
    var pill = document.querySelector('#seExamControls');
    if (!pill) return;
    if (document.getElementById('seVoiceSettingsBtn')) return;

    var div = document.createElement('span');
    div.className = 'vtx-speech-div';
    div.style.cssText = 'display:block;width:1px;height:18px;background:var(--border,#e0e0e0);border-radius:1px;flex-shrink:0;margin:0 2px;';

    var btn = document.createElement('button');
    btn.id        = 'seVoiceSettingsBtn';
    btn.className = 'se-tts-btn vtx-speech-btn';
    btn.title     = 'Change TTS voice';
    btn.setAttribute('aria-label', 'Voice settings');
    btn.innerHTML = '<i class="ph ph-sliders" style="font-size:15px;"></i><span class="vtx-speech-label">Voice</span>';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      _openVoiceSelector();
    });

    pill.appendChild(div);
    pill.appendChild(btn);
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
    speak:               speak,
    cancel:              cancel,
    startSTT:            startSTT,
    stopSTT:             stopSTT,
    wireExamButtons:     wireExamButtons,
    wireResultsButtons:  wireResultsButtons,
    setResultsContext:   setResultsContext,
    showExplanationModal: _showExplanationModal,
    openVoiceSelector:   _openVoiceSelector,
    ttsSupported:        ttsSupported,
    sttSupported:        sttSupported,
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
