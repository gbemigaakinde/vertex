# Vertex Live Meetings (LiveKit, free tier)

Google-Meet-style classes: camera/mic, screen share, chat, raise hand, people list, teacher controls (mute all, remove, record, end) and replay.

Only the teacher (TEACHER_UID) can create/start/end meetings. A student can see or join a meeting only if it targets all students, their class, or their uid (checked on the Worker from the verified Firebase token).

## Setup (no coding)
1. Free LiveKit Cloud project: https://cloud.livekit.io (no card). Settings > Keys > create key.
2. Cloudflare dashboard > Workers > vertex-worker > Settings > Variables and Secrets. Add THREE **Secrets**:
   LIVEKIT_URL (wss://...livekit.cloud), LIVEKIT_API_KEY, LIVEKIT_API_SECRET
3. Firebase > Firestore > Rules: paste the provided rules (adds the locked `meetings` collection) and Publish.
4. Upload these files to GitHub (same paths). The site and Worker redeploy.

## How recording works
The teacher's browser records the room (video grid + mixed audio) and uploads 4-minute chunks to your B2 bucket (meetings/<id>/rec/). This does NOT use LiveKit's 60-minute recording quota. Replay streams the chunks back as one video (Chrome/Edge/Firefox/Android; limit 160 min per meeting). Teacher must keep the tab open and use Chrome/Edge on a computer to record.

## Files
meet/meet.js, meet/meet.css (front end), meet/worker-meet.js (API: /meet/op, /meet/upload, /meet/stream), meet/vendor/livekit-client.umd.js (self-hosted SDK)
