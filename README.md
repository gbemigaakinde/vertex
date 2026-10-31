# Vertex Tutorial CBT

Vertex is a Progressive Web App (PWA) for Vertex Tutorial Centre. Students sit computer-based tests (CBT) by subject, practise with games, study lessons, explore interactive 3D science modules, and chat with classmates and their teacher. A teacher dashboard manages students, tasks, results, lessons, files and notifications.

There is **no build step**. The front end is plain HTML, CSS and vanilla JavaScript served as static files. A small Cloudflare Worker provides the AI, text-to-speech, push-notification and file-storage endpoints.

---

## Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Project structure](#project-structure)
4. [Running locally](#running-locally)
5. [The question bank](#the-question-bank)
6. [SVG diagrams in questions](#svg-diagrams-in-questions)
7. [Loading questions from Firestore](#loading-questions-from-firestore)
8. [Data model (Firestore)](#data-model-firestore)
9. [Cloudflare Worker](#cloudflare-worker)
10. [3D Class](#3d-class)
11. [Deployment](#deployment)
12. [Service worker and caching](#service-worker-and-caching)
13. [Security notes](#security-notes)
14. [Troubleshooting](#troubleshooting)

---

## Features

### For students
- **CBT exams** – pick at least two subjects (one on a restricted task day), answer a timed set of questions (40 per subject by default, 2-hour default duration), navigate with a question navigator, submit, and review every answer with explanations.
- **Diagrams in questions** – questions, options and explanations can include inline SVG diagrams that scale to any screen.
- **Voice** – text-to-speech (Nigerian English voices first, with fallbacks) and speech-to-text on the exam screen, plus spoken session reminders.
- **AI help** – explain a question, ask a tutor, ask about a topic, or upload an image for an explanation (daily limits apply to image requests).
- **Games** – Quiz Blitz, True or False Blitz, Speed Math, Word Scramble, Perfect Run, Challenge a Classmate, Word Scrabble and Chess, with XP and a leaderboard.
- **Study Room** – a lesson browser and reader for teacher-published Markdown lessons, with reader preferences (e.g. font size).
- **3D Class** – interactive 3D Chemistry (periodic table), Biology (cells and systems) and Physics modules, plus **Live Class**: a real-time voice class where Master Timothy AI teaches out loud while building 3D models and writing on a whiteboard.
- **Tasks and timetable** – teacher-assigned tasks and a weekly class timetable shown on the home screen.
- **Chat** – public discussion chat, direct messages with online presence, group chats, voice notes, and in-app message notifications.
- **Push notifications** – Web Push reminders (exam tomorrow, keep your streak, complete today's session) and teacher announcements.
- **Offline-friendly** – installable PWA with an offline fallback page.

### For the teacher
The teacher dashboard has these sections: **Approvals, Students, Results, Schools, Tasks, Study Room, Games, Timetable, Activity, Storage, Groups, Chat, Direct Messages and Push**. In summary the teacher can:
- approve or decline new student registrations,
- view results, including each student's answers question by question,
- assign tasks and restrict which subjects are allowed on a given day,
- publish lessons and manage the weekly timetable,
- upload and share files (Backblaze B2 storage),
- send push notifications, targeted by class, immediately or scheduled/recurring,
- monitor student activity and chat.

---

## Architecture

```
 Browser (static files on Vercel)                Cloudflare Worker (vertex-worker)
 ┌──────────────────────────────────┐            ┌───────────────────────────────────┐
 │ index.html + css/ + js/ + data/  │──fetch────▶│ /ai  /tts  /visual                │
 │ sw.js (PWA cache)                │            │ /api/*  (push)                    │
 │                                  │            │ /storage/*  (B2 presigned URLs)   │
 │ Firebase Auth + Firestore (SDK)  │            │ KV: VTX_RATE_LIMITS, AI binding   │
 └──────────────┬───────────────────┘            │ Cron: daily + every 5 minutes     │
                │                                └───────────────────────────────────┘
                ▼
     Firebase (Auth, Firestore)
```

- **Front end** – single-page app. `index.html` loads every script in a fixed order; modules attach themselves to `window` (`Exam`, `Teacher`, `Game`, `UI`, `AppState`, …). There is no router: screens are rendered into the page by the module that owns them.
- **Auth and data** – Firebase Authentication and Cloud Firestore, accessed directly from the browser (`js/config.js`). Firestore persistence (IndexedDB) is intentionally **not** enabled; read the comment in `config.js` before changing that.
- **Backend** – one Cloudflare Worker (`worker.js`) for everything that needs secrets or server-side work.
- **Hosting** – the front end is deployed to Vercel; the Worker is deployed separately with Wrangler.

### Start-up flow (`js/app.js`)
1. Firebase Auth state is resolved.
2. The question bank is requested from Firestore in the background (see [Loading questions from Firestore](#loading-questions-from-firestore)).
3. **Teacher** (the UID in `AppConfig.TEACHER_UID`) → teacher dashboard.
4. **Student** → approval check (pending and declined students get a waiting or declined screen) → profile load → listeners (notifications, DMs, group chat, challenges) → `Exam.loadOrStart()`.
5. Signed-out visitors see the public landing page and login/registration.

---

## Project structure

```
index.html              App shell – loads all scripts in order
manifest.json           PWA manifest
sw.js                   Service worker (offline cache, push)
offline.html            Offline fallback page
english.html            Standalone English grammar lesson page
physics.html            Standalone Physics (optics and waves) lesson page
news-ticker.js/.css     Scrolling announcements ticker
vertex.jpeg             App icon / logo
vercel.json, .vercelignore   Static hosting config (worker files are not uploaded)
worker.js, wrangler.jsonc    Cloudflare Worker source and config
vapid-generator.html    One-off helper for generating Web Push (VAPID) keys

css/
  main.css              Main design system and screens
  tailwind.css          Pre-built Tailwind utility classes (generated, do not edit by hand)
  studyroom.css         Study Room styles
  voice-ui.css          Voice / speech UI styles

data/
  questions.js          Bundled question bank (window.questions) – also the fallback

js/
  config.js             Firebase initialisation (only file that touches the config)
  state.js              Central AppState and AppConfig
  svg-diagram.js        Safe inline SVG diagrams for questions
  question-loader.js    Loads the question bank from Firestore
  ui.js                 Toasts, loaders, modals
  auth.js               Login and registration
  app.js                Entry point and login flow
  exam.js               Exam engine, results, review
  game.js               Games and XP
  speech.js             Text-to-speech, speech-to-text, AI explanations
  session-reminders.js  Spoken nudges while a student is active
  tasks.js              Tasks and scheduling
  studyroom.js          Lesson browser and reader
  threedclass*.js       3D Class hub, the Chemistry / Biology / Physics modules and Live Class (threedclass-live.js)
  chat.js, dm.js, groupchat.js, voice-notes.js, msgnotif.js   Messaging
  notifications.js, teacher-push.js    Web Push (student and teacher sides)
  storage.js            File storage client (Backblaze B2 via the Worker)
  teacher.js            Teacher dashboard
  activitylog.js        Activity log and registration approval system
  landing.js            Public landing page
  installPrompt.js      "Install app" prompt
```

---

## Running locally

No install or build is needed.

```bash
# from the repository root, using any static server
python3 -m http.server 8080
# or
npx serve .
```

Open <http://localhost:8080>. Service workers work on `localhost` and HTTPS only.

Notes:
- The app talks to the live Firebase project configured in `js/config.js` and to the deployed Worker URL. To use your own, change those values (and the `WORKER_URL` constants in `notifications.js`, `teacher-push.js` and `storage.js`, plus the Worker URL used by `speech.js`).
- After editing any cached file, bump `CACHE_VERSION` in `sw.js` (see [Service worker and caching](#service-worker-and-caching)) or use DevTools → Application → "Update on reload".

---

## The question bank

`data/questions.js` assigns `window.questions`, organised **class → subject → array of questions**:

```js
window.questions = {
  "jss1": {
    "English Studies": [
      { q: "Which word …?", opts: ["bed", "bad", "bard", "heard"], ans: 3, exp: "Why 'heard' is right…" },
      // …
    ],
    "Mathematics": [ /* … */ ],
  },
  "sss1": { /* … */ },
};
```

| Field | Type | Meaning |
|---|---|---|
| `q` | string | Question text. LaTeX between `$…$` / `$$…$$` is rendered with KaTeX. |
| `opts` | string[] | Answer options (at least 2). |
| `ans` | number | Index of the correct option in `opts` (0-based). |
| `exp` | string | Explanation shown in the results review. |
| `svg`, `optSvg`, `expSvg` | optional | [Diagrams](#svg-diagrams-in-questions). |

Class keys are the student's class name with spaces removed and lower-cased (`"SSS 1"` → `sss1`). The bundled bank contains these class keys: `jss1`, `jss2`, `jss3`, `sss1`, `sss2`, `sss3` and `tutorial`.

All text is HTML-escaped before display, so question text cannot inject markup.

---

## SVG diagrams in questions

Any question can carry diagrams. All three fields are optional, and questions without them behave exactly as before.

| Field | Where it appears |
|---|---|
| `svg` | Under the question text |
| `optSvg` | Array aligned with `opts`; `optSvg[i]` appears inside option *i* |
| `expSvg` | Under the explanation in the results review |

A diagram value can be an SVG string, an object `{ svg, alt, caption }`, or an array of these (several diagrams in one block).

```js
{
  q: "Which diagram shows a circle?",
  opts: ["Triangle", "Circle"],
  ans: 1,
  svg: '<svg viewBox="0 0 300 200"><rect width="300" height="200" fill="#eef"/></svg>',
  optSvg: [
    '<svg viewBox="0 0 100 100"><polygon points="50,10 90,90 10,90"/></svg>',
    { svg: '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>', alt: "A circle" }
  ],
  exp: "A circle has no corners.",
  expSvg: { svg: '<svg viewBox="0 0 100 60">…</svg>', caption: "Figure 1" }
}
```

**Requirements and behaviour**
- Each SVG needs a `viewBox`, or numeric `width` **and** `height`, so it can scale. Otherwise it is skipped.
- Diagrams scale to the available width (up to 560 px, or 420 px when no width is declared) and are capped at 420 px tall. Option diagrams are smaller (max 260 px). They sit on a white panel so they stay readable in dark mode.
- Up to 6 diagrams per question/option/explanation block; each SVG may be at most 60,000 characters.
- **Safety:** every SVG is parsed and rebuilt from an allow-list. Scripts, event handlers, `foreignObject`, external images and links, animation, CSS classes, `DOCTYPE`/entities and external `url(...)` references are removed. IDs are namespaced per diagram, so two diagrams can reuse the same ID (e.g. `arrow`). Malformed, oversized or size-less SVGs show a small "Diagram unavailable" note instead of breaking the question.
- Keep text inside diagrams reasonably large relative to the `viewBox`; it shrinks together with the diagram on phones.

Diagrams render in the exam question screen, the results review, and the Quiz Blitz, Speed Demon and Challenge game screens. Implementation: `js/svg-diagram.js` (`SvgDiagram.html`, `SvgDiagram.sanitize`).

**Known limit:** exam results saved to Firestore keep question text only (not SVGs), so the teacher's result view and PDF export do not show diagrams. This avoids pushing a result document past Firestore's 1 MB limit.

---

## Loading questions from Firestore

The bundled `data/questions.js` always loads and is the fallback. At login, `js/question-loader.js` also reads the `questionBank` collection and merges it over the bundled data.

**Collection `questionBank`** – one document per class and subject:

| Field | Type | Notes |
|---|---|---|
| `classKey` | string | e.g. `"jss1"` |
| `subject` | string | e.g. `"English Studies"` |
| `questions` | array | Same shape as the bundled questions |
| `active` | boolean | Optional. `false` hides the document. |

Document IDs are conventionally `<classKey>__<Subject_With_Underscores>`, e.g. `jss1__English_Studies`. One document per subject stays well under Firestore's 1 MB document limit.

**Merge rules**
- A subject found in Firestore **replaces** the bundled questions for that class and subject; everything else stays bundled.
- Invalid questions (no text, fewer than 2 options, `ans` out of range) are skipped; a document with no valid questions is ignored.
- If the collection is empty, unreachable, blocked by security rules, or takes longer than 8 seconds, the app silently keeps the bundled bank (details are logged to the browser console).
- The request runs once per page load and waits at most the timeout.

**Firestore does not allow arrays inside arrays.** If one option needs several diagrams, store the diagrams as a JSON string instead:

```js
diagrams: JSON.stringify({ svg: "…", optSvg: [ null, ["<svg…>", "<svg…>"] ], expSvg: "…" })
```

**Seeding** – while logged in as the teacher, run this in the browser console to copy the bundled bank into Firestore:

```js
QuestionLoader.seedFromBundled()
```

**Security rules** – students need read access and the teacher write access, for example:

```
match /questionBank/{doc} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == "<TEACHER_UID>";
}
```

Check the loader at any time with `QuestionLoader.status` (`source` is `"backend"` or `"bundled"`).

---

### Managing questions from the teacher dashboard (Questions tab)
Teachers can add, edit, reorder and delete questions, pick the correct answer, paste SVG diagrams, and bulk-import JSON, per class, subject, session (e.g. 2025/2026) and term (1-3). Documents are stored as `questionBank/<class>__<subject>__<2025-2026>__t<1-3>`. Students receive the questions of the **live period**, set with "Make live" (stored in `questionBank/_activePeriod`; if never set it follows the date: Sept-Dec Term 1, Jan-Apr Term 2, May-Aug Term 3). Older documents without a session/term remain as the fallback. Students can pick any session and term that has questions for their class on the exam screen; the teacher turns this on or off for all classes or per class in the Questions tab. Results store `questionSession` and `questionTerm`.

**Editing / deleting a subject (per class):** under the Subject picker in the Questions tab, **Edit name** renames the selected subject for that class only (all its sessions and terms move with it) and **Delete subject** removes it for that class only (all saved sessions and terms). A subject that comes from the built-in `data/questions.js` is hidden for that class instead, via `questionBank/_activePeriod.hiddenSubjects`; typing its name under "+ New subject…" restores it.

On every exam (and in the games) the questions are shuffled and so are the options of each question; the correct answer and any option diagrams move with their option. Options stay in the typed order for True/False, "All of the above", "A and C" style options, lettered options and questions or explanations that refer to "Option B". A question can force this with `"noShuffle": true` (keep) or `false` (always shuffle), or with the "Option order" setting in the Questions tab. Firestore rules must let the teacher write to `questionBank` (including the `_activePeriod` document).

## Data model (Firestore)

Collections used by the app (non-exhaustive):

| Collection | Purpose |
|---|---|
| `students`, `pendingStudents`, `declinedStudents`, `admissionNumbers` | Student profiles and the registration/approval flow |
| `schools` | School records |
| `results`, `ongoingExams` | Submitted exam results (with per-question snapshots) and in-progress exams |
| `coachingTasks`, `weeklyTimetable`, `weeklyTimetable_custom` | Tasks and timetables |
| `lessons`, `studyroom_settings` | Study Room content and settings |
| `activityLog` | Student activity events |
| `publicChat`, `messages`, `directMessages`, `privateMessages`, `groupChats`, `chatSettings`, `chatNotifications`, `presence`, `teacherPresence` | Messaging and presence |
| `gameProfiles`, `gameLeaderboard`, `gameSessions`, `gameChallenges`, `gameRestrictions`, `chessGames`, `scrabbleGames` | Games |
| `uploads` | File storage metadata |
| `questionBank` | Optional backend question bank |

---

## How tasks work

A task is a document in `coachingTasks`. The document id says who it applies to:

| Document id | Applies to | Type |
|---|---|---|
| `global` / `weekly` | every student | one-off / recurring |
| `class_<class>` / `weekly_class_<class>` | one class (e.g. `class_jss1`) | one-off / recurring |
| `student_<uid>` / `weekly_student_<uid>` | one student | one-off / recurring |

A student's app listens to the six documents that can apply to them and **merges every active one** (`js/tasks.js`, `_mergeTaskDocs`):

- A date is a task day if **any** active document contains it.
- For each date, the most specific document decides the subject restriction and the time limit (student, then class, then everyone; a one-off before a recurring document of the same scope). A document that lists no subjects for a date means "no restriction" for that date.
- The time limit only applies on a task day. On other days the default exam time is used.
- Open-ended recurring tasks (no end date) keep running; they are expanded about 120 days ahead of today.
- Completing an exam on a task day records which task document it counted for in `coachingCompletedDocs.<YYYY-MM-DD>` (array of task doc ids) on the student document. `coachingCompleted.<YYYY-MM-DD> = true` is written once every task that applies that day is completed. If a student has an individual task and a class task on the same day, finishing the individual one hands the day back to the class task. The teacher dashboard and the push reminders in `worker.js` read these fields. Each task document carries a `rev` stamped on creation and whenever what students must do changes (dates, subjects, time limit, proctoring); completions are stored as `<docId>@<rev>`, so deleting a task and creating a new one never inherits the old one's completions, while a title or message edit keeps them.

The Worker (`worker.js`) uses the same rules to decide which reminder to send, so any change to how dates are expanded must be made in both `js/tasks.js` and `worker.js`.

## Cloudflare Worker

`worker.js` (configured by `wrangler.jsonc`, name `vertex-worker`) exposes:

| Route | Purpose |
|---|---|
| `GET /` | Health check |
| `POST /ai` | AI text and vision. Intents: `explain_question`, `student_query`, `tutor_chat`, `explain_image`. Providers: Groq, Workers AI, OpenRouter. |
| `POST /tts` | Nigerian English neural text-to-speech (returns MP3; max 700 characters per request) |
| `POST /visual` | Visual explanations (SVG diagrams or AI-generated images). Image requests are limited per student per day. |
| `POST /api/save-subscription`, `/api/unsubscribe` | Store / remove a student's Web Push subscription |
| `POST /api/send-push`, `/api/trigger-reminder` | Send notifications |
| `POST /api/schedule-push`, `/api/list-scheduled-pushes`, `/api/cancel-scheduled-push` | Scheduled and recurring pushes |
| `POST /storage/presign-upload`, `/storage/presign-download`, `/storage/delete` | Backblaze B2 file storage via presigned URLs |

**Scheduled triggers (cron):** `0 19 * * *` runs the daily reminder sweep; `*/5 * * * *` checks for scheduled pushes that are due. Times use Lagos time (UTC+1).

**Bindings:** KV namespace `VTX_RATE_LIMITS` (rate limits, push subscriptions, schedules) and the Workers `AI` binding.

**Secrets and variables** (set in the Cloudflare dashboard or with `wrangler secret put` – never commit them): `GROQ_API_KEY`, `OR_API_KEY`, `VAPID_PRIVATE_KEY`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`, `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET`, `B2_REGION`, `B2_ENDPOINT`, `TEACHER_UID`. `VAPID_PUBLIC_KEY` is a plain variable in `wrangler.jsonc`. Optional: `TTS_ALLOWED_ORIGINS` (comma-separated list of browser origins allowed to call `/tts`).

Generate a VAPID key pair with `vapid-generator.html` (a development helper, excluded from Vercel deploys).

---

## 3D Class

A hub reachable from the subject-selection screen. The modules load Three.js from a CDN on demand.

| Subject | Module | What it offers |
|---|---|---|
| Chemistry | `threedclass-periodic.js` | Interactive 3D periodic table of all 118 elements |
| Biology | `threedclass-biology.js` | 3D animal and plant cells, organelle details, comparisons, quiz |
| Physics | `threedclass-physics.js` | Interactive physics modules with a quiz |

Navigation flow (no page reloads, no router changes):

```
Exam.renderSubjectSelection()
  → [3D Class button] → ThreeDClass.openForStudent()   (hub)
     → [subject card] → module.open(backFn)
        → [Back] → ThreeDClass._backToHub()
     → [Back in hub] → ThreeDClass._close() → Exam.renderSubjectSelection()
```

### Live Class (`threedclass-live.js`)

A real-time class with Master Timothy AI. The student talks (browser speech recognition) or types; Master Timothy answers out loud (the existing `SpeechEngine` Nigerian TTS) while a 3D stage and a whiteboard are driven live.

How it works:
- The client calls `POST /live` on the Worker. The Worker streams the model's answer (Groq, with Workers AI as a non-streamed fallback) as **newline-delimited JSON**, one object per line:
  - `{"say":"..."}` is spoken aloud and shown as a caption.
  - `{"do":"add|set|move|spin|orbit|focus|camera|remove|clear|group|preset|board", ...}` changes the stage or whiteboard.
- Lines are played strictly in order, so visuals and narration stay in sync, and playback starts as soon as the first line arrives.
- Commands are validated and clamped on the client; the model can never run code. Whiteboard graphs use a built-in safe expression parser (no `eval`); equations use KaTeX if it has loaded.
- Built-in animated presets: `solar_system`, `atom`, `water_molecule`, `co2_molecule`, `methane_molecule`, `wave`, `projectile`, `pendulum`.
- The student can interrupt with the mic, by typing, or by tapping an object on the stage (the tap is sent to the teacher as an event). **Hands-free** mode re-opens the mic after each answer (headphones recommended to avoid echo).
- Limits: 150 live turns per student per day (KV key `live:{id}:{date}` in `VTX_RATE_LIMITS`). Change `LIVE_DAILY_LIMIT` in `worker.js`.
- Deploy: `npx wrangler deploy` (the Worker changed), then deploy the front end. No new secrets or bindings are needed.

To add another subject, add an entry to the `SUBJECTS` list in `threedclass.js` with `available: true` and a `launch` function pointing at the new module.

Mobile performance choices: touch inertia uses `requestAnimationFrame` with velocity decay (not `setTimeout`), pinch zoom is handled natively in `touchmove`, and the periodic table uses absolute positioning so rotation causes no layout recalculation.

---

## Deployment

### Front end (Vercel)
1. Import the repository into Vercel as a static site (no build command; the output directory is the repo root).
2. `.vercelignore` keeps `worker.js`, `wrangler.jsonc`, local secret files and `vapid-generator.html` out of the public bundle.
3. `vercel.json` sets `Cache-Control: no-cache` on `/sw.js` so service-worker updates are picked up promptly.

### Worker (Cloudflare)
```bash
npx wrangler deploy                      # deploys worker.js using wrangler.jsonc
npx wrangler secret put GROQ_API_KEY     # repeat for each secret listed above
```
Create the KV namespace referenced in `wrangler.jsonc` (or replace its ID with your own) before deploying.

### Releasing a front-end change
1. Edit the files.
2. If you added a new JS/CSS/data file, add its `<script>`/`<link>` tag to `index.html` **and** its path to `coreAssets` in `sw.js`.
3. If you used a Tailwind class that was not used before, rebuild `css/tailwind.css` (see below).
4. Bump `CACHE_VERSION` in `sw.js`.
5. Deploy.

### Tailwind CSS

The app does not load Tailwind from a CDN. The CDN script (`cdn.tailwindcss.com`) is meant for prototyping only and logs a warning in production, so the utility classes the app uses are compiled into `css/tailwind.css`, which `index.html` links and `sw.js` precaches. Preflight is disabled so it does not reset the styles in `css/main.css`.

Tailwind only includes classes it finds written in the source files, so a brand new class will not work until the file is rebuilt. To rebuild it (needs [Node.js](https://nodejs.org) LTS; run these in PowerShell from the repository root):

1. Install Tailwind once: `npm install tailwindcss@3.4.17`
2. Create `tailwind.config.js` (it is not committed):
   ```js
   module.exports = {
     content: ['./index.html', './js/**/*.js', './news-ticker.js', './viewer.js'],
     theme: { extend: { fontFamily: { sans: ['Plus Jakarta Sans', 'DM Sans', 'system-ui', '-apple-system', 'sans-serif'] } } },
     corePlugins: { preflight: false },
   };
   ```
3. Create `input.css` containing:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```
4. Build: `npx tailwindcss -i input.css -o css/tailwind.css --minify`
5. Commit the new `css/tailwind.css`, then bump `CACHE_VERSION` in `sw.js`.

Do not commit `node_modules/`, `package.json` or `package-lock.json`; they are only needed locally.

---

## Service worker and caching

`sw.js` precaches the app shell (HTML, CSS, JS and `data/questions.js`) on install, caches CDN assets separately, and **bypasses** Firebase, Google APIs and the Worker so live data is never served from cache. Increasing `CACHE_VERSION` creates new caches and removes the old ones.

`cache.addAll` is all-or-nothing: if any path in `coreAssets` returns 404, installation fails. When you rename or delete a file, update that list at the same time.

---

## Security notes

- The Firebase web config in `js/config.js` is public by design; **Firestore security rules and Firebase Auth are what protect your data**. Keep the rules strict (students read and write only what they own; teacher-only collections restricted to the teacher UID).
- Never commit private keys. Worker secrets belong in Cloudflare (`wrangler secret put`), not in the repository.
- User-supplied text is escaped before it is rendered. Question diagrams pass through the SVG allow-list sanitiser described above.
- Lesson content is Markdown rendered through a safe subset.

---

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Blank screen after login | Firestore persistence was enabled or the service worker is stale. Clear site data and reload; see the comment in `js/config.js`. |
| A Tailwind class has no effect | The class is new and `css/tailwind.css` was not rebuilt. See [Tailwind CSS](#tailwind-css). |
| Old code still running after a deploy | `CACHE_VERSION` in `sw.js` was not bumped. |
| Service worker fails to install | A path in `coreAssets` returns 404. |
| "No subjects found for class …" | The student's class name does not match a key in the question bank (`jss1` … `sss3`, `tutorial`). |
| Backend questions don't appear | Check `QuestionLoader.status` in the console. Common causes: empty `questionBank`, Firestore rules deny reads, or a document with no valid questions. The bundled bank is used meanwhile. |
| A diagram shows "Diagram unavailable" | The SVG is malformed, over 60,000 characters, or has no `viewBox` (or numeric `width` and `height`). The console shows the reason. |
| Push notifications don't arrive | Check the VAPID keys, that the Worker's KV binding exists, and that the browser granted notification permission. |

## Phone alerts (opt-in) & Student Settings

Private messages, group chats and game challenges can reach people as phone alerts — **only if they opted in**. Public chat stays in-app only.

| Who | What | Where it is controlled |
|---|---|---|
| Student | Teacher messages | Teacher turns it on per student (**Teacher → Push → Message alerts**, `students/{uid}.dmPushEnabled`). Student can pause it in Settings (`pushPrefs.dm`) |
| Student | Group chats | Per group, in Settings (`pushPrefs.groups.{groupId}`) |
| Student | Game challenges | Settings (`pushPrefs.games`) |
| Student | Daily study reminders | Settings (`pushPrefs.reminders`, on by default) |
| Teacher | Student messages | On by default; master switch + per-student mute in **Push → Message alerts** (stored in KV `tprefs`) |

**How delivery works:** the sender's app calls `POST /api/notify-event` right after sending (instant). The worker re-reads Firestore itself to decide who gets a push, so the caller cannot choose recipients. The existing `*/5 * * * *` cron also sweeps for anything missed. A KV marker per message id prevents duplicates.

**Student Settings** (button on the student dashboard, `js/settings.js`): phone alerts, what should pop up, dark mode, text size, sounds, fewer animations, in-app pop-ups, sign out. Device-look settings are saved on the device; alert choices are saved on the student's account.

**Firestore rules:** students must be able to update `pushPrefs` on their own `students/{uid}` document, and the teacher must be able to update `dmPushEnabled` on any student document. No new secrets or cron triggers are needed — redeploy the worker (`wrangler deploy`) and the site.
