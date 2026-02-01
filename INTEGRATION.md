# Frontend–Backend Integration Guide

This doc explains how the frontend HTML/JS mates with the backend so you can **save and display data** properly.

---

## Current Data Stores (Important)

| Where | What | Used by |
|-------|------|--------|
| **Firestore** | `User` (auth), `ProfileInfo` (benji_facts, height, weight) | Signup, login, profile page, setup → profileinfo |
| **backend/users.json** | `user_facts` (goals, upcoming_plan, etc.) | `/run`, `/update_facts`, `/goals`, `/upcoming` when looking up by `user_id` |
| **localStorage** | Session, userProfile, benjiAcceptedGoals, check-ins, etc. | All frontend pages when backend isn’t used or as cache |

**Mismatch:** Signup/login use **Firestore** and return a Firestore `user_id`. The backend’s `/run`, `/goals`, and `/update_facts` load `user_facts` from **users.json** via `get_user_by_id(user_id)`. That file only has users created by the old auth, so **Firestore users are not in users.json** and never get server-side persistence for goals/upcoming/run context.

To “mate” frontend and backend properly you have two approaches:

1. **Use Firestore for app data** (recommended): Add Firestore collections for Goals and CheckIns, and new API routes that read/write them. Frontend then saves and loads from these endpoints. See “New Endpoints (Firestore)” below.
2. **Sync Firestore users into users.json**: e.g. on login, call a backend “sync user” endpoint that ensures `users.json` has an entry for that `user_id` with `user_facts`. Then existing `/run`, `/goals`, `/upcoming` persist as they do today.

---

## Backend Endpoints (Existing)

| Method | Path | Request body | Purpose |
|--------|------|--------------|--------|
| POST | `/signup` | `{ first_name, last_name, email, password }` | Create user (Firestore) |
| POST | `/login` | `{ email, password }` | Auth; returns `user_id` (Firestore doc id) |
| GET | `/user/{user_id}` | — | Get name, email (Firestore) |
| GET | `/profileinfo/{user_id}` | — | Get ProfileInfo (Firestore) |
| POST | `/profileinfo/{user_id}` | `{ benji_facts?, height?, weight? }` | Create ProfileInfo |
| PATCH | `/profileinfo/{user_id}` | `{ benji_facts?, height?, weight? }` | Update ProfileInfo |
| POST | `/run` | `{ user_input, user_id?, user_facts? }` | Chat/run agent; loads `user_facts` from users.json if `user_id` present |
| POST | `/goals` | `{ user_goal, user_facts?, user_id? }` | Generate SMART goals; persists to users.json if `user_id` in users.json |
| POST | `/upcoming` | `{ user_facts?, user_id? }` | 2-day plan from goals; persists to users.json if `user_id` in users.json |
| POST | `/update_facts` | `{ user_id, user_facts }` | Merge `user_facts` in users.json (only works for users in users.json) |

---

## New Endpoints (Firestore) – Goals & Check-ins *(implemented)*

So that **Firestore users** can save and load data without touching users.json, the backend exposes:

| Method | Path | Request body | Purpose |
|--------|------|--------------|--------|
| GET | `/goals/{user_id}` | — | Return stored goals for user (Firestore `Goals` collection: `accepted`, `generated`) |
| POST | `/goals/{user_id}/accepted` | `{ goals: [...] }` | Save accepted goals (Firestore) |
| GET | `/checkins/{user_id}` | — | List check-ins for user (Firestore `CheckIns` collection) |
| POST | `/checkins` | `{ user_id, date?, ...checkin_fields }` | Save one check-in (Firestore) |

Then:

- **Setup → ProfileInfo:** Already done in `setup.js` (PATCH/POST `/profileinfo/{user_id}`).
- **Goals:** `goals.html` can call POST `/goals` with `user_goal` + `user_facts` from profile, then POST `/goals/{user_id}/accepted` when the user continues; `index`/home can call GET `/goals/{user_id}` to display.
- **Check-ins:** `check-in.js` can POST to `/checkins` and optionally load from GET `/checkins/{user_id}`.

---

## Frontend → Backend Mapping (By Page)

