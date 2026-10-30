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
