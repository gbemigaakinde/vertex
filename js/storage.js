/* ============================================================
   js/storage.js — Vertex File Storage (Backblaze B2)
   ============================================================
   Architecture:
   1. Client asks Worker for a presigned PUT URL (Worker signs
      it with B2 credentials — keys never reach the browser).
   2. Client uploads the file directly to B2 via that URL.
   3. Client tells Worker to store metadata in Firestore.
   4. Downloads use a presigned GET URL from the Worker.
   ============================================================ */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────── */
  const WORKER_URL    = 'https://vertex-worker.gbemigaakinde.workers.dev';
  const MAX_FILE_MB   = 20;
  const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

  const ALLOWED_TYPES = {
    'application/pdf':                          'pdf',
    'application/msword':                       'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel':                 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint':            'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain':                               'txt',
    'image/jpeg':                               'jpg',
    'image/png':                                'png',
    'image/gif':                                'gif',
    'image/webp':                               'webp',
  };

  const FILE_ICONS = {
    pdf:  '📄',
    doc:  '📝', docx: '📝',
    xls:  '📊', xlsx: '📊',
    ppt:  '📋', pptx: '📋',
    txt:  '📃',
    jpg:  '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
    default: '📁',
  };

  /* ── Helpers ───────────────────────────────────────────── */
  function _esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _fmtBytes(bytes) {
    if (bytes < 1024)       return bytes + ' B';
    if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function _fmtDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  }

  function _fileIcon(ext) {
    return FILE_ICONS[ext] || FILE_ICONS.default;
  }

  function _ext(filename) {
    return (filename || '').split('.').pop().toLowerCase();
  }

  function _safeKey(uid, filename) {
    const ts   = Date.now();
    const safe = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    return 'uploads/' + uid + '/' + ts + '_' + safe;
  }

  /* ── CORE: get presigned upload URL from Worker ────────── */
  async function _getPresignedPutUrl(objectKey, contentType) {
    const res = await fetch(WORKER_URL + '/storage/presign-upload', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ objectKey, contentType }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to get upload permission.');
    }
    const data = await res.json();
    return data.url; // presigned PUT URL valid for 5 minutes
  }

  /* ── CORE: get presigned download URL from Worker ──────── */
  async function _getPresignedGetUrl(objectKey) {
    const res = await fetch(WORKER_URL + '/storage/presign-download', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ objectKey }),
    });
    if (!res.ok) throw new Error('Failed to get download link.');
    const data = await res.json();
    return data.url; // presigned GET URL valid for 1 hour
  }

  /* ── CORE: delete file from B2 via Worker ──────────────── */
  async function _deleteFromB2(objectKey) {
    const res = await fetch(WORKER_URL + '/storage/delete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ objectKey }),
    });
    if (!res.ok) throw new Error('Failed to delete file from storage.');
  }

  /* ── CORE: save metadata to Firestore ──────────────────── */
  async function _saveMetadata(meta) {
    await window.fbDb.collection('uploads').add({
      ...meta,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  /* ── CORE: upload pipeline ─────────────────────────────── */
  async function uploadFile(file, opts, onProgress) {
    /*
      opts = {
        uploaderUid:   string,
        uploaderName:  string,
        uploaderRole:  'student' | 'teacher',
        uploaderClass: string,         (students only)
        context:       string,         e.g. 'studyroom' | 'dashboard' | 'teacher'
        description:   string,         optional caption
        sharedWith:    'class' | 'all' | 'private',
      }
    */
    if (!file) throw new Error('No file selected.');

    if (file.size > MAX_FILE_BYTES) {
      throw new Error('File is too large. Maximum size is ' + MAX_FILE_MB + ' MB.');
    }

    const ext = _ext(file.name);
    if (!ALLOWED_TYPES[file.type] && !Object.values(ALLOWED_TYPES).includes(ext)) {
      throw new Error('File type not allowed. Supported: PDF, Word, Excel, images, and text files.');
    }

    const objectKey   = _safeKey(opts.uploaderUid, file.name);
    const contentType = file.type || 'application/octet-stream';

    // 1. Get presigned URL
    if (onProgress) onProgress(10, 'Getting upload permission…');
    const putUrl = await _getPresignedPutUrl(objectKey, contentType);

    // 2. Upload directly to B2
    if (onProgress) onProgress(20, 'Uploading file…');
    await new Promise(function (resolve, reject) {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', putUrl);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = function (e) {
        if (e.lengthComputable && onProgress) {
          const pct = Math.round(20 + (e.loaded / e.total) * 65);
          onProgress(pct, 'Uploading… ' + Math.round((e.loaded / e.total) * 100) + '%');
        }
      };
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error('Upload failed: HTTP ' + xhr.status));
      };
      xhr.onerror = function () { reject(new Error('Network error during upload.')); };
      xhr.send(file);
    });

    // 3. Save metadata
    if (onProgress) onProgress(90, 'Saving file record…');
    const meta = {
      objectKey,
      fileName:      file.name,
      fileSize:      file.size,
      fileType:      contentType,
      fileExt:       ext,
      uploaderUid:   opts.uploaderUid,
      uploaderName:  opts.uploaderName,
      uploaderRole:  opts.uploaderRole  || 'student',
      uploaderClass: opts.uploaderClass || '',
      context:       opts.context       || 'general',
      description:   opts.description   || '',
      sharedWith:    opts.sharedWith    || 'private',
    };
    await _saveMetadata(meta);

    if (onProgress) onProgress(100, 'Done!');
    return { objectKey, fileName: file.name, fileSize: file.size };
  }

  /* ── CORE: open file (download via presigned URL) ──────── */
  async function openFile(objectKey, fileName) {
    try {
      if (window.UI && UI.toast) UI.toast('Getting download link…', 'info', 2000);
      const url = await _getPresignedGetUrl(objectKey);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = fileName || 'file';
      a.target   = '_blank';
      a.rel      = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); }, 1000);
    } catch (e) {
      if (window.UI && UI.toast) UI.toast('Could not open file: ' + e.message, 'error', 5000);
    }
  }

  /* ── CORE: delete a file (metadata + B2 object) ────────── */
  async function deleteFile(docId, objectKey) {
    try {
      await _deleteFromB2(objectKey);
    } catch (e) {
      console.warn('[storage] B2 delete failed (non-fatal):', e.message);
    }
    await window.fbDb.collection('uploads').doc(docId).delete();
  }

  /* ══════════════════════════════════════════════════════════
     UI: UPLOAD MODAL
     Called from student dashboard and teacher dashboard.
  ══════════════════════════════════════════════════════════ */
  function openUploadModal(opts) {
    /*
      opts = {
        uploaderUid, uploaderName, uploaderRole, uploaderClass,
        context, defaultSharedWith,
        onSuccess: function(result) {}
      }
    */
    const existing = document.getElementById('vtxStorageUploadModal');
    if (existing) existing.remove();

    const isTeacher = opts.uploaderRole === 'teacher';

    const overlay = document.createElement('div');
    overlay.id    = 'vtxStorageUploadModal';
    overlay.style.cssText =
      'position:fixed;inset:0;background:var(--bg-overlay);z-index:9500;' +
      'display:flex;align-items:flex-end;justify-content:center;' +
      'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);' +
      'animation:cbt-overlay-in .16s ease-out both;';

    overlay.innerHTML = `
      <div id="vtxStorageSheet" style="
        width:100%;max-width:560px;
        background:var(--bg-base);
        border-radius:var(--r-2xl) var(--r-2xl) 0 0;
        box-shadow:0 -8px 40px rgba(0,0,0,.14);
        display:flex;flex-direction:column;
        max-height:85dvh;overflow:hidden;
        transform:translateY(100%);
        transition:transform 300ms cubic-bezier(0.16,1,0.3,1);">

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;
                    padding:.875rem 1.125rem .75rem;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:.625rem;">
            <span style="display:inline-flex;align-items:center;justify-content:center;
                         width:34px;height:34px;border-radius:var(--r-lg);
                         background:var(--accent-subtle);flex-shrink:0;">
              <i class="ph ph-upload-simple" style="font-size:17px;color:var(--accent);"></i>
            </span>
            <div>
              <p style="font-size:.9375rem;font-weight:700;color:var(--text-1);
                        line-height:1.2;letter-spacing:-.015em;">Upload File</p>
              <p style="font-size:.6875rem;color:var(--text-4);margin-top:1px;">
                Max ${MAX_FILE_MB} MB &bull; PDF, Word, Excel, images, text
              </p>
            </div>
          </div>
          <button id="vtxStorageCloseBtn"
                  style="background:var(--bg-subtle);border:none;cursor:pointer;
                         width:30px;height:30px;border-radius:var(--r-full);
                         display:flex;align-items:center;justify-content:center;
                         color:var(--text-3);"
                  aria-label="Close">
            <i class="ph ph-x" style="font-size:14px;"></i>
          </button>
        </div>

        <div style="height:1px;background:var(--border);flex-shrink:0;"></div>

        <!-- Body -->
        <div style="overflow-y:auto;padding:1.125rem;display:flex;flex-direction:column;gap:.875rem;">

          <!-- Drop zone -->
          <div id="vtxDropZone"
               style="border:2px dashed var(--border);border-radius:var(--r-xl);
                      padding:2rem 1rem;text-align:center;cursor:pointer;
                      transition:border-color .15s,background .15s;background:var(--bg-subtle);"
               onclick="document.getElementById('vtxFileInput').click()">
            <i class="ph ph-cloud-arrow-up" style="font-size:2rem;color:var(--text-4);display:block;margin-bottom:.5rem;"></i>
            <p style="font-size:.9375rem;font-weight:600;color:var(--text-2);margin-bottom:.25rem;">
              Click to choose a file
            </p>
            <p style="font-size:.75rem;color:var(--text-4);">or drag and drop it here</p>
          </div>
          <input type="file" id="vtxFileInput" style="display:none;"
                 accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.webp" />

          <!-- File preview (hidden until file selected) -->
          <div id="vtxFilePreview" style="display:none;padding:.75rem;border-radius:var(--r-lg);
               background:var(--bg-subtle);border:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:.75rem;">
              <span id="vtxFileIcon" style="font-size:1.75rem;flex-shrink:0;">📁</span>
              <div style="flex:1;min-width:0;">
                <p id="vtxFileName" style="font-size:.875rem;font-weight:700;color:var(--text-1);
                   white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></p>
                <p id="vtxFileSize" style="font-size:.75rem;color:var(--text-3);margin-top:2px;"></p>
              </div>
              <button onclick="Storage._clearFile()"
                      style="background:none;border:none;cursor:pointer;font-size:1.125rem;
                             color:var(--text-4);padding:4px;"
                      onmouseenter="this.style.color='var(--danger)'"
                      onmouseleave="this.style.color='var(--text-4)'">×</button>
            </div>
          </div>

          <!-- Description -->
          <div>
            <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Description <span style="font-weight:400;text-transform:none;color:var(--text-4);">— optional</span>
            </label>
            <input type="text" id="vtxFileDesc"
                   placeholder="What is this file about?"
                   style="width:100%;box-sizing:border-box;" />
          </div>

          <!-- Visibility -->
          <div>
            <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Who can see this?
            </label>
            <div style="display:flex;background:var(--bg-muted);border:1px solid var(--border);
                        border-radius:var(--r-md);padding:3px;gap:3px;">
              ${isTeacher ? `
              <button class="vtx-vis-btn" data-val="all"
                      style="flex:1;padding:.35rem .25rem;font-size:.75rem;font-weight:500;
                             cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs);
                             transition:all var(--t-fast);">All Students</button>
              <button class="vtx-vis-btn" data-val="private"
                      style="flex:1;padding:.35rem .25rem;font-size:.75rem;font-weight:500;
                             cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             background:transparent;color:var(--text-3);
                             transition:all var(--t-fast);">Only Me</button>
              ` : `
              <button class="vtx-vis-btn" data-val="class"
                      style="flex:1;padding:.35rem .25rem;font-size:.75rem;font-weight:500;
                             cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             background:var(--bg-base);color:var(--text-1);box-shadow:var(--shadow-xs);
                             transition:all var(--t-fast);">My Class</button>
              <button class="vtx-vis-btn" data-val="private"
                      style="flex:1;padding:.35rem .25rem;font-size:.75rem;font-weight:500;
                             cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             background:transparent;color:var(--text-3);
                             transition:all var(--t-fast);">Only Me</button>
              `}
            </div>
          </div>

          <!-- Progress bar (hidden until upload starts) -->
          <div id="vtxUploadProgressWrap" style="display:none;">
            <div style="display:flex;align-items:center;justify-content:space-between;
                        margin-bottom:.375rem;">
              <span id="vtxUploadStatusText" style="font-size:.8125rem;color:var(--text-2);"></span>
              <span id="vtxUploadPct" style="font-size:.8125rem;font-weight:700;color:var(--accent);"></span>
            </div>
            <div style="height:6px;border-radius:99px;background:var(--bg-muted);overflow:hidden;">
              <div id="vtxUploadBar" style="height:100%;width:0%;background:var(--accent);
                   border-radius:99px;transition:width .2s ease;"></div>
            </div>
          </div>

        </div>

        <div style="height:1px;background:var(--border);flex-shrink:0;"></div>

        <!-- Footer -->
        <div style="padding:.875rem 1.125rem calc(.875rem + env(safe-area-inset-bottom,0px));
                    flex-shrink:0;display:flex;gap:.5rem;">
          <button id="vtxStorageCancelBtn"
                  style="flex:1;padding:.625rem;border-radius:var(--r-xl);
                         background:var(--bg-subtle);border:1px solid var(--border);
                         color:var(--text-2);font-size:.875rem;font-weight:600;
                         cursor:pointer;font-family:var(--font);">
            Cancel
          </button>
          <button id="vtxStorageUploadBtn"
                  style="flex:2;padding:.625rem;border-radius:var(--r-xl);
                         background:var(--accent);border:none;
                         color:#fff;font-size:.875rem;font-weight:700;
                         cursor:pointer;font-family:var(--font);
                         opacity:.5;transition:opacity var(--t-fast);"
                  disabled>
            Upload File
          </button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var sheet = document.getElementById('vtxStorageSheet');
        if (sheet) sheet.style.transform = 'translateY(0)';
      });
    });

    // State
    var _selectedFile    = null;
    var _selectedVis     = isTeacher ? 'all' : 'class';
    var _uploading       = false;

    // Visibility toggle
    overlay.querySelectorAll('.vtx-vis-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        _selectedVis = btn.dataset.val;
        overlay.querySelectorAll('.vtx-vis-btn').forEach(function (b) {
          b.style.background  = 'transparent';
          b.style.color       = 'var(--text-3)';
          b.style.boxShadow   = 'none';
        });
        btn.style.background = 'var(--bg-base)';
        btn.style.color      = 'var(--text-1)';
        btn.style.boxShadow  = 'var(--shadow-xs)';
      });
    });

    // File input
    var fileInput = document.getElementById('vtxFileInput');
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) {
        _setFile(fileInput.files[0]);
      }
    });

    // Drag and drop
    var dropZone = document.getElementById('vtxDropZone');
    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--accent)';
      dropZone.style.background  = 'var(--accent-subtle)';
    });
    dropZone.addEventListener('dragleave', function () {
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background  = 'var(--bg-subtle)';
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background  = 'var(--bg-subtle)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        _setFile(e.dataTransfer.files[0]);
      }
    });

    function _setFile(file) {
      _selectedFile = file;
      var ext    = _ext(file.name);
      var icon   = _fileIcon(ext);
      document.getElementById('vtxDropZone').style.display  = 'none';
      document.getElementById('vtxFilePreview').style.display = '';
      document.getElementById('vtxFileIcon').textContent   = icon;
      document.getElementById('vtxFileName').textContent   = file.name;
      document.getElementById('vtxFileSize').textContent   = _fmtBytes(file.size);

      var uploadBtn = document.getElementById('vtxStorageUploadBtn');
      uploadBtn.disabled      = false;
      uploadBtn.style.opacity = '1';
    }

    // Public clear (called from inline onclick)
    Storage._clearFile = function () {
      _selectedFile = null;
      document.getElementById('vtxDropZone').style.display    = '';
      document.getElementById('vtxFilePreview').style.display = 'none';
      var uploadBtn = document.getElementById('vtxStorageUploadBtn');
      uploadBtn.disabled      = true;
      uploadBtn.style.opacity = '.5';
      fileInput.value         = '';
    };

    // Close
    function _close() {
      if (_uploading) return;
      var sheet = document.getElementById('vtxStorageSheet');
      if (sheet) sheet.style.transform = 'translateY(100%)';
      setTimeout(function () { overlay.remove(); }, 320);
    }
    document.getElementById('vtxStorageCloseBtn').addEventListener('click', _close);
    document.getElementById('vtxStorageCancelBtn').addEventListener('click', _close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) _close();
    });

    // Upload
    document.getElementById('vtxStorageUploadBtn').addEventListener('click', async function () {
      if (!_selectedFile || _uploading) return;
      _uploading = true;

      var uploadBtn   = document.getElementById('vtxStorageUploadBtn');
      var cancelBtn   = document.getElementById('vtxStorageCancelBtn');
      var closeBtn    = document.getElementById('vtxStorageCloseBtn');
      var progressWrap = document.getElementById('vtxUploadProgressWrap');

      uploadBtn.disabled      = true;
      uploadBtn.textContent   = 'Uploading…';
      cancelBtn.disabled      = true;
      closeBtn.style.display  = 'none';
      progressWrap.style.display = '';

      function onProgress(pct, msg) {
        var bar     = document.getElementById('vtxUploadBar');
        var txt     = document.getElementById('vtxUploadStatusText');
        var pctEl   = document.getElementById('vtxUploadPct');
        if (bar)   bar.style.width  = pct + '%';
        if (txt)   txt.textContent  = msg || '';
        if (pctEl) pctEl.textContent = pct + '%';
      }

      try {
        var desc = (document.getElementById('vtxFileDesc').value || '').trim();
        var result = await uploadFile(_selectedFile, {
          uploaderUid:   opts.uploaderUid,
          uploaderName:  opts.uploaderName,
          uploaderRole:  opts.uploaderRole,
          uploaderClass: opts.uploaderClass || '',
          context:       opts.context || 'general',
          description:   desc,
          sharedWith:    _selectedVis,
        }, onProgress);

        uploadBtn.textContent   = 'Done!';
        uploadBtn.style.background = 'var(--success)';
        uploadBtn.style.opacity    = '1';

        if (window.UI && UI.toast) UI.toast('File uploaded successfully.', 'success');
        if (opts.onSuccess) opts.onSuccess(result);

        setTimeout(_close, 1200);

      } catch (err) {
        console.error('[storage] Upload error:', err);
        uploadBtn.disabled      = false;
        uploadBtn.textContent   = 'Upload File';
        uploadBtn.style.opacity = '1';
        cancelBtn.disabled      = false;
        closeBtn.style.display  = '';
        progressWrap.style.display = 'none';
        _uploading = false;
        if (window.UI && UI.toast) UI.toast('Upload failed: ' + err.message, 'error', 8000);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     UI: FILE LIST (shared between student and teacher)
  ══════════════════════════════════════════════════════════ */
  function renderFileList(containerId, queryOpts, userOpts) {
    /*
      queryOpts = { uploaderUid, uploaderClass, sharedWith, role }
      userOpts  = { canDelete, canUpload, uploaderUid, uploaderName,
                    uploaderRole, uploaderClass, context }
    */
    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
        'margin-bottom:1rem;flex-wrap:wrap;gap:.75rem;">' +
        '<div>' +
          '<h3 style="font-size:1rem;font-weight:700;color:var(--text-1);">Files & Resources</h3>' +
          '<p style="font-size:.75rem;color:var(--text-3);margin-top:2px;">' +
            (userOpts.role === 'teacher'
              ? 'All uploaded files — click to download.'
              : 'Files shared with your class and your own uploads.') +
          '</p>' +
        '</div>' +
        (userOpts.canUpload
          ? '<button id="vtxStorageOpenUploadBtn" ' +
              'style="display:inline-flex;align-items:center;gap:.375rem;' +
              'padding:.5rem 1rem;border-radius:var(--r-xl);' +
              'background:var(--accent);border:none;color:#fff;' +
              'font-size:.8125rem;font-weight:700;cursor:pointer;font-family:var(--font);' +
              'transition:opacity var(--t-fast);" ' +
              'onmouseenter="this.style.opacity=\'.85\'" ' +
              'onmouseleave="this.style.opacity=\'1\'">' +
              '<i class="ph ph-upload-simple" style="font-size:15px;"></i> Upload File' +
            '</button>'
          : '') +
      '</div>' +
      '<div id="vtxFileListInner" style="display:flex;flex-direction:column;gap:.5rem;">' +
        '<div style="text-align:center;padding:2rem;color:var(--text-3);font-size:.875rem;">' +
          'Loading files…' +
        '</div>' +
      '</div>';

    // Wire upload button
    if (userOpts.canUpload) {
      var uploadBtn = document.getElementById('vtxStorageOpenUploadBtn');
      if (uploadBtn) {
        uploadBtn.addEventListener('click', function () {
          openUploadModal({
            uploaderUid:   userOpts.uploaderUid,
            uploaderName:  userOpts.uploaderName,
            uploaderRole:  userOpts.uploaderRole,
            uploaderClass: userOpts.uploaderClass,
            context:       userOpts.context,
            onSuccess: function () {
              // Refresh list
              _loadFiles(containerId, queryOpts, userOpts);
            },
          });
        });
      }
    }

    _loadFiles(containerId, queryOpts, userOpts);
  }

  function _loadFiles(containerId, queryOpts, userOpts) {
    var inner = document.getElementById('vtxFileListInner');
    if (!inner) return;

    var query = window.fbDb.collection('uploads').orderBy('createdAt', 'desc');

    // Filter by role
    if (queryOpts.role === 'teacher') {
      // Teacher sees everything
    } else if (queryOpts.uploaderUid) {
      // Student sees: their own files OR files shared with their class OR all-student files
      // We fetch all visible and filter client-side (Firestore OR queries need index magic)
      // Simple approach: fetch class-shared + private-own in two queries then merge
    }

    query.limit(100).get().then(function (snap) {
      var docs = [];
      snap.forEach(function (doc) {
        var d = doc.data();
        var visible = false;
        if (queryOpts.role === 'teacher') {
          visible = true;
        } else {
          // Student: see own files, class-shared files from same class, teacher-shared 'all' files
          if (d.uploaderUid === queryOpts.uploaderUid) visible = true;
          else if (d.sharedWith === 'all') visible = true;
          else if (d.sharedWith === 'class' && d.uploaderClass === queryOpts.uploaderClass) visible = true;
        }
        if (visible) docs.push({ id: doc.id, ...d });
      });

      if (docs.length === 0) {
        inner.innerHTML =
          '<div style="display:flex;flex-direction:column;align-items:center;' +
            'justify-content:center;gap:.625rem;text-align:center;' +
            'padding:3rem 1rem;color:var(--text-3);">' +
            '<i class="ph ph-folder-open" style="font-size:2rem;color:var(--text-4);"></i>' +
            '<p style="font-size:.875rem;">No files yet.</p>' +
          '</div>';
        return;
      }

      inner.innerHTML = docs.map(function (d) {
        var canDel = userOpts.canDelete ||
          (d.uploaderUid === userOpts.uploaderUid);
        var sharedBadge = d.sharedWith === 'all'
          ? '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
              'background:var(--success-subtle);color:var(--success-text);' +
              'border:1px solid var(--success-border);">All students</span>'
          : d.sharedWith === 'class'
          ? '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
              'background:var(--accent-subtle);color:var(--accent-text);' +
              'border:1px solid var(--accent-border);">' + _esc(d.uploaderClass) + '</span>'
          : '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
              'background:var(--bg-subtle);color:var(--text-4);' +
              'border:1px solid var(--border);">Private</span>';

        var roleBadge = d.uploaderRole === 'teacher'
          ? '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
              'background:var(--warning-subtle);color:var(--warning-text);' +
              'border:1px solid var(--warning-border);">Teacher</span>'
          : '';

        return '<div style="display:flex;align-items:center;gap:.75rem;' +
          'padding:.75rem .875rem;border-radius:var(--r-lg);' +
          'background:var(--bg-base);border:1px solid var(--border);' +
          'transition:border-color .12s,box-shadow .12s;" ' +
          'onmouseenter="this.style.borderColor=\'var(--accent-border)\';this.style.boxShadow=\'var(--shadow-sm)\'" ' +
          'onmouseleave="this.style.borderColor=\'var(--border)\';this.style.boxShadow=\'\'">' +

          // Icon
          '<div style="flex-shrink:0;font-size:1.75rem;width:40px;text-align:center;">' +
            _fileIcon(d.fileExt) +
          '</div>' +

          // Info
          '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;margin-bottom:2px;">' +
              '<p style="font-size:.875rem;font-weight:700;color:var(--text-1);' +
                'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">' +
                _esc(d.fileName) + '</p>' +
              sharedBadge + roleBadge +
            '</div>' +
            '<p style="font-size:.75rem;color:var(--text-3);">' +
              _esc(d.uploaderName || 'Unknown') + ' &bull; ' +
              _fmtBytes(d.fileSize) + ' &bull; ' + _fmtDate(d.createdAt) +
            '</p>' +
            (d.description
              ? '<p style="font-size:.75rem;color:var(--text-4);margin-top:2px;' +
                  'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
                  _esc(d.description) + '</p>'
              : '') +
          '</div>' +

          // Actions
          '<div style="display:flex;gap:.375rem;align-items:center;flex-shrink:0;">' +
            '<button onclick="Storage.openFile(\'' + _esc(d.objectKey) + '\',\'' + _esc(d.fileName) + '\')" ' +
              'title="Download / Open" ' +
              'style="display:inline-flex;align-items:center;gap:.3rem;' +
              'padding:.375rem .75rem;border-radius:var(--r-lg);' +
              'background:var(--accent-subtle);border:1px solid var(--accent-border);' +
              'color:var(--accent-text);font-size:.75rem;font-weight:600;' +
              'cursor:pointer;font-family:var(--font);transition:background var(--t-fast);" ' +
              'onmouseenter="this.style.background=\'var(--accent)\';this.style.color=\'#fff\'" ' +
              'onmouseleave="this.style.background=\'var(--accent-subtle)\';this.style.color=\'var(--accent-text)\'">' +
              '<i class="ph ph-download-simple" style="font-size:13px;"></i> Open' +
            '</button>' +
            (canDel
              ? '<button onclick="Storage._confirmDelete(\'' + _esc(d.id) + '\',\'' + _esc(d.objectKey) + '\',\'' + containerId + '\',' + JSON.stringify(queryOpts).replace(/"/g,"'") + ',' + JSON.stringify(userOpts).replace(/"/g,"'") + ')" ' +
                  'title="Delete file" ' +
                  'style="width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;' +
                  'border-radius:var(--r-lg);background:transparent;border:1px solid var(--border);' +
                  'color:var(--text-4);cursor:pointer;transition:all var(--t-fast);" ' +
                  'onmouseenter="this.style.background=\'var(--danger-subtle)\';this.style.borderColor=\'var(--danger-border)\';this.style.color=\'var(--danger)\'" ' +
                  'onmouseleave="this.style.background=\'transparent\';this.style.borderColor=\'var(--border)\';this.style.color=\'var(--text-4)\'">' +
                  '<i class="ph ph-trash" style="font-size:14px;pointer-events:none;"></i>' +
                '</button>'
              : '') +
          '</div>' +
        '</div>';
      }).join('');

    }).catch(function (err) {
      console.error('[storage] File list load error:', err);
      inner.innerHTML =
        '<p style="color:var(--danger);font-size:.875rem;text-align:center;padding:1rem;">Error loading files.</p>';
    });
  }

  /* ── Confirm delete (called from inline onclick) ────────── */
  Storage._confirmDelete = async function (docId, objectKey, containerId, queryOpts, userOpts) {
    if (!window.UI || !UI.confirmAction) return;
    var ok = await UI.confirmAction('Delete this file? This cannot be undone.');
    if (!ok) return;
    try {
      await deleteFile(docId, objectKey);
      if (window.UI && UI.toast) UI.toast('File deleted.', 'success');
      _loadFiles(containerId, queryOpts, userOpts);
    } catch (e) {
      if (window.UI && UI.toast) UI.toast('Could not delete file: ' + e.message, 'error');
    }
  };

  /* ══════════════════════════════════════════════════════════
     STUDENT: render storage panel on dashboard
     Called from renderSubjectSelection in exam.js
  ══════════════════════════════════════════════════════════ */
  function renderStudentStoragePanel(containerId) {
    var sd  = AppState.studentData;
    var uid = AppState.userId;
    if (!sd || !uid) return;

    renderFileList(containerId, {
      role:          'student',
      uploaderUid:   uid,
      uploaderClass: sd.class || '',
    }, {
      canUpload:     true,
      canDelete:     false, // students can delete only their own (handled per-row)
      uploaderUid:   uid,
      uploaderName:  sd.name,
      uploaderRole:  'student',
      uploaderClass: sd.class || '',
      context:       'dashboard',
      role:          'student',
    });
  }

  /* ══════════════════════════════════════════════════════════
     TEACHER: render storage panel in teacher dashboard
     Called from teacher.js showTab('storage')
  ══════════════════════════════════════════════════════════ */
  function renderTeacherStoragePanel(containerId) {
    var uid = AppState.userId;
    renderFileList(containerId, {
      role: 'teacher',
    }, {
      canUpload:    true,
      canDelete:    true,
      uploaderUid:  uid,
      uploaderName: 'Master Timothy',
      uploaderRole: 'teacher',
      context:      'teacher',
      role:         'teacher',
    });
  }

  /* ── Public API ─────────────────────────────────────────── */
  window.Storage = {
    uploadFile,
    openFile,
    deleteFile,
    openUploadModal,
    renderFileList,
    renderStudentStoragePanel,
    renderTeacherStoragePanel,
    _clearFile:      function () {}, // set dynamically when modal is open
    _confirmDelete:  Storage ? Storage._confirmDelete : function () {},
  };

  // Fix self-reference before assignment
  window.Storage._confirmDelete = async function (docId, objectKey, containerId, queryOpts, userOpts) {
    var ok = await UI.confirmAction('Delete this file? This cannot be undone.');
    if (!ok) return;
    try {
      await deleteFile(docId, objectKey);
      UI.toast('File deleted.', 'success');
      _loadFiles(containerId, queryOpts, userOpts);
    } catch (e) {
      UI.toast('Could not delete file: ' + e.message, 'error');
    }
  };

}());
