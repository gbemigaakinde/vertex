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

Limits: media is only captured while the exam page is open; the browser can't force a camera on, so a blocked camera stops the exam from starting.