| Page / JS | What to save | What to load | Endpoints to use |
|-----------|--------------|--------------|-------------------|
| **landing.js** | — | — | POST `/login`, POST `/signup`; store session (e.g. localStorage) with `user_id` |
| **setup.js** | Onboarding (goal, height, weight, etc.) | — | PATCH or POST `/profileinfo/{user_id}` (already used); optionally build `user_facts` for later |
| **goals.html** | Accepted goals | Generated goals (or generate via POST `/goals`) | POST `/goals` with `user_goal` + `user_facts`; GET `/goals/{user_id}` if you store generated; POST `/goals/{user_id}/accepted` on continue |
| **index.js** | — | — | POST `/run` with `user_input`, `user_id`, `user_facts` (from profile/localStorage) |
| **home-dashboard.js** | — | Goals, upcoming, check-in status | GET `/goals/{user_id}` for rings; POST `/upcoming` or GET if you add it; GET `/checkins/{user_id}` for “today done” / history |
| **check-in.js** | Check-in payload | — | POST `/checkins` with `user_id` + check-in data |
| **profile.js** | Profile edits | User + ProfileInfo | GET `/user/{user_id}`, GET `/profileinfo/{user_id}`; PATCH `/profileinfo/{user_id}` on save |
| **medications.js** | Medications list | — | POST `/update_facts` only if user is in users.json; else use Firestore endpoints if you add them |

---

## Shared Frontend API Layer

**`frontend/js/api.js`** provides a single API base URL and session helper:

- **`BenjiAPI.API_BASE`** – `"http://127.0.0.1:8000"` (change if your backend runs elsewhere).
- **`BenjiAPI.getSession()`** – returns `{ user_id, ... }` from localStorage/sessionStorage.
- **Helpers:** `getProfileInfo(userId)`, `updateProfileInfo(userId, payload)`, `postRun(body)`, `postGoalsGenerate(body)`, `getGoals(userId)`, `postGoalsAccepted(userId, goals)`, `getCheckins(userId)`, `postCheckin(body)`.

**Included on:** `index.html` (before other scripts), `goals.html` (before inline script). Other pages (setup, profile, medications) can add `<script src="../js/api.js"></script>` and use `window.BenjiAPI` for consistent base URL and session. You can refactor `index.js` to use `BenjiAPI.postRun()` instead of raw `fetch` for consistency.

---

## How to Display Data Properly

1. **Profile / onboarding**  
   Load with GET `/user/{user_id}` and GET `/profileinfo/{user_id}`. Save with PATCH `/profileinfo/{user_id}`. Setup already sends profile to ProfileInfo; profile page can load from these and show them.

2. **Goals (goals.html)**  
   - On load: GET `/goals/{user_id}`. If you have stored “generated” goals, show them; otherwise call POST `/goals` with `user_goal` (and `user_facts` from profile/localStorage), then show returned `smart_goals`.  
   - On “Continue”: POST `/goals/{user_id}/accepted` with the accepted list. Then redirect to index.

3. **Home dashboard (index.html + home-dashboard.js)**  
   - Replace faux data with: GET `/goals/{user_id}` for goal rings (map backend goal shape to your ring model).  
   - For “today / tomorrow” and check-in status: GET `/checkins/{user_id}` and/or POST/GET `/upcoming` if you expose it.  
   - If backend doesn’t have progress numbers yet, keep local/faux progress or add a separate “progress” API later.

4. **Check-ins**  
   - On submit: POST `/checkins` with `user_id` and the check-in payload.  
   - Optionally load GET `/checkins/{user_id}` to show history or “today completed”.

5. **Chat / run (index.js)**  
   - Keep sending `user_id` and `user_facts` in POST `/run`. If you add a “user_facts from Firestore” endpoint later, you can load that once and pass it as `user_facts` so /run doesn’t depend on users.json.

---

## Summary

- **Auth and profile** are already wired (Firestore + ProfileInfo).  
- **Goals and check-ins** need Firestore-backed endpoints (GET/POST goals, GET/POST checkins) so Firestore users can save and load.  
- **Run/upcoming** work today only for users present in `users.json`; for Firestore-only users, pass `user_facts` from the frontend and optionally add a Firestore-backed “user facts” API later.  
- Use a **shared `api.js`** for base URL and session, and point each page’s save/load at the endpoints above so data is stored and displayed from the backend instead of only localStorage.
