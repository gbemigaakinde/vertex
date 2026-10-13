# File manager: deployment steps

## 1. Deploy the Worker
`wrangler.jsonc` now declares the `UPLOAD_QUOTA` Durable Object (SQLite-backed) and its migration, so a normal `wrangler deploy` creates it. Existing secrets (`TEACHER_UID`, `B2_*`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) are reused; nothing new is required.

## 2. Firestore rules (add to your existing rules; keep your current read rules)
All writes to `uploads`, `userFolders` and `userCollections` now go through the Worker (service account, bypasses rules). Block client writes so quotas cannot be bypassed:

```
match /uploads/{id} {
  allow read: if request.auth != null;      // keep whatever read rule you already use
  allow create, update, delete: if false;   // Worker only
}
match /userFolders/{id} {
  allow read: if request.auth != null && resource.data.ownerUid == request.auth.uid;
  allow write: if false;
}
match /userCollections/{id} {
  allow read: if request.auth != null && resource.data.ownerUid == request.auth.uid;
  allow write: if false;
}
```

## 3. Indexes
No composite indexes are needed (single-field equality / orderBy queries only).

## Notes
- Student limit: 50 files/day (Africa/Lagos day), counted per file by a Durable Object. Size caps: 20 MB, 30 MB for video. Teachers have no app-imposed limit.
- Objects are never moved or renamed; folders/collections are metadata. Deleting a file removes the stored object only when no other record references it.
- Existing files keep working (new fields `folderId` / `collectionId` default to none = "My Files").
