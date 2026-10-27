/* ============================================================
   js/studyroom-md.js — Markdown renderer for Study Room lessons
   ============================================================
   Replaces the old regex-only renderer in studyroom.js.

   window.VtxMarkdown.render(md)  ->  { html, headings, words }

   Supported:
   - Headings (#..######) with stable ids, horizontal rules
   - Paragraphs, hard line breaks, **bold**, *italic*, ~~strike~~,
     `code`, [links](url), ![images](url), <https://autolinks>
   - Nested bullet / numbered lists (any depth), task lists
   - Block quotes (multi-line, nested) and callouts:
       > **Note:** ...   > **Tip:** ...   > **Warning:** ...
   - Fenced code blocks (``` or ~~~)
   - Tables (with column alignment), wrapped so they scroll sideways
   - Raw HTML blocks (section, figure, svg, details, aside, div, ...)
     used by existing lessons (quizzes, diagrams) pass through
   - LaTeX math ($...$ and $$...$$) is protected from Markdown and
     left for KaTeX auto-render

   Output is passed through a DOM sanitiser (no scripts, no on*
   handlers, no javascript: URLs).
   ============================================================ */
(function () {
  'use strict';

  var BLOCK_HTML_TAGS = ['section', 'figure', 'details', 'aside', 'div', 'svg',
                         'style', 'table', 'iframe-blocked', 'center', 'video', 'audio'];

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function slugify(text) {
    var s = String(text).toLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim().replace(/\s+/g, '-');
    return s || 'section';
  }

  /* ── Placeholders (private-use chars never appear in lessons) ── */
  var PH_OPEN = '\uE000', PH_CLOSE = '\uE001';
  function ph(kind, n) { return PH_OPEN + kind + n + PH_CLOSE; }
  var PH_RE = new RegExp(PH_OPEN + '([A-Z])(\\d+)' + PH_CLOSE, 'g');

  function render(md) {
    var stash = { H: [], M: [], C: [] };
    var headings = [];
    var usedIds = {};

    function put(kind, val) { stash[kind].push(val); return ph(kind, stash[kind].length - 1); }

    function restore(s) {
      var guard = 0, prev;
      do {
        prev = s;
        s = s.replace(PH_RE, function (_, kind, n) {
          var v = stash[kind][+n];
          if (v == null) return '';
          return v;
        });
        guard++;
      } while (s !== prev && guard < 4);
      return s;
    }

    var src = String(md == null ? '' : md).replace(/\r\n?/g, '\n').replace(/\t/g, '    ');

    /* 1 ── stash fenced code first so nothing inside is touched ── */
    src = src.replace(/^([ ]{0,3})(```|~~~)[ \t]*([\w+-]*)[^\n]*\n([\s\S]*?)(?:\n[ ]{0,3}\2[ \t]*(?=\n|$)|(?![\s\S]))/gm,
      function (_, indent, fence, lang, code) {
        var html = '<pre class="sr-code"' + (lang ? ' data-lang="' + escHtml(lang) + '"' : '') +
                   '><code>' + escHtml(code.replace(/\n$/, '')) + '</code></pre>';
        return '\n' + put('H', html) + '\n';
      });

    /* 2 ── stash raw HTML blocks (depth-aware) ── */
    src = stashHtmlBlocks(src, function (html) { return put('H', html); });

    /* 3 ── stash math ── */
    src = src.replace(/\$\$([\s\S]+?)\$\$/g, function (m) { return put('M', escHtml(m)); });
    src = src.replace(/\$(?=[^\s$])([^$\n]*?[^\s$\\]|[^\s$\\])\$(?!\d)/g, function (m) { return put('M', escHtml(m)); });

    /* 4 ── blocks ── */
    var html = renderBlocks(src.split('\n'), true);

    /* 5 ── restore stashed pieces, sanitise ── */
    html = restore(html);
    html = sanitize(html).replace(/<p>\s*<\/p>\n?/g, '');

    var words = 0;
    try {
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      words = (tmp.textContent || '').trim().split(/\s+/).filter(Boolean).length;
    } catch (e) { /* ignore */ }

    return { html: html, headings: headings, words: words };

    /* ───────────────────────── helpers (closures) ───────────────────────── */

    function uniqueId(text) {
      var base = slugify(text), id = base, i = 2;
      while (usedIds[id]) { id = base + '-' + i++; }
      usedIds[id] = true;
      return id;
    }

    function renderBlocks(lines, collectHeadings) {
      var out = [];
      var i = 0;
      var para = [];

      function flushPara() {
        if (!para.length) return;
        var text = para.join('\n');
        out.push('<p>' + inline(text) + '</p>');
        para = [];
      }

      function isBlank(l) { return /^\s*$/.test(l); }
      function isHr(l) { return /^ {0,3}([-*_])( *\1){2,} *$/.test(l); }
      function isFenceHolder(l) { return new RegExp('^\\s*' + PH_OPEN + 'H\\d+' + PH_CLOSE + '\\s*$').test(l); }
      function listMatch(l) { return l.match(/^( *)([-*+]|\d{1,9}[.)])[ ]+(.*)$/); }
      function isTableSep(l) {
        return l != null && /^ *\|? *:?-{1,}:? *(\| *:?-{1,}:? *)*\|? *$/.test(l) && l.indexOf('-') !== -1 && /\|/.test(l);
      }
      function startsBlock(l, next) {
        return isHr(l) || /^ {0,3}#{1,6}[ \t]+\S/.test(l) || /^ {0,3}>/.test(l) ||
               !!listMatch(l) || isFenceHolder(l) || (l.indexOf('|') !== -1 && isTableSep(next));
      }

      while (i < lines.length) {
        var line = lines[i];

        if (isBlank(line)) { flushPara(); i++; continue; }

        if (isFenceHolder(line)) { flushPara(); out.push(line.trim()); i++; continue; }

        var hm = line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/);
        if (hm) {
          flushPara();
          var level = hm[1].length;
          var inner = inline(hm[2]);
          if (collectHeadings) {
            var plain = restore(hm[2]).replace(/<[^>]*>/g, '').replace(/[*_`~]/g, '').trim();
            var id = uniqueId(plain);
            headings.push({ id: id, text: plain, level: level });
            out.push('<h' + level + ' id="' + id + '">' + inner + '</h' + level + '>');
          } else {
            out.push('<h' + level + '>' + inner + '</h' + level + '>');
          }
          i++; continue;
        }

        if (isHr(line)) { flushPara(); out.push('<hr>'); i++; continue; }

        if (/^ {0,3}>/.test(line)) {
          flushPara();
          var q = [];
          while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
            q.push(lines[i].replace(/^ {0,3}> ?/, ''));
            i++;
          }
          out.push(renderQuote(q));
          continue;
        }

        if (line.indexOf('|') !== -1 && isTableSep(lines[i + 1])) {
          flushPara();
          var rows = [line, lines[i + 1]];
          i += 2;
          while (i < lines.length && !isBlank(lines[i]) && lines[i].indexOf('|') !== -1) { rows.push(lines[i]); i++; }
          out.push(renderTable(rows));
          continue;
        }

        var lm = listMatch(line);
        if (lm) {
          flushPara();
          var res = renderList(lines, i);
          out.push(res.html);
          i = res.next;
          continue;
        }

        para.push(line.replace(/^\s+/, ''));
        i++;

        /* paragraph continues until blank line or another block starts */
        while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i], lines[i + 1])) {
          para.push(lines[i].replace(/^\s+/, ''));
          i++;
        }
        flushPara();
      }
      flushPara();
      return out.join('\n');
    }

    function renderQuote(qLines) {
      /* GitHub style: > [!NOTE] */
      var kind = null;
      var gh = qLines[0] && qLines[0].match(/^\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION|EXAMPLE)\]\s*$/i);
      if (gh) { kind = gh[1].toLowerCase(); qLines = qLines.slice(1); }

      var inner = renderBlocks(qLines, false);

      if (!kind) {
        var m = inner.match(/^<p><strong>(note|tip|hint|warning|caution|important|remember|example|definition|key point|key points|did you know|activity|exercise)\s*[:.!]?\s*<\/strong>/i);
        if (m) kind = m[1].toLowerCase();
      }
      if (kind) {
        var tone = 'info';
        if (/^(tip|hint)/.test(kind)) tone = 'tip';
        else if (/^(warning|caution|important)/.test(kind)) tone = 'warn';
        else if (/^(example|activity|exercise)/.test(kind)) tone = 'example';
        var label = kind.charAt(0).toUpperCase() + kind.slice(1);
        if (gh) inner = '<p class="sr-callout__label">' + escHtml(label) + '</p>' + inner;
        return '<aside class="sr-callout sr-callout--' + tone + '" role="note">' + inner + '</aside>';
      }
      return '<blockquote>' + inner + '</blockquote>';
    }

    function splitRow(row) {
      var r = row.trim();
      if (r.charAt(0) === '|') r = r.slice(1);
      if (r.charAt(r.length - 1) === '|' && r.charAt(r.length - 2) !== '\\') r = r.slice(0, -1);
      return r.replace(/\\\|/g, '\uE002').split('|').map(function (c) { return c.trim().replace(/\uE002/g, '|'); });
    }

    function renderTable(rows) {
      var head = splitRow(rows[0]);
      var aligns = splitRow(rows[1]).map(function (c) {
        var l = c.charAt(0) === ':', r = c.charAt(c.length - 1) === ':';
        return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
      });
      function cell(tag, txt, idx) {
        var a = aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : '';
        return '<' + tag + a + '>' + inline(txt) + '</' + tag + '>';
      }
      var h = '<thead><tr>' + head.map(function (c, k) { return cell('th', c, k); }).join('') + '</tr></thead>';
      var b = '<tbody>' + rows.slice(2).map(function (r) {
        var cells = splitRow(r);
        return '<tr>' + cells.map(function (c, k) { return cell('td', c, k); }).join('') + '</tr>';
      }).join('') + '</tbody>';
      return '<div class="sr-table-wrap" tabindex="0"><table>' + h + b + '</table></div>';
    }

    function renderList(lines, start) {
      var first = lines[start].match(/^( *)([-*+]|\d{1,9}[.)])[ ]+(.*)$/);
      var baseIndent = first[1].length;
      var ordered = /\d/.test(first[2]);
      var startNum = ordered ? parseInt(first[2], 10) : 1;
      var items = [];
      var i = start;

      while (i < lines.length) {
        var m = lines[i].match(/^( *)([-*+]|\d{1,9}[.)])[ ]+(.*)$/);
        if (!m || m[1].length !== baseIndent && m[1].length < baseIndent) break;
        if (m[1].length > baseIndent) break;           // belongs to the previous item
        if ((/\d/.test(m[2])) !== ordered) break;      // list type changed
        var contentIndent = m[1].length + m[2].length + 1;
        var itemLines = [m[3]];
        i++;
        while (i < lines.length) {
          var l = lines[i];
          if (/^\s*$/.test(l)) {
            /* blank line: continues the item only if next non-blank line is indented */
            var j = i + 1;
            while (j < lines.length && /^\s*$/.test(lines[j])) j++;
            if (j < lines.length && leadingSpaces(lines[j]) >= contentIndent) {
              for (var k = i; k < j; k++) itemLines.push('');
              i = j; continue;
            }
            break;
          }
          var ind = leadingSpaces(l);
          if (ind > baseIndent) {
            itemLines.push(l.slice(Math.min(ind, contentIndent)));
            i++; continue;
          }
          if (ind <= baseIndent && listMatchAt(l)) break;
          if (ind <= baseIndent) {
            /* lazy continuation of a paragraph line */
            if (!/^ {0,3}(#{1,6}[ \t]|>|([-*_])( *\2){2,} *$)/.test(l) && !new RegExp('^\\s*' + PH_OPEN).test(l)) {
              itemLines.push(l.replace(/^\s+/, '')); i++; continue;
            }
          }
          break;
        }
        items.push(itemLines);
        /* skip blank lines between items of the same list */
        var peek = i;
        while (peek < lines.length && /^\s*$/.test(lines[peek])) peek++;
        if (peek < lines.length && peek > i) {
          var pm = lines[peek].match(/^( *)([-*+]|\d{1,9}[.)])[ ]+/);
          if (pm && pm[1].length === baseIndent && (/\d/.test(pm[2])) === ordered) i = peek;
        }
      }

      var tag = ordered ? 'ol' : 'ul';
      var body = items.map(function (itemLines) {
        var task = null;
        var firstLine = itemLines[0];
        var tm = firstLine.match(/^\[( |x|X)\][ ]+(.*)$/);
        if (tm) { task = tm[1] !== ' '; itemLines = [tm[2]].concat(itemLines.slice(1)); }
        var inner = renderBlocks(itemLines, false);
        /* tight list: unwrap a lone paragraph */
        var single = inner.match(/^<p>([\s\S]*)<\/p>$/);
        if (single && single[1].indexOf('<p>') === -1) {
          inner = single[1];
        } else {
          var lead = inner.match(/^<p>([\s\S]*?)<\/p>\n(<(?:ul|ol)[\s\S]*)$/);
          if (lead && lead[1].indexOf('<p>') === -1 && lead[2].indexOf('\n<p>') === -1) inner = lead[1] + lead[2];
        }
        var box = task === null ? '' :
          '<input type="checkbox" class="sr-task" disabled' + (task ? ' checked' : '') + ' aria-hidden="true"> ';
        return '<li' + (task === null ? '' : ' class="sr-task-item"') + '>' + box + inner + '</li>';
      }).join('');

      return {
        html: '<' + tag + (ordered && startNum !== 1 ? ' start="' + startNum + '"' : '') + '>' + body + '</' + tag + '>',
        next: i
      };
    }

    function leadingSpaces(l) { return l.match(/^ */)[0].length; }
    function listMatchAt(l) { return /^ *([-*+]|\d{1,9}[.)])[ ]+/.test(l); }

    /* ── inline ── */
    function inline(text) {
      if (!text) return '';
      var s = text;

      /* code spans */
      s = s.replace(/(`+)([\s\S]*?[^`])\1(?!`)/g, function (_, ticks, code) {
        return put('C', '<code>' + escHtml(code.trim()) + '</code>');
      });

      /* images then links */
      s = s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"([^"]*)")?\s*\)/g, function (_, alt, url, title) {
        return put('C', '<img src="' + escHtml(url) + '" alt="' + escHtml(alt) + '"' +
                        (title ? ' title="' + escHtml(title) + '"' : '') + ' loading="lazy" decoding="async">');
      });
      s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g, function (_, label, url) {
        return put('C', '<a href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">' + emphasis(label) + '</a>');
      });
      s = s.replace(/<(https?:\/\/[^\s>]+)>/g, function (_, url) {
        return put('C', '<a href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escHtml(url) + '</a>');
      });

      s = emphasis(s);

      /* hard breaks */
      s = s.replace(/(?: {2,}|\\)\n/g, '<br>\n');
      return s;
    }

    function emphasis(s) {
      return s
        .replace(/\*\*\*(?=\S)([\s\S]+?)(?!\s)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(?=\S)([\s\S]+?)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^\w])__(?=\S)([\s\S]+?)__(?![\w])/g, '$1<strong>$2</strong>')
        .replace(/\*(?=[^\s*])([\s\S]+?)\*/g, '<em>$1</em>')
        .replace(/(^|[^\w])_(?=[^\s_])([\s\S]+?)_(?![\w])/g, '$1<em>$2</em>')
        .replace(/~~(?=\S)([\s\S]+?)~~/g, '<del>$1</del>');
    }
  }

  /* ── Depth-aware raw HTML block extraction ── */
  function stashHtmlBlocks(src, put) {
    var lines = src.split('\n');
    var out = [];
    var i = 0;
    var openRe = new RegExp('^\\s*<(' + BLOCK_HTML_TAGS.join('|') + ')\\b', 'i');
    while (i < lines.length) {
      var m = lines[i].match(openRe);
      if (!m) { out.push(lines[i]); i++; continue; }
      var tag = m[1].toLowerCase();
      var depth = 0;
      var buf = [];
      var j = i;
      var openTag = new RegExp('<' + tag + '\\b', 'gi');
      var closeTag = new RegExp('</' + tag + '\\s*>', 'gi');
      var closed = false;
      while (j < lines.length) {
        var l = lines[j];
        buf.push(l);
        depth += (l.match(openTag) || []).length;
        depth -= (l.match(closeTag) || []).length;
        /* self-closing single line like <svg .../> */
        if (depth <= 0) { closed = true; break; }
        j++;
      }
      if (!closed) { out.push(lines[i]); i++; continue; }   // unbalanced: treat as text
      out.push('');
      out.push(put(buf.join('\n')));
      out.push('');
      i = j + 1;
    }
    return out.join('\n');
  }

  /* ── DOM sanitiser ── */
  var DROP_TAGS = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base',
                   'form', 'frame', 'frameset', 'applet', 'foreignobject', 'noscript'];
  var URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction', 'poster', 'data'];

  function safeUrl(v, tag) {
    var s = String(v || '').replace(/[\u0000-\u0020\u00a0]+/g, '').toLowerCase();
    if (/^(javascript|vbscript):/.test(s)) return false;
    if (/^data:/.test(s)) return tag === 'img' && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/.test(s) ? true : false;
    return true;
  }

  function sanitize(html) {
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    var walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_ELEMENT, null);
    var drop = [];
    var n = walker.nextNode();
    while (n) {
      var tag = n.nodeName.toLowerCase();
      if (DROP_TAGS.indexOf(tag) !== -1) { drop.push(n); n = walker.nextNode(); continue; }
      var attrs = Array.prototype.slice.call(n.attributes);
      attrs.forEach(function (a) {
        var name = a.name.toLowerCase();
        if (name.indexOf('on') === 0 || name === 'srcdoc') { n.removeAttribute(a.name); return; }
        if (URL_ATTRS.indexOf(name) !== -1 && !safeUrl(a.value, tag)) n.removeAttribute(a.name);
        if (name === 'style' && /expression\s*\(|javascript:|url\s*\(\s*['"]?\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
      });
      if (tag === 'a' && n.getAttribute('href') && /^https?:/i.test(n.getAttribute('href'))) {
        n.setAttribute('target', '_blank');
        n.setAttribute('rel', 'noopener noreferrer');
      }
      if (tag === 'img') {
        if (!n.hasAttribute('loading')) n.setAttribute('loading', 'lazy');
        if (!n.hasAttribute('decoding')) n.setAttribute('decoding', 'async');
      }
      n = walker.nextNode();
    }
    drop.forEach(function (d) { if (d.parentNode) d.parentNode.removeChild(d); });
    return tpl.innerHTML;
  }

  window.VtxMarkdown = { render: render, sanitize: sanitize };
}());
