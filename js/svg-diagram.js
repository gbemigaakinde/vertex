/* ============================================================
   js/svg-diagram.js — Safe inline SVG diagrams for questions

   Question data may optionally carry diagrams (all fields optional,
   existing questions keep working unchanged):

     svg     : diagram(s) shown under the question text
     optSvg  : array aligned with opts — optSvg[i] is shown inside option i
     expSvg  : diagram(s) shown under the explanation

   A "diagram" value can be:
     - an SVG markup string               '<svg viewBox="0 0 200 100">…</svg>'
     - an object                          { svg: '…', alt: 'text', caption: 'text' }
     - an array of any of the above       (several diagrams in one block)

   Every SVG is parsed and REBUILT from an allow-list (no scripts, no
   event handlers, no external references, no foreignObject, no CSS
   classes). Anything malformed or unsafe is dropped or replaced by a
   small "Diagram unavailable" note — it never breaks the question.

   Public API:
     SvgDiagram.html(value, { size: 'question' | 'option' | 'explanation' })
         → HTML string ('' when there is nothing to show)
     SvgDiagram.sanitize(svgString)
         → { ok: true, svg, viewBox, width } | { ok: false, reason }
   ============================================================ */
(function () {
  'use strict';

  var SVG_NS        = 'http://www.w3.org/2000/svg';
  var MAX_CHARS     = 60000;   // per diagram
  var MAX_ELEMENTS  = 2500;    // per diagram
  var MAX_DEPTH     = 40;
  var MAX_PER_BLOCK = 6;       // diagrams per question / option / explanation
  var DEFAULT_MAX_W = 420;     // px, when the SVG declares no width
  var MIN_MAX_W     = 160;
  var MAX_MAX_W     = 560;

  var _counter = 0;

  /* ── Allow-lists ─────────────────────────────────────────── */
  var ELEMENTS = {};
  ('svg g defs title desc path circle ellipse line polyline polygon rect text tspan textPath ' +
   'marker clipPath mask linearGradient radialGradient stop pattern symbol use')
    .split(' ').forEach(function (n) { ELEMENTS[n.toLowerCase()] = n; });

  var ATTRS = {};
  ('id x y x1 x2 y1 y2 cx cy r rx ry fx fy width height d points transform ' +
   'fill fill-opacity fill-rule stroke stroke-width stroke-linecap stroke-linejoin ' +
   'stroke-dasharray stroke-dashoffset stroke-opacity stroke-miterlimit opacity ' +
   'font-size font-family font-weight font-style text-anchor dominant-baseline ' +
   'alignment-baseline letter-spacing text-decoration dx dy rotate textLength lengthAdjust ' +
   'viewBox preserveAspectRatio markerWidth markerHeight markerUnits refX refY orient ' +
   'marker-start marker-mid marker-end clip-path mask clipPathUnits maskUnits ' +
   'maskContentUnits gradientUnits gradientTransform offset stop-color stop-opacity ' +
   'patternUnits patternTransform patternContentUnits style href xlink:href visibility ' +
   'display vector-effect text-rendering shape-rendering color startOffset')
    .split(' ').forEach(function (n) { ATTRS[n.toLowerCase()] = n; });

  var STYLE_PROPS = {};
  ('fill stroke stroke-width opacity fill-opacity stroke-opacity stroke-dasharray stroke-linecap ' +
   'stroke-linejoin font-size font-family font-weight font-style text-anchor dominant-baseline ' +
   'stop-color stop-opacity visibility display color letter-spacing text-decoration')
    .split(' ').forEach(function (n) { STYLE_PROPS[n] = true; });

  /* ── Helpers ─────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function parseNum(v) {
    if (v == null) return null;
    var m = /^\s*(\d+(?:\.\d+)?)\s*(px)?\s*$/i.exec(String(v));
    return m ? parseFloat(m[1]) : null;
  }

  // Every url(...) must be a local reference: url(#id). Returns rewritten value or null.
  function rewriteUrls(value, prefix) {
    var ok = true;
    var out = value.replace(/url\(\s*([^)]*?)\s*\)/gi, function (_, inner) {
      var m = /^['"]?#([\w\-:.]+)['"]?$/.exec(inner);
      if (!m) { ok = false; return ''; }
      return 'url(#' + prefix + m[1] + ')';
    });
    return ok ? out : null;
  }

  function isDangerous(v) {
    return /javascript:|vbscript:|data:|expression\s*\(|@import|behavior\s*:|-moz-binding|\\/i.test(v);
  }

  function cleanStyle(value, prefix) {
    var kept = [];
    String(value).split(';').forEach(function (decl) {
      var i = decl.indexOf(':');
      if (i < 1) return;
      var prop = decl.slice(0, i).trim().toLowerCase();
      var val  = decl.slice(i + 1).trim();
      if (!STYLE_PROPS[prop] || !val || isDangerous(val)) return;
      var rewritten = rewriteUrls(val, prefix);
      if (rewritten === null) return;
      kept.push(prop + ':' + rewritten);
    });
    return kept.join(';');
  }

  function cleanAttr(canonName, rawValue, prefix) {
    var v = String(rawValue);
    var lower = canonName.toLowerCase();
    if (lower === 'id')   return /^[\w\-:.]+$/.test(v) ? prefix + v : null;
    if (lower === 'href' || lower === 'xlink:href') {
      return /^#[\w\-:.]+$/.test(v) ? '#' + prefix + v.slice(1) : null;
    }
    if (lower === 'style') {
      var s = cleanStyle(v, prefix);
      return s ? s : null;
    }
    if (isDangerous(v) || /[<>]/.test(v)) return null;
    if (/url\(/i.test(v)) return rewriteUrls(v, prefix);
    return v;
  }

  /* ── Sanitizer ───────────────────────────────────────────── */
  function sanitize(input) {
    if (typeof input !== 'string') return { ok: false, reason: 'not a string' };
    var src = input.replace(/^[﻿\s]+/, '').replace(/\s+$/, '');
    if (!src)                       return { ok: false, reason: 'empty' };
    if (src.length > MAX_CHARS)     return { ok: false, reason: 'too large' };
    if (!/<svg[\s>\/]/i.test(src))  return { ok: false, reason: 'no <svg> element' };
    if (/<!DOCTYPE|<!ENTITY/i.test(src)) return { ok: false, reason: 'DOCTYPE/ENTITY not allowed' };

    // XML parsing needs the namespaces declared; add them if the author left them out.
    if (!/<svg[^>]*\sxmlns\s*=/i.test(src)) {
      src = src.replace(/<svg/i, '<svg xmlns="' + SVG_NS + '"');
    }
    if (/xlink:/i.test(src) && !/xmlns:xlink\s*=/i.test(src)) {
      src = src.replace(/<svg/i, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    var doc;
    try { doc = new DOMParser().parseFromString(src, 'image/svg+xml'); }
    catch (e) { return { ok: false, reason: 'parse error' }; }
    if (!doc || !doc.documentElement || doc.getElementsByTagName('parsererror').length) {
      return { ok: false, reason: 'malformed SVG' };
    }
    var root = doc.documentElement;
    if (root.localName !== 'svg' || root.namespaceURI !== SVG_NS) {
      return { ok: false, reason: 'root is not <svg>' };
    }

    // Size: need a viewBox, or numeric width + height, so it can scale.
    var vb = null;
    var vbAttr = root.getAttribute('viewBox');
    if (vbAttr) {
      var parts = vbAttr.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts.every(isFinite) && parts[2] > 0 && parts[3] > 0) vb = parts;
    }
    var declW = parseNum(root.getAttribute('width'));
    var declH = parseNum(root.getAttribute('height'));
    if (!vb && declW && declH) vb = [0, 0, declW, declH];
    if (!vb) return { ok: false, reason: 'needs a viewBox (or numeric width and height)' };

    var prefix   = 'vsd' + (++_counter) + '-';
    var count    = 0;
    var tooBig   = false;
    var titleTxt = '';

    function build(el, depth, isRoot) {
      if (tooBig) return '';
      if (el.nodeType === 3 || el.nodeType === 4) return esc(el.nodeValue);   // text / CDATA
      if (el.nodeType !== 1) return '';
      if (el.namespaceURI !== SVG_NS) return '';
      var canon = ELEMENTS[el.localName.toLowerCase()];
      if (!canon) return '';                                                  // drops element + children
      if (++count > MAX_ELEMENTS || depth > MAX_DEPTH) { tooBig = true; return ''; }

      var attrs = '';
      if (isRoot) {
        attrs += ' viewBox="' + vb.join(' ') + '" preserveAspectRatio="xMidYMid meet"';
      } else {
        for (var i = 0; i < el.attributes.length; i++) {
          var a = el.attributes[i];
          if (a.namespaceURI && a.namespaceURI !== 'http://www.w3.org/1999/xlink') continue; // skips xmlns etc.
          var key = (a.prefix ? a.prefix + ':' : '') + a.localName;
          var canonAttr = ATTRS[key.toLowerCase()];
          if (!canonAttr) continue;                                           // also drops on*, class, etc.
          var val = cleanAttr(canonAttr, a.value, prefix);
          if (val == null) continue;
          attrs += ' ' + canonAttr + '="' + esc(val) + '"';
        }
      }
      if (isRoot) {
        // keep a few safe presentation attributes on the root as well
        ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'color'].forEach(function (n) {
          if (!root.hasAttribute(n)) return;
          var v = cleanAttr(n, root.getAttribute(n), prefix);
          if (v != null) attrs += ' ' + n + '="' + esc(v) + '"';
        });
      }

      var inner = '';
      for (var c = el.firstChild; c; c = c.nextSibling) inner += build(c, depth + 1, false);

      if (canon === 'title' && !titleTxt) titleTxt = (el.textContent || '').trim().slice(0, 200);
      return '<' + canon + attrs + '>' + inner + '</' + canon + '>';
    }

    var body = build(root, 0, true);
    if (tooBig)  return { ok: false, reason: 'too complex' };
    if (!body)   return { ok: false, reason: 'empty after cleaning' };

    return { ok: true, markup: body, viewBox: vb, width: declW, title: titleTxt };
  }

  /* ── Rendering ───────────────────────────────────────────── */
  function toItems(value) {
    if (value == null || value === '') return [];
    var list = Array.isArray(value) ? value : [value];
    var items = [];
    list.forEach(function (v) {
      if (typeof v === 'string')                       items.push({ svg: v });
      else if (v && typeof v === 'object' && typeof v.svg === 'string') items.push(v);
    });
    return items;
  }

  function renderOne(item, size) {
    var res = sanitize(item.svg);
    if (!res.ok) {
      try { console.warn('[SvgDiagram] diagram skipped:', res.reason); } catch (e) {}
      return '<figure class="vtx-diagram vtx-diagram--fallback" role="note">Diagram unavailable</figure>';
    }
    var label = (item.alt || res.title || 'Diagram');
    // put role / aria-label on the root <svg>
    var svg = res.markup.replace(/^<svg/, '<svg class="vtx-svg" role="img" focusable="false" aria-label="' + esc(label) + '"');
    var maxW = res.width ? Math.min(MAX_MAX_W, Math.max(MIN_MAX_W, res.width)) : DEFAULT_MAX_W;
    return '<figure class="vtx-diagram vtx-diagram--' + size + '" style="--vtx-dw:' + maxW + 'px">' +
             '<div class="vtx-diagram__frame">' + svg + '</div>' +
             (item.caption ? '<figcaption>' + esc(item.caption) + '</figcaption>' : '') +
           '</figure>';
  }

  function html(value, opts) {
    var size = (opts && opts.size) || 'question';
    var items = toItems(value);
    if (!items.length) return '';
    if (items.length > MAX_PER_BLOCK) {
      try { console.warn('[SvgDiagram] only the first ' + MAX_PER_BLOCK + ' diagrams are shown'); } catch (e) {}
      items = items.slice(0, MAX_PER_BLOCK);
    }
    return items.map(function (it) { return renderOne(it, size); }).join('');
  }

  // Convenience: diagram for option i of question q
  function optionHtml(q, i) {
    if (!q || !Array.isArray(q.optSvg)) return '';
    return html(q.optSvg[i], { size: 'option' });
  }

  /* ── Styles (injected once, so no CSS file edit is needed) ── */
  function injectStyles() {
    if (document.getElementById('vtx-svg-diagram-css')) return;
    var st = document.createElement('style');
    st.id = 'vtx-svg-diagram-css';
    st.textContent =
      '.vtx-diagram{display:block;margin:.75rem 0;padding:0;max-width:100%;min-width:0;}' +
      '.vtx-diagram__frame{box-sizing:border-box;width:100%;max-width:var(--vtx-dw,420px);margin:0 auto;' +
        'padding:.5rem;background:#fff;color:#111;border:1px solid rgba(128,128,128,.35);' +
        'border-radius:10px;overflow:hidden;line-height:0;}' +
      '.vtx-diagram .vtx-svg{display:block;width:100%;height:auto;max-width:100%;max-height:min(60vh,420px);}' +
      '.vtx-diagram--option{margin:.5rem 0 0;}' +
      '.vtx-diagram--option .vtx-diagram__frame{max-width:min(var(--vtx-dw,420px),260px);margin:0;}' +
      '.vtx-diagram--explanation{margin:.5rem 0 0;}' +
      '.vtx-diagram--explanation .vtx-diagram__frame{max-width:min(var(--vtx-dw,420px),360px);}' +
      '.vtx-diagram figcaption{font-size:.75rem;line-height:1.4;text-align:center;opacity:.75;margin-top:.25rem;}' +
      '.vtx-diagram--fallback{font-size:.75rem;font-style:italic;opacity:.7;}';
    (document.head || document.documentElement).appendChild(st);
  }
  injectStyles();

  window.SvgDiagram = { html: html, optionHtml: optionHtml, sanitize: sanitize };
})();
