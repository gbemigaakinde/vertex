/* ============================================================
   js/storage.js — Vertex File Storage (Backblaze B2)
   ============================================================ */

(function () {
  'use strict';

  /* ── Constants ─────────────────────────────────────────── */
  const WORKER_URL = 'https://vertex-worker.gbemigaakinde.workers.dev';

  const STUDENT_MAX_FILE_MB        = 20;   // non-video cap for students
  const STUDENT_MAX_VIDEO_MB       = 30;   // video cap for students
  const TEACHER_MAX_FILE_MB        = 5000; // practical ceiling for teachers ("unlimited")
  const STUDENT_DAILY_UPLOAD_LIMIT = 15;   // uploads per student per day

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
    'video/mp4':                                'mp4',
    'video/webm':                               'webm',
    'video/quicktime':                          'mov',
    'video/x-matroska':                         'mkv',
    'video/x-msvideo':                          'avi',
  };

  const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'mkv', 'avi'];

  /* Phosphor icon class per file extension (no emojis) */
  const FILE_ICONS = {
    pdf:  'ph-file-pdf',
    doc:  'ph-file-doc',  docx: 'ph-file-doc',
    xls:  'ph-file-xls',  xlsx: 'ph-file-xls',
    ppt:  'ph-file-ppt',  pptx: 'ph-file-ppt',
    txt:  'ph-file-text',
    jpg:  'ph-image', jpeg: 'ph-image', png: 'ph-image', gif: 'ph-image', webp: 'ph-image',
    mp4:  'ph-film-strip', webm: 'ph-film-strip', mov: 'ph-film-strip',
    mkv:  'ph-film-strip', avi: 'ph-film-strip',
    default: 'ph-file',
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
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  function _fmtDate(ts) {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
  }

  function _fileIconClass(ext) {
    return FILE_ICONS[ext] || FILE_ICONS.default;
  }

  function _fileIconHtml(ext, sizePx) {
    var size = sizePx || 20;
    return '<i class="ph ' + _fileIconClass(ext) + '" style="font-size:' + size + 'px;"></i>';
  }

  function _ext(filename) {
    return (filename || '').split('.').pop().toLowerCase();
  }

  function _isVideoFile(file) {
    var ext = _ext(file.name);
    return (file.type || '').indexOf('video/') === 0 || VIDEO_EXTS.indexOf(ext) !== -1;
  }

  function _safeKey(uid, filename) {
    const ts   = Date.now();
    const safe = (filename || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    return 'uploads/' + uid + '/' + ts + '_' + safe;
  }

  /* Accept string for student file input, built from ALLOWED_TYPES
     so it always stays in sync with the type list above. */
  function _studentAcceptString() {
    var exts = Array.from(new Set(Object.values(ALLOWED_TYPES)));
    return '.' + exts.join(',.');
  }

  /* ── Countdown formatting ─────────────────────────────────
     Shared by initial render and the live-updating interval. */
  function _formatCountdown(ms) {
    if (ms <= 0) return 'Expired';
    var totalSeconds = Math.floor(ms / 1000);
    var days  = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var mins  = Math.floor((totalSeconds % 3600) / 60);
    var secs  = totalSeconds % 60;
    if (days  > 0) return days + 'd ' + hours + 'h left';
    if (hours > 0) return hours + 'h ' + mins + 'm left';
    if (mins  > 0) return mins + 'm ' + secs + 's left';
    return secs + 's left';
  }

  function _toMillis(tsOrDate) {
    if (!tsOrDate) return null;
    var d = tsOrDate.toDate ? tsOrDate.toDate() : new Date(tsOrDate);
    return d.getTime();
  }

  /* ── File validation ────────── */
  function _fileValidationError(file, uploaderRole) {
    var isTeacher = uploaderRole === 'teacher';
    var ext       = _ext(file.name);
    var isVideo   = _isVideoFile(file);

    if (!isTeacher) {
      if (!ALLOWED_TYPES[file.type] && Object.values(ALLOWED_TYPES).indexOf(ext) === -1) {
        return 'File type not allowed. Supported: PDF, Word, Excel, images, video, and text files.';
      }
      var capMB = isVideo ? STUDENT_MAX_VIDEO_MB : STUDENT_MAX_FILE_MB;
      if (file.size > capMB * 1024 * 1024) {
        return 'File is too large. Maximum size is ' + capMB + ' MB for ' +
               (isVideo ? 'videos' : 'this file type') + '.';
      }
    } else {
      if (file.size > TEACHER_MAX_FILE_MB * 1024 * 1024) {
        return 'File is too large. Maximum size is ' + TEACHER_MAX_FILE_MB + ' MB.';
      }
    }
    return null;
  }

  /* ── Daily upload count for students ─────────────────────  */
  async function _checkStudentDailyLimit(uid) {
    try {
      var startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      var snap = await window.fbDb.collection('uploads')
        .where('uploaderUid', '==', uid)
        .where('createdAt', '>=', startOfDay)
        .get();
      var used = snap.size;
      return { allowed: used < STUDENT_DAILY_UPLOAD_LIMIT, used: used, limit: STUDENT_DAILY_UPLOAD_LIMIT };
    } catch (e) {
      console.warn('[storage] Daily limit check failed (allowing upload):', e.message);
      return { allowed: true, used: 0, limit: STUDENT_DAILY_UPLOAD_LIMIT };
    }
  }

  /* ── Student list for the teacher's "send to one student"
     picker. Fetched once and cached for the page session. ── */
  var _cachedStudentList = null;
  async function _fetchStudentList() {
    if (_cachedStudentList) return _cachedStudentList;
    var snap = await window.fbDb.collection('students').orderBy('name').get();
    var list = [];
    snap.forEach(function (doc) {
      var d = doc.data();
      list.push({ uid: doc.id, name: d.name || 'Unnamed', class: d.class || '' });
    });
    _cachedStudentList = list;
    return list;
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
    if (!file) throw new Error('No file selected.');

    const role = opts.uploaderRole || 'student';
    const validationError = _fileValidationError(file, role);
    if (validationError) throw new Error(validationError);

    if (role !== 'teacher') {
      const limitCheck = await _checkStudentDailyLimit(opts.uploaderUid);
      if (!limitCheck.allowed) {
        throw new Error('Daily upload limit reached (' + limitCheck.limit + ' files/day). Try again tomorrow.');
      }
    }

    if (opts.sharedWith === 'student' && !opts.targetStudentUid) {
      throw new Error('Please select which student this file is for.');
    }

    const ext         = _ext(file.name);
    const isVideo      = _isVideoFile(file);
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
      fileName:          file.name,
      fileSize:          file.size,
      fileType:          contentType,
      fileExt:           ext,
      isVideo:           isVideo,
      uploaderUid:       opts.uploaderUid,
      uploaderName:      opts.uploaderName,
      uploaderRole:      role,
      uploaderClass:     opts.uploaderClass || '',
      context:           opts.context       || 'general',
      description:       opts.description   || '',
      sharedWith:        opts.sharedWith    || 'private',
      targetStudentUid:  opts.sharedWith === 'student' ? (opts.targetStudentUid  || null) : null,
      targetStudentName: opts.sharedWith === 'student' ? (opts.targetStudentName || null) : null,
      expiresAt:         opts.expiresAt ? firebase.firestore.Timestamp.fromDate(opts.expiresAt) : null,
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
      <style>
        .vtx-vis-btn {
          font-size:.75rem; padding:.4rem .3rem; white-space:nowrap;
          overflow:hidden; text-overflow:ellipsis;
        }
        @media (max-width:420px) {
          .vtx-vis-btn { font-size:.6875rem; padding:.32rem .2rem; }
        }
      </style>
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
          <div style="display:flex;align-items:center;gap:.625rem;min-width:0;">
            <span style="display:inline-flex;align-items:center;justify-content:center;
                         width:34px;height:34px;border-radius:var(--r-lg);
                         background:var(--accent-subtle);flex-shrink:0;">
              <i class="ph ph-upload-simple" style="font-size:17px;color:var(--accent);"></i>
            </span>
            <div style="min-width:0;">
              <p style="font-size:.9375rem;font-weight:700;color:var(--text-1);
                        line-height:1.2;letter-spacing:-.015em;">Upload File</p>
              <p id="vtxStorageSubtitle" style="font-size:.6875rem;color:var(--text-4);margin-top:1px;"></p>
            </div>
          </div>
          <button id="vtxStorageCloseBtn"
                  style="background:var(--bg-subtle);border:none;cursor:pointer;
                         width:30px;height:30px;border-radius:var(--r-full);
                         display:flex;align-items:center;justify-content:center;
                         color:var(--text-3);flex-shrink:0;"
                  aria-label="Close">
            <i class="ph ph-x" style="font-size:14px;"></i>
          </button>
        </div>

        <div style="height:1px;background:var(--border);flex-shrink:0;"></div>

        <!-- Body -->
        <div style="overflow-y:auto;padding:1.125rem;display:flex;flex-direction:column;gap:.875rem;">

          <!-- Daily limit banner (student only, shown if reached) -->
          <div id="vtxLimitBanner" style="display:none;padding:.625rem .75rem;border-radius:var(--r-lg);
               background:var(--danger-subtle);border:1px solid var(--danger-border);
               color:var(--danger);font-size:.8125rem;font-weight:600;">
            You have reached today's upload limit. Try again tomorrow.
          </div>

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
          <input type="file" id="vtxFileInput" style="display:none;" />

          <!-- File preview (hidden until file selected) -->
          <div id="vtxFilePreview" style="display:none;padding:.75rem;border-radius:var(--r-lg);
               background:var(--bg-subtle);border:1px solid var(--border);">
            <div style="display:flex;align-items:center;gap:.75rem;">
              <span id="vtxFileIcon" style="font-size:1.75rem;flex-shrink:0;display:inline-flex;">
                <i class="ph ph-file"></i>
              </span>
              <div style="flex:1;min-width:0;">
                <p id="vtxFileName" style="font-size:.875rem;font-weight:700;color:var(--text-1);
                   white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></p>
                <p id="vtxFileSize" style="font-size:.75rem;color:var(--text-3);margin-top:2px;"></p>
              </div>
              <button onclick="Storage._clearFile()"
                      style="background:none;border:none;cursor:pointer;font-size:1.125rem;
                             color:var(--text-4);padding:4px;display:inline-flex;"
                      onmouseenter="this.style.color='var(--danger)'"
                      onmouseleave="this.style.color='var(--text-4)'">
                <i class="ph ph-x"></i>
              </button>
            </div>
            <p id="vtxFileError" style="display:none;font-size:.75rem;color:var(--danger);margin:.5rem 0 0;"></p>
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
              Who is this for?
            </label>
            <div style="display:flex;background:var(--bg-muted);border:1px solid var(--border);
                        border-radius:var(--r-md);padding:3px;gap:3px;">
              ${isTeacher ? `
              <button class="vtx-vis-btn" data-val="all"
                      style="flex:1;cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             font-weight:500;background:var(--bg-base);color:var(--text-1);
                             box-shadow:var(--shadow-xs);transition:all var(--t-fast);">All Students</button>
              <button class="vtx-vis-btn" data-val="student"
                      style="flex:1;cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             font-weight:500;background:transparent;color:var(--text-3);
                             transition:all var(--t-fast);">1 Student</button>
              <button class="vtx-vis-btn" data-val="private"
                      style="flex:1;cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             font-weight:500;background:transparent;color:var(--text-3);
                             transition:all var(--t-fast);">Only Me</button>
              ` : `
              <button class="vtx-vis-btn" data-val="teacher"
                      style="flex:1;cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             font-weight:500;background:var(--bg-base);color:var(--text-1);
                             box-shadow:var(--shadow-xs);transition:all var(--t-fast);">Teacher</button>
              <button class="vtx-vis-btn" data-val="class"
                      style="flex:1;cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             font-weight:500;background:transparent;color:var(--text-3);
                             transition:all var(--t-fast);">My Class</button>
              <button class="vtx-vis-btn" data-val="private"
                      style="flex:1;cursor:pointer;border:none;border-radius:5px;font-family:inherit;
                             font-weight:500;background:transparent;color:var(--text-3);
                             transition:all var(--t-fast);">Only Me</button>
              `}
            </div>
          </div>

          <!-- Target student picker (teacher, "1 Student" only) -->
          <div id="vtxTargetStudentWrap" style="display:none;">
            <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Select Student
            </label>
            <select id="vtxTargetStudentSelect" style="width:100%;box-sizing:border-box;">
              <option value="">Choose a student…</option>
            </select>
          </div>

          <!-- Expiry (teacher only) -->
          ${isTeacher ? `
          <div id="vtxExpiryWrap">
            <label style="display:block;font-size:.75rem;font-weight:600;color:var(--text-3);
                          text-transform:uppercase;letter-spacing:.04em;margin-bottom:.375rem;">
              Expiry <span style="font-weight:400;text-transform:none;color:var(--text-4);">— optional</span>
            </label>
            <input type="datetime-local" id="vtxExpiryInput" style="width:100%;box-sizing:border-box;" />
            <p style="font-size:.6875rem;color:var(--text-4);margin-top:.375rem;">
              Students will see a live countdown and lose access once this time passes. Leave blank for no expiry.
            </p>
          </div>` : ''}

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

    // File input accept + subtitle, role-dependent
    var fileInput = document.getElementById('vtxFileInput');
    if (isTeacher) {
      fileInput.removeAttribute('accept'); // any file type
    } else {
      fileInput.setAttribute('accept', _studentAcceptString());
    }

    var subtitleEl = document.getElementById('vtxStorageSubtitle');
    if (isTeacher) {
      subtitleEl.textContent = 'Any file type · up to ' + TEACHER_MAX_FILE_MB + ' MB';
    } else {
      subtitleEl.textContent = 'PDF, Word, Excel, images, video, text';
    }

    // Expiry min = now (teacher only)
    if (isTeacher) {
      var expiryInput = document.getElementById('vtxExpiryInput');
      if (expiryInput) {
        var nowLocal = new Date();
        nowLocal.setMinutes(nowLocal.getMinutes() - nowLocal.getTimezoneOffset());
        expiryInput.min = nowLocal.toISOString().slice(0, 16);
      }
    }

    // State
    var _selectedFile          = null;
    var _selectedVis           = isTeacher ? 'all' : 'teacher';
    var _selectedTargetUid     = '';
    var _selectedTargetName    = '';
    var _uploading             = false;
    var _dailyLimitReached     = false;

    // Daily limit check (students only) — non-blocking, updates UI once resolved
    if (!isTeacher) {
      _checkStudentDailyLimit(opts.uploaderUid).then(function (result) {
        subtitleEl.textContent = 'PDF, Word, Excel, images, video, text · ' +
          result.used + '/' + result.limit + ' uploads used today';
        if (!result.allowed) {
          _dailyLimitReached = true;
          var banner = document.getElementById('vtxLimitBanner');
          if (banner) banner.style.display = '';
          var dz = document.getElementById('vtxDropZone');
          if (dz) { dz.style.opacity = '.5'; dz.style.pointerEvents = 'none'; }
          _updateSubmitState();
        }
      });
    }

    // Visibility toggle
    var targetWrap = document.getElementById('vtxTargetStudentWrap');
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

        if (_selectedVis === 'student') {
          targetWrap.style.display = '';
          var select = document.getElementById('vtxTargetStudentSelect');
          if (select.options.length <= 1) {
            select.innerHTML = '<option value="">Loading students…</option>';
            _fetchStudentList().then(function (list) {
              select.innerHTML = '<option value="">Choose a student…</option>' +
                list.map(function (s) {
                  return '<option value="' + _esc(s.uid) + '">' + _esc(s.name) +
                         (s.class ? ' (' + _esc(s.class) + ')' : '') + '</option>';
                }).join('');
            }).catch(function () {
              select.innerHTML = '<option value="">Could not load students</option>';
            });
          }
        } else {
          targetWrap.style.display = 'none';
          _selectedTargetUid  = '';
          _selectedTargetName = '';
        }
        _updateSubmitState();
      });
    });

    var targetSelect = document.getElementById('vtxTargetStudentSelect');
    if (targetSelect) {
      targetSelect.addEventListener('change', function () {
        _selectedTargetUid  = targetSelect.value;
        _selectedTargetName = targetSelect.options[targetSelect.selectedIndex]
          ? targetSelect.options[targetSelect.selectedIndex].text
          : '';
        _updateSubmitState();
      });
    }

    // File input
    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files[0]) {
        _setFile(fileInput.files[0]);
      }
    });

    // Drag and drop
    var dropZone = document.getElementById('vtxDropZone');
    dropZone.addEventListener('dragover', function (e) {
      if (_dailyLimitReached) return;
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
      if (_dailyLimitReached) return;
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background  = 'var(--bg-subtle)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        _setFile(e.dataTransfer.files[0]);
      }
    });

    function _setFile(file) {
      _selectedFile = file;
      var ext = _ext(file.name);
      document.getElementById('vtxDropZone').style.display    = 'none';
      document.getElementById('vtxFilePreview').style.display = '';
      document.getElementById('vtxFileIcon').innerHTML         = _fileIconHtml(ext, 22);
      document.getElementById('vtxFileName').textContent       = file.name;
      document.getElementById('vtxFileSize').textContent       = _fmtBytes(file.size);

      var errorEl = document.getElementById('vtxFileError');
      var err = _fileValidationError(file, opts.uploaderRole);
      if (err) {
        errorEl.textContent   = err;
        errorEl.style.display = '';
      } else {
        errorEl.style.display = 'none';
      }

      _updateSubmitState();
    }

    function _updateSubmitState() {
      var uploadBtn = document.getElementById('vtxStorageUploadBtn');
      if (!uploadBtn) return;
      var fileError = _selectedFile ? _fileValidationError(_selectedFile, opts.uploaderRole) : 'no file';
      var ok = !!_selectedFile && !fileError && !_dailyLimitReached;
      if (_selectedVis === 'student' && !_selectedTargetUid) ok = false;
      uploadBtn.disabled      = !ok;
      uploadBtn.style.opacity = ok ? '1' : '.5';
    }

    // Public clear (called from inline onclick)
    Storage._clearFile = function () {
      _selectedFile = null;
      document.getElementById('vtxDropZone').style.display    = '';
      document.getElementById('vtxFilePreview').style.display = 'none';
      document.getElementById('vtxFileError').style.display   = 'none';
      fileInput.value = '';
      _updateSubmitState();
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

      var uploadBtn    = document.getElementById('vtxStorageUploadBtn');
      var cancelBtn    = document.getElementById('vtxStorageCancelBtn');
      var closeBtn     = document.getElementById('vtxStorageCloseBtn');
      var progressWrap = document.getElementById('vtxUploadProgressWrap');

      uploadBtn.disabled         = true;
      uploadBtn.textContent      = 'Uploading…';
      cancelBtn.disabled         = true;
      closeBtn.style.display     = 'none';
      progressWrap.style.display = '';

      function onProgress(pct, msg) {
        var bar   = document.getElementById('vtxUploadBar');
        var txt   = document.getElementById('vtxUploadStatusText');
        var pctEl = document.getElementById('vtxUploadPct');
        if (bar)   bar.style.width  = pct + '%';
        if (txt)   txt.textContent  = msg || '';
        if (pctEl) pctEl.textContent = pct + '%';
      }

      try {
        var desc = (document.getElementById('vtxFileDesc').value || '').trim();

        var expiresAt = null;
        if (isTeacher) {
          var expiryInputEl = document.getElementById('vtxExpiryInput');
          if (expiryInputEl && expiryInputEl.value) {
            expiresAt = new Date(expiryInputEl.value);
          }
        }

        var result = await uploadFile(_selectedFile, {
          uploaderUid:       opts.uploaderUid,
          uploaderName:      opts.uploaderName,
          uploaderRole:      opts.uploaderRole,
          uploaderClass:     opts.uploaderClass || '',
          context:           opts.context || 'general',
          description:       desc,
          sharedWith:        _selectedVis,
          targetStudentUid:  _selectedTargetUid,
          targetStudentName: _selectedTargetName,
          expiresAt:         expiresAt,
        }, onProgress);

        uploadBtn.textContent      = 'Done!';
        uploadBtn.style.background = 'var(--success)';
        uploadBtn.style.opacity    = '1';

        // Reset the uploading flag now that the upload has actually
        // finished, so Cancel/Close/auto-close all work correctly.
        _uploading = false;
        cancelBtn.disabled     = false;
        closeBtn.style.display = '';

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
      queryOpts = { uploaderUid, uploaderClass, role }
      userOpts  = { canDelete, canUpload, uploaderUid, uploaderName,
                    uploaderRole, uploaderClass, context }
    */
    var container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
        'margin-bottom:1rem;flex-wrap:wrap;gap:.75rem;">' +
        '<div>' +
          '<p style="font-size:.75rem;color:var(--text-3);margin-top:2px;">' +
            (userOpts.role === 'teacher'
              ? 'All uploaded files — click to download.'
              : 'Files shared with you, your class, and your own uploads.') +
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

    query.limit(100).get().then(function (snap) {
      var now = Date.now();
      var docs = [];
      snap.forEach(function (doc) {
        var d = doc.data();
        var visible = false;

        if (queryOpts.role === 'teacher') {
          // Teachers see everything, including expired and private files.
          visible = true;
        } else {
          if (d.uploaderUid === queryOpts.uploaderUid) visible = true;
          else if (d.sharedWith === 'all') visible = true;
          else if (d.sharedWith === 'class' && d.uploaderClass === queryOpts.uploaderClass) visible = true;
          else if (d.sharedWith === 'student' && d.targetStudentUid === queryOpts.uploaderUid) visible = true;
          // sharedWith === 'teacher' from other students, and 'private'
          // uploads from the teacher, stay hidden from students.

          // Hide expired files from students entirely.
          if (visible && d.expiresAt) {
            var expMs = _toMillis(d.expiresAt);
            if (expMs !== null && expMs <= now) visible = false;
          }
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

        var sharedBadge;
        if (d.sharedWith === 'all') {
          sharedBadge = '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
            'background:var(--success-subtle);color:var(--success-text);' +
            'border:1px solid var(--success-border);">All students</span>';
        } else if (d.sharedWith === 'class') {
          sharedBadge = '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
            'background:var(--accent-subtle);color:var(--accent-text);' +
            'border:1px solid var(--accent-border);">' + _esc(d.uploaderClass) + '</span>';
        } else if (d.sharedWith === 'teacher') {
          sharedBadge = '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
            'background:var(--accent-subtle);color:var(--accent-text);' +
            'border:1px solid var(--accent-border);">To: Teacher</span>';
        } else if (d.sharedWith === 'student') {
          sharedBadge = '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
            'background:var(--accent-subtle);color:var(--accent-text);' +
            'border:1px solid var(--accent-border);">To: ' + _esc(d.targetStudentName || 'Student') + '</span>';
        } else {
          sharedBadge = '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
            'background:var(--bg-subtle);color:var(--text-4);' +
            'border:1px solid var(--border);">Private</span>';
        }

        var roleBadge = d.uploaderRole === 'teacher'
          ? '<span style="font-size:.625rem;font-weight:700;padding:1px 6px;border-radius:99px;' +
              'background:var(--warning-subtle);color:var(--warning-text);' +
              'border:1px solid var(--warning-border);">Teacher</span>'
          : '';

        var expiryBadge = '';
        if (d.expiresAt) {
          var expMs = _toMillis(d.expiresAt);
          var remaining = expMs - now;
          var isExpired = remaining <= 0;
          expiryBadge =
            '<span class="vtx-expiry-badge" data-expiry-ms="' + expMs + '" style="font-size:.625rem;' +
              'font-weight:700;padding:1px 6px;border-radius:99px;display:inline-flex;' +
              'align-items:center;gap:3px;' +
              (isExpired
                ? 'background:var(--danger-subtle);color:var(--danger);border:1px solid var(--danger-border);'
                : 'background:var(--warning-subtle);color:var(--warning-text);border:1px solid var(--warning-border);') +
              '">' +
              '<i class="ph ph-clock-countdown" style="font-size:10px;"></i>' +
              '<span class="vtx-expiry-text">' + _formatCountdown(remaining) + '</span>' +
            '</span>';
        }

        return '<div style="display:flex;align-items:center;gap:.75rem;' +
          'padding:.75rem .875rem;border-radius:var(--r-lg);' +
          'background:var(--bg-base);border:1px solid var(--border);' +
          'transition:border-color .12s,box-shadow .12s;" ' +
          'onmouseenter="this.style.borderColor=\'var(--accent-border)\';this.style.boxShadow=\'var(--shadow-sm)\'" ' +
          'onmouseleave="this.style.borderColor=\'var(--border)\';this.style.boxShadow=\'\'">' +

          // Icon
          '<div style="flex-shrink:0;font-size:1.75rem;width:40px;text-align:center;">' +
            _fileIconHtml(d.fileExt, 24) +
          '</div>' +

          // Info
          '<div style="flex:1;min-width:0;">' +
            '<div style="display:flex;align-items:center;gap:.375rem;flex-wrap:wrap;margin-bottom:2px;">' +
              '<p style="font-size:.875rem;font-weight:700;color:var(--text-1);' +
                'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;">' +
                _esc(d.fileName) + '</p>' +
              sharedBadge + roleBadge + expiryBadge +
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

  /* ── Live expiry countdown ───────────────────────────────
     Single shared interval updates every visible expiry badge
     each second, instead of re-querying or re-rendering the
     whole list. */
  setInterval(function () {
    var badges = document.querySelectorAll('.vtx-expiry-badge[data-expiry-ms]');
    badges.forEach(function (badge) {
      var ms = parseInt(badge.getAttribute('data-expiry-ms'), 10);
      if (isNaN(ms)) return;
      var remaining = ms - Date.now();
      var textEl = badge.querySelector('.vtx-expiry-text');
      if (textEl) textEl.textContent = _formatCountdown(remaining);
      if (remaining <= 0) {
        badge.style.background   = 'var(--danger-subtle)';
        badge.style.color        = 'var(--danger)';
        badge.style.borderColor  = 'var(--danger-border)';
      }
    });
  }, 1000);

}());
