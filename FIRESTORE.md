# Firestore setup for Benji

This app uses **Firestore** with database id **`benji`** (not the default `(default)`). All backend access uses the Firebase Admin SDK (service account), which bypasses security rules.

## Collections

| Collection              | Document ID        | Purpose                          |
|-------------------------|--------------------|----------------------------------|
| `User`                  | auto or user id    | User accounts                    |
| `ProfileInfo`           | user id            | Profile / user_facts             |
| `CheckIns`              | auto               | Daily check-ins (field: UserID)  |
| `Goals`                 | user id            | User goals                       |
| `ChatHistory`           | user id            | Chat messages                    |
| `Medications`           | user id            | Medication list                 |
| `MedicationCompliance`  | `{user_id}_{date}` | Daily compliance (field: user_id)|
| `debug`                 | e.g. api_health    | Internal / health checks        |

## Deploy rules and indexes

### Option A: Firebase Console (no CLI)

1. Open [Firebase Console](https://console.firebase.google.com/) → your project → **Firestore**.
2. Select the database **benji** (if you have multiple databases).
3. **Rules**
   - Go to the **Rules** tab.
   - Replace the rules with the contents of `firestore.rules` in this repo.
   - Publish.
4. **Indexes**
   - Go to the **Indexes** tab.
   - If Firestore prompts you to create an index (e.g. after a failed query), use the link it gives you, or create a composite index manually:
     - **Collection:** `MedicationCompliance`
     - **Fields:** `user_id` (Ascending), `date` (Descending)
   - For CheckIns by user + time: `UserID` (Ascending), `createdAt` (Descending).

### Option B: Firebase CLI

1. Install: `npm install -g firebase-tools` (or use `npx`).
2. Log in: `firebase login`.
3. In the project root (where `firestore.rules` and `firestore.indexes.json` are):
   - `firebase use <your-project-id>`
   - If you use database **benji**, create `firebase.json` and `.firebaserc` so Firestore targets that database. Example `firebase.json`:
     ```json
     {
       "firestore": {
         "rules": "firestore.rules",
         "indexes": "firestore.indexes.json"
       }
     }
     ```
   - Deploy: `firebase deploy --only firestore`.
4. Note: With a **named** database (`benji`), you may need to specify it in `firebase.json` under `firestore` (e.g. `"database": "benji"`) depending on your Firebase CLI version. If deploy uses the default database, apply rules/indexes for **benji** manually in the Console as in Option A.

## Security rules

- **User**, **ProfileInfo**, **Goals**, **ChatHistory**, **Medications**: read/write only when `request.auth.uid` equals the document id (one doc per user).
- **CheckIns**: read/write only when `UserID` equals `request.auth.uid`.
- **MedicationCompliance**: read/write only when the document’s `user_id` equals `request.auth.uid`.
- **debug**: no client access (`allow read, write: if false`).

These rules apply to client SDK usage and Console usage. The FastAPI backend uses the Admin SDK and is not restricted by rules.

## Indexes and backend behavior

- The backend currently **avoids** using `order_by("date")` on `MedicationCompliance` so the app works without a composite index (results are sorted in Python).
- After you create the composite index on `MedicationCompliance` (`user_id` + `date` descending), you can change the backend to use Firestore’s `order_by("date", direction=DESCENDING)` again for better performance at scale (fewer documents read). The same applies to CheckIns if you add ordering by `createdAt`.
