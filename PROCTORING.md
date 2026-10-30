# Camera proctoring

Teacher: Tasks > create/edit task > **Camera Proctoring** = Off | Video for the whole exam | Photos at intervals (30s / 1m / 2m / 5m).
Student: must allow the camera before "Begin Exam"; a live preview with a blinking "Recording video" / "Photos being taken" badge stays on screen (bottom-right, smaller on phones) until submission.
Teacher: Results > each result card shows a **Proctoring** link (gallery; video segments and photos load on tap).

## How it works
- Video is recorded in 60-second standalone segments (MediaRecorder; WebM, or MP4 on Safari/iOS), each uploaded as it finishes, so nothing is lost if the device dies. If video is unsupported, it falls back to photos.
- Uploads go to the existing Cloudflare Worker (`worker-proctor.js`) -> Backblaze B2 under `proctor/<uid>/<sessionId>/`, index in Firestore `proctorMedia`. Only the teacher (`TEACHER_UID`) can list/view. Students can only upload to their own session. No new secrets: uses the existing B2_* vars.
- Session id is stored on the result as `proctorSessionId`.

## Deploy
1. `wrangler deploy` (worker.js + worker-proctor.js).
2. Deploy the static site. Browsers need HTTPS for camera access.
3. Firestore rules: collection `proctorMedia` is written only by the Worker (service account); add no client access.
4. Tell students about recording (privacy/consent notice per your school policy).

## Automatic checks and events (new)
- Face checks run on the student's device about once a second using MediaPipe Face Landmarker, self-hosted in `vendor/mediapipe/` (Apache-2.0; works in Chrome, Edge, Firefox and Safari; ~18 MB, downloaded once and cached by the browser; no frames are sent anywhere for analysis). It flags: no face (4 seconds), more than one face (3 seconds), and **looking away** (head turned sideways, up or down, or eyes held to the side, for 4 seconds). Each flag saves an evidence photo.
- If the model cannot load (very old browser, blocked file), it falls back to the browser's FaceDetector if present, then to a covered-camera check only.
- Camera covered or very dark is checked separately.
- Also logged as events: camera stopped/restored, student left/returned to the exam tab, preview panel hidden or removed. They show under "Events to review" in the teacher's Proctoring gallery, and flagged photos can be filtered.
- If the camera stops, a full-screen block appears until it is turned back on (it retries by itself and has a "Turn camera on" button). The exam is not auto-submitted.
- Scheduling runs on a Worker clock, photos and video segments catch up the moment the tab returns, and the current video segment is uploaded as soon as the tab is hidden.
- The preview lives in a closed shadow root, is restored if hidden or removed, and photos are taken from a separate hidden video, so removing the preview does not stop capture.
- The server auto-submit now copies `proctorSessionId` to the result, so the Proctoring link appears there too.

Deploy note: redeploy the Worker (`wrangler deploy`) and the site. Flags use kind `flag` (JSON) in the same `proctorMedia` collection, no new rules or secrets.

Remaining limits (cannot be fully fixed in a browser):
- Detection is a first filter, not proof: faces are counted, not identified, and a glance away shorter than 4 seconds is ignored on purpose to avoid false alarms. Teachers should review flagged items.
- Capture only happens while the exam page is open (a closed tab or a locked phone cannot record).
- A determined student with developer tools can still interfere on their own device. The panel is restored and logged, but only server-side or locked-down exam browsers can fully prevent it.
- The existing tab guard in exam.js (auto-submit after 3 hides) is separate and unchanged.

# Screen capture (independent of the camera)

Teacher: Tasks > create/edit task > **Screen Capture** = Off | Screenshots at intervals (15s / 30s / 1m / 2m) | Screen video for the whole exam. Camera and screen are separate settings, so a task can use camera, screen, both, or neither. Also set **If a student's device can't share its screen** = Block exam (default) | Allow with camera only.

Student: before "Start Exam" a notice lists exactly what is captured (camera and/or entire screen), when, and that only the teacher can view it. Pressing Start opens the browser's share picker (it needs a tap); the student must choose **Entire Screen**. A window or tab is rejected with "Please choose Entire Screen" and the student can try again. The exam never starts without a valid share. During the exam a small "Screen being recorded" badge sits next to the camera panel (bottom-left, never over the AI Tutor button).

If sharing stops (including the browser's "Stop sharing" button) a full-screen block appears: "Screen sharing stopped. Share your entire screen to continue." until an entire-screen share resumes. The real exam timer is never paused. The gap (start, end, length) is logged as events. After a page reload, the same block asks the student to share again.

## What is saved
- Screenshots: kind `screen` (JPEG, max 1280 px wide, quality 0.6, random jitter on timing). Video: kind `screenvideo` (60-second standalone segments, same as camera video). Each kind has its own counter, so camera and screen files never overwrite each other. Stored in B2 under `proctor/<uid>/<sessionId>/` and indexed in Firestore `proctorMedia` (Worker limit about 1.5 MB per screenshot).
- Events, Firestore collection `proctorEvents` (written only by the Worker, endpoint `POST /proctor/event`, a student can only write to their own session): tab hidden/visible, window blur/focus, screen share started/stopped/resumed, camera stopped, unsupported-device decision. When the tab is hidden or the window loses focus an extra screenshot is taken immediately and again about 1.5 seconds later (to show what the student switched to).
- The existing 3-strikes auto-submit in `exam.js` is unchanged; screen capture listens separately.
- The teacher's Proctoring viewer is one time-ordered timeline with tabs All | Camera | Screen | Events. Events are highlighted rows with time and duration. Media loads on tap. `/proctor/list` now also returns events (teacher only).

## Deploy
1. `wrangler deploy` (worker.js + worker-proctor.js) and deploy the site.
2. Firestore rules: collection `proctorEvents` is written only by the Worker (service account); add no client access (same as `proctorMedia`).
3. No new secrets.

## Phones and unsupported browsers
iOS Safari and most Android browsers have no screen sharing. If the device cannot share and the teacher chose **Block exam**, the exam does not start. If the teacher chose **Allow with camera only**, the exam starts with the camera (photos about every 30 seconds if the task had the camera off). The decision is logged as an event (`unsupported_device_blocked` / `unsupported_device_camera_only`).

## Honest limits
- Browsers never allow silent screen capture. A student can refuse or stop sharing; we detect it and block the exam, but we cannot force them to share.
- Entire-screen sharing keeps capturing when the exam is minimized or other windows are on top. A second monitor or a second device is not captured (the browser only shares the one screen the student picks; a second monitor is not captured unless it is the one chosen).
- Phones mostly cannot share their screens.
- Capture quality drops if the browser throttles a hidden tab; the screen stream itself keeps working, but extra screenshots taken while the tab is hidden can be late or repeat the previous frame.
- Browsers that do not report which surface was shared (older Firefox, desktop Safari) cannot be checked for "Entire Screen". Anything the browser reports as a window or a tab is rejected; if it reports nothing, the share is accepted.
- A determined student using developer tools or a second device can still cheat; this reduces casual cheating, it is not proof.
- The offline server auto-submit already copies `proctorSessionId` to the result (worker.js), so the Proctoring link appears there too.
