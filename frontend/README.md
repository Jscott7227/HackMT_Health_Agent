# Frontend Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture Patterns](#architecture-patterns)
3. [Page-by-Page Reference](#page-by-page-reference)
4. [JavaScript Modules Reference](#javascript-modules-reference)
5. [Shared API Layer](#shared-api-layer)
6. [Firebase Integration](#firebase-integration)
7. [Component System](#component-system)
8. [State Management](#state-management)
9. [Input Validation](#input-validation)
10. [Security](#security)
11. [CSS Architecture](#css-architecture)
12. [Development Setup](#development-setup)

---

## Overview

The `frontend/` directory implements the complete user interface for Wellness Sanctuary with Benji. It is a **static HTML/JS application** — no build step, no framework, no compilation required. Pages are served directly from the filesystem or any static file server.

### Design Philosophy

- **Vanilla JavaScript** — no React, Vue, or Angular. Every page has a dedicated JS controller that handles DOM, API calls, and UI logic. This keeps the codebase accessible and deployable without a build pipeline.
- **Modular by page** — one JS controller per HTML page. Logic is scoped to the page it serves, not shared across unrelated pages.
- **Shared API layer** — all pages use `api.js` as the single source of truth for backend calls. Base URL, session retrieval, and request configuration are defined once.
- **Firebase Client SDK** — authentication and session management run through Firebase Auth in the browser.
- **No secrets in frontend code** — API keys and credentials are never in frontend JS. Firebase config uses the public client config (not service account credentials).

### Directory Structure

```
frontend/
├── html/          # 20 HTML pages
├── js/            # 23 JavaScript modules
├── css/           # Stylesheets
├── components/    # Reusable HTML/JS components
└── assets/
    └── img/       # Benji mascot, logos, icons
```

---

## Architecture Patterns

### Page Controller Pattern

Each HTML page has a corresponding JS controller file that owns all logic for that page:

```
landing.html      ↔   js/landing.js
setup.html        ↔   js/setup.js
index.html        ↔   js/home-dashboard.js
goals.html        ↔   js/goals.js
chat.html         ↔   js/chat.js
profile.html      ↔   js/profile.js
medications.html  ↔   js/medications.js
menstrual.html    ↔   js/menstrual.js
insights.html     ↔   js/insights.js
settings.html     ↔   js/settings.js
targetedgoal.html ↔   js/targetedgoal.js
journal.html      ↔   js/journal.js
```

**Controller responsibilities:**
1. DOM initialization and event listener binding on `DOMContentLoaded`
2. Session validation (redirect to `landing.html` if not authenticated)
3. API calls via `BenjiAPI.*` methods
4. UI state management (loading states, error display, content rendering)
5. User feedback (alerts, modals, inline messages)

### Shared API Abstraction

All HTTP calls go through the `BenjiAPI` global object defined in `js/api.js`. Controllers never call `fetch()` directly — they call `BenjiAPI.getGoals()`, `BenjiAPI.postCheckin()`, etc. This means the backend base URL is configured in exactly one place.

### Component Injection

The top navigation bar is a shared HTML component (`components/topbar.html`) loaded by `components/topbar.js` via DOM injection. Each page that uses the nav includes the topbar script and calls the injection function after page load.

---

## Page-by-Page Reference

### `landing.html` — Entry / Authentication

**Purpose:** The application entry point. Handles login, signup, and routing to the correct page after authentication.

**Key behaviors:**
- Checks for existing session in `localStorage` / `sessionStorage`; redirects authenticated users to `index.html`
- Login form: collects email and password, calls `POST /login`
- Signup form: collects name, email, password, calls `POST /signup`
- Successful auth stores session (`user_id`, display name) in `sanctuary_session`
- Password reset link routes to `forgot-password.html`

**JS controller:** `js/landing.js`

---

### `setup.html` — Profile Onboarding

**Purpose:** Multi-step profile creation wizard for new users. Collects all data Benji needs for personalization.

**Steps:**
1. General info (name, gender, height, weight, busyness, routine, accountability)
2. Diet preference (Open / Vegetarian / Vegan / Keto)
3. Fitness level (cardio, muscle mass, strength experience, frequency, injury history)
4. Wellness (sleep quality, duration, emotional stability)
5. Optional mental health questionnaire

**Key behaviors:**
- Step-by-step progression with validation before advancing
- Mental health questionnaire is opt-in — user is asked before loading those questions
- On completion: calls `POST /profileinfo/{user_id}` to save profile, then routes to `index.html`

**JS controller:** `js/setup.js`

---

### `index.html` — Home Dashboard

**Purpose:** The main application hub. Displays goal progress, today's plan, check-in status, trends, and medication preview.

**Key sections:**
- Goal progress rings (one per active goal, timeline-based %)
- Today's / tomorrow's plan pulled from accepted goals + upcoming plan
- Recovery day messaging when applicable
- Check-in prompt banner (if today's check-in not yet submitted)
- Week at a Glance summary (rest day, today's rating, goal score averages)
- Trend section: Benji's notes on the past 3 check-ins
- Medication schedule preview (next upcoming medications)

**Daily check-in modal:**
- Triggered from the prompt banner
- Dynamically loads goal-type-specific fields based on the user's active goals
- Calls `POST /checkins` on submit
- After submission, calls `POST /checkin-sense` to generate "Benji's Notes"
- Calls `POST /checkin-recommendations` to pre-load focus areas

**JS controller:** `js/home-dashboard.js` (check-in logic: `js/check-in.js`)

---

### `goals.html` — Goal Management

**Purpose:** Create, view, and manage fitness and wellness goals.

**Key behaviors:**
- Displays all active goals with progress rings and plan previews
- "Create goal" flow: user enters natural-language goal description → calls `POST /goals` → Gemini generates SMART goals → user reviews and accepts → calls `POST /goals/{user_id}/accepted`
- Upcoming plan generation: calls `POST /upcoming` after goals are accepted
- Goal cards show: progress %, today/tomorrow plan, weekly recap summary

**JS controller:** `js/goals.js`

---

### `chat.html` — AI Chat Interface

**Purpose:** Full conversational interface with Benji.

**Key behaviors:**
- Chat history loaded from Firestore on page load (`GET /chat-history/{user_id}`)
- User messages sent via `POST /chat`; Benji responses rendered in the chat thread
- Context-aware: user profile and goals are passed with each request
- Scope-constrained: Benji redirects off-topic questions politely

**JS controller:** `js/chat.js`

---

### `profile.html` — User Profile Editor

**Purpose:** View and edit all profile fields set during onboarding.

**Key behaviors:**
- Loads current profile via `GET /profileinfo/{user_id}`
- All fields editable inline; changes saved via `PATCH /profileinfo/{user_id}`
- Height, weight, diet, fitness levels, wellness scores, injury history — all editable

**JS controller:** `js/profile.js`

---

### `medications.html` — Medication Manager

**Purpose:** Track medications and view AI-generated daily schedule.

**Key behaviors:**
- Lists all medications from `GET /medications/{user_id}`
- Add medication form: name, strength, frequency → saves via `PUT /medications/{user_id}`
- "Benji's suggested schedule" button triggers `GET /medication-schedule/{user_id}?use_ai=true`
- AI schedule result is cached in `localStorage` (key: `Benji_medication_schedule_ai_cache_{userId}`) so the agent doesn't re-run on every load
- Schedule displayed with time slots (morning / afternoon / evening / night), food instructions, warnings
- Compliance tracking: daily adherence logged via `POST /compliance`

**JS controller:** `js/medications.js`

---

### `menstrual.html` — Cycle Tracking

**Purpose:** Log menstrual cycle data and receive phase-aware fitness/nutrition recommendations.

**Key behaviors:**
- Current log loaded via `GET /menstrual/{user_id}`
- Update form: cycle day, flow, symptoms, cramp level, discharge type, OCP use → saved via `PUT /menstrual/{user_id}`
- "Get Benji's recommendations" button calls `GET /menstrual-recommendations/{user_id}`
- Recommendations cached in `localStorage` (key: `Benji_cycle_recommendations_cache_{userId}`)
- Phase detection and recommendations displayed in a structured card view

**JS controller:** `js/menstrual.js`

---

### `insights.html` — Analytics & Trends

**Purpose:** Historical trends and analytics across check-ins, goals, and wellness metrics.

**Key behaviors:**
- Loads all check-ins via `GET /checkins/{user_id}`
- Renders score trend charts (day score, sleep, fitness, wellness over time)
- Weekly summaries and AI-generated insights

**JS controller:** `js/insights.js`

---

### `journal.html` — Notes / Journaling

**Purpose:** Free-form journaling and personal notes.

**JS controller:** `js/journal.js`

---

### `settings.html` — App Settings

**Purpose:** Application preferences and account settings.

**JS controller:** `js/settings.js`

---

### `targetedgoal.html` — Goal Detail View

**Purpose:** Deep-dive view for a single goal: full plan timeline, milestone tracking, weekly recap, chatbot.

**JS controller:** `js/targetedgoal.js`

---

### Auth Pages

| Page | Purpose | JS Controller |
|------|---------|--------------|
| `forgot-password.html` | Request password reset email | `js/forgot-password.js` |
| `reset-password.html` | Complete password reset with token | `js/reset-password.js` |
| `verify-email.html` | Email verification flow | (inline or shared) |

---

### Static / Informational Pages

| Page | Purpose |
|------|---------|
| `about.html` | About the project and team |
| `privacy.html` | Privacy policy |
| `terms.html` | Terms of service |
| `404.html` | Custom 404 error page |

---

## JavaScript Modules Reference

### `api.js` — Shared API Layer

**Purpose:** Defines the global `BenjiAPI` object used by all pages for backend communication.

See [Shared API Layer](#shared-api-layer) section for full documentation.

---

### `auth.js` — Firebase Auth Integration

**Purpose:** Firebase Auth client-side setup and helpers.

---

### `home-dashboard.js` — Dashboard Controller

**Purpose:** Orchestrates the home dashboard — loads and renders goals, upcoming plan, check-in status, trends, and medication preview.

**Key functions:**
- `initDashboard()` — Entry point; validates session, fetches all dashboard data
- `renderGoalRings(goals)` — Draws progress rings for each active goal
- `renderTodayTomorrow(plan)` — Renders the upcoming plan preview section
- `renderTrendSection(checkins)` — Shows past 3 check-in scores with Benji's notes
- `renderMedicationPreview(schedule)` — Shows next scheduled medications

---

### `check-in.js` — Daily Check-in Controller

**Purpose:** Manages the daily check-in modal, including dynamic goal-type-specific fields.

**Key functions:**
- `loadCheckinModal()` — Builds the modal form based on the user's active goal types
- `submitCheckin(data)` — Calls `POST /checkins` and then `POST /checkin-sense`
- `renderBenjiNotes(notes)` — Displays "Benji's Notes" after submission

---

### `goals.js` — Goal Management Controller

**Purpose:** Goal creation, review, acceptance, and plan generation.

**Key functions:**
- `loadGoals()` — Fetches and renders all active goals
- `createGoal(description)` — Calls `POST /goals` to generate SMART goals
- `acceptGoals(goals)` — Calls `POST /goals/{user_id}/accepted`
- `generateUpcomingPlan()` — Calls `POST /upcoming` after acceptance

---

### `chat.js` — Chat Controller

**Purpose:** Conversational AI chat interface.

**Key functions:**
- `loadChatHistory()` — Fetches history from `GET /chat-history/{user_id}`
- `sendMessage(text)` — Calls `POST /chat` and appends the response to the thread
- `renderMessage(role, content)` — Renders a message bubble in the chat UI

---

### `medications.js` — Medication Manager Controller

**Purpose:** Medication CRUD and schedule display.

**Key functions:**
- `loadMedications()` — `GET /medications/{user_id}`
- `saveMedication(med)` — `PUT /medications/{user_id}`
- `loadAiSchedule()` — Checks localStorage cache first; calls API if stale
- `renderSchedule(schedule)` — Renders time-slotted schedule with warnings

---

### `menstrual.js` — Cycle Tracking Controller

**Purpose:** Menstrual log management and phase-aware recommendations.

**Key functions:**
- `loadCycleLog()` — `GET /menstrual/{user_id}`
- `saveLog(data)` — `PUT /menstrual/{user_id}`
- `loadRecommendations()` — Checks cache; calls `GET /menstrual-recommendations/{user_id}` if needed
- `renderPhaseCard(data)` — Renders current phase + recommendations

---

### `setup.js` — Onboarding Controller

**Purpose:** Multi-step profile creation wizard.

**Key functions:**
- `initWizard()` — Sets up step progression and validation
- `advanceStep(stepIndex)` — Validates current step before progressing
- `submitProfile(data)` — Calls `POST /profileinfo/{user_id}`

---

### `profile.js` — Profile Editor Controller

**Purpose:** Load and save profile data.

**Key functions:**
- `loadProfile()` — `GET /profileinfo/{user_id}`
- `saveProfile(updates)` — `PATCH /profileinfo/{user_id}`

---

### `insights.js` — Analytics Controller

**Purpose:** Historical data visualization and trend analysis.

**Key functions:**
- `loadCheckinHistory()` — `GET /checkins/{user_id}`
- `renderCharts(data)` — Renders score trend charts

---

### `landing.js` — Entry Page Controller

**Purpose:** Authentication flow — login, signup, session routing.

**Key functions:**
- `checkExistingSession()` — Redirects authenticated users to `index.html`
- `handleLogin(email, password)` — Calls `POST /login`
- `handleSignup(data)` — Calls `POST /signup`

---

### `agent.js` — Agent Runner

**Purpose:** Directly invokes the `/run` endpoint for agentic responses outside the chat interface.

---

### `app.js` — Application Initialization

**Purpose:** Global app bootstrap and shared utilities.

---

### `ui.js` — Shared UI Helpers

**Purpose:** Reusable UI functions used across controllers (loading spinners, error banners, modal helpers).

---

### `targetedgoal.js` — Goal Detail Controller

**Purpose:** Deep-dive view for a single goal with full plan timeline and milestone tracking.

---

### `index.js` — Index Bootstrap

**Purpose:** Entry initialization for `index.html`.

---

### Auth JS Files

| File | Purpose |
|------|---------|
| `forgot-password.js` | Handles password reset request form |
| `reset-password.js` | Handles password reset completion |
| `privacy.js` | Privacy page utilities |

---

## Shared API Layer

`js/api.js` exports a global `BenjiAPI` object (attached to `window`) used by all page controllers. It is the **only place** where the backend base URL is defined.

### Configuration

```javascript
var API_BASE = "http://127.0.0.1:8000";  // Change this for production
```

### Session Retrieval

```javascript
BenjiAPI.getSession()
// Returns parsed session object from localStorage ("sanctuary_session")
// or sessionStorage, or null if not authenticated
```

### Request Method

All API calls use an internal `request(path, options)` function that:
- Prepends `API_BASE` to relative paths
- Sets `Content-Type: application/json` by default
- JSON-stringifies object request bodies
- Returns a `fetch()` Promise

### Available Methods

| Method | Endpoint | Description |
|--------|----------|-------------|
| `getProfileInfo(userId)` | `GET /profileinfo/{user_id}` | Get user's profile |
| `updateProfileInfo(userId, payload)` | `PATCH /profileinfo/{user_id}` (falls back to `POST` on 404) | Save profile updates |
| `getGoals(userId)` | `GET /goals/{user_id}` | Get accepted + generated goals |
| `postGoalsAccepted(userId, goals)` | `POST /goals/{user_id}/accepted` | Save accepted goals |
| `postGoalsGenerate(body)` | `POST /goals` | Generate SMART goals via LLM |
| `postRun(body)` | `POST /run` | Run full agentic response |
| `postUpcoming(body)` | `POST /upcoming` | Generate 2-day plan |
| `getCheckins(userId)` | `GET /checkins/{user_id}` | Get all check-ins |
| `postCheckin(body)` | `POST /checkins` | Save a check-in |
| `postCheckinRecommendations(body)` | `POST /checkin-recommendations` | Get focus areas for check-in |
| `postCheckinSense(body)` | `POST /checkin-sense` | Get "Benji's Notes" post-submission |
| `getMedicationSchedule(userId, useAi)` | `GET /medication-schedule/{user_id}` | Get medication schedule |
| `getCycleRecommendations(userId)` | `GET /menstrual-recommendations/{user_id}` | Get phase-aware recommendations |

### AI Result Caching

Two sets of localStorage-cached AI results prevent unnecessary re-runs:

**Medication schedule cache:**
- Key: `Benji_medication_schedule_ai_cache_{userId}`
- Methods: `getCachedAiSchedule()`, `setCachedAiSchedule()`, `clearCachedAiSchedule()`

**Cycle recommendations cache:**
- Key: `Benji_cycle_recommendations_cache_{userId}`
- Methods: `getCachedCycleRecommendations()`, `setCachedCycleRecommendations()`, `clearCachedCycleRecommendations()`

---

## Firebase Integration

### Firebase Auth (Client Side)

Firebase Auth handles user signup, login, and session management in the browser.

**Session storage pattern:**
- After successful login (`POST /login` or `POST /signup`), the backend returns a `user_id`
- The frontend stores this in a `sanctuary_session` object: `{ user_id, display_name }`
- Stored in `localStorage` for "remember me" or `sessionStorage` for session-only
- All page controllers call `BenjiAPI.getSession()` on load and redirect to `landing.html` if null

**Token flow:**
- Firebase issues ID tokens client-side
- For operations requiring identity verification, the frontend passes `user_id` in the request body
- The backend verifies ownership against the authenticated session context

### Firestore Client SDK

The frontend does not currently use the Firestore Client SDK directly — all Firestore reads/writes go through the FastAPI backend, which uses the Admin SDK.

This is intentional: the backend validates all requests and applies business logic before persisting data, rather than allowing direct client writes to Firestore.

---

## Component System

### Topbar Navigation (`components/topbar.html` + `components/topbar.js`)

The application navigation bar is a shared HTML fragment injected into pages at runtime.

**Structure:**
- App logo / Benji branding
- Navigation links: Home, Goals, Chat, Medications, Menstrual, Journal, Insights, Profile, Settings
- Logout button

**Injection pattern:**
- `topbar.js` defines an `injectTopbar(targetSelector)` function
- Each page calls this after `DOMContentLoaded`
- The topbar HTML is fetched and inserted into the designated container element
- Active page highlighting is applied based on the current URL path

---

## State Management

The application uses browser storage for client-side state — there is no global state manager or store.

### `localStorage` (persistent across sessions)

| Key | Contents | Managed by |
|-----|----------|-----------|
| `sanctuary_session` | `{ user_id, display_name }` | `landing.js` on login |
| `Benji_medication_schedule_ai_cache_{userId}` | Last AI medication schedule result | `medications.js` |
| `Benji_cycle_recommendations_cache_{userId}` | Last cycle recommendation result | `menstrual.js` |

### `sessionStorage` (cleared on tab close)

| Key | Contents |
|-----|----------|
| `sanctuary_session` | Session when "remember me" is not selected |

### In-memory (page lifetime)

Each controller maintains local variables for data fetched from the API (goals list, check-in array, profile object, etc.). These are re-fetched on each page load — there is no cross-page in-memory state.

---

## Input Validation

Client-side validation runs before any API call is made, providing immediate user feedback and reducing invalid requests to the backend.

### General Patterns

- **Required fields:** Checked via `!value || value.trim() === ""` before form submission
- **Numeric ranges:** Score inputs (1–5, 1–10, 0–10) validated against min/max before submission
- **Multi-step wizard:** Each wizard step validates its fields before `advanceStep()` proceeds
- **Error display:** Inline error messages rendered below invalid fields; form is not submitted until validation passes

### Goal-type Fields

The check-in modal dynamically renders goal-specific fields. Each rendered set is validated independently — only fields visible for the user's active goal types are required.

### API Error Handling

All `BenjiAPI` calls use `.then()` / `.catch()` chains:
- `catch(err)` displays a user-facing error message (banner or alert)
- 404 responses on GET calls (e.g., `getGoals`, `getCheckins`) return empty defaults rather than throwing, so pages load cleanly for new users

---

## Security

### No Secrets in Frontend Code

The frontend does not contain any Firebase service account credentials, Gemini API keys, or backend secrets. Firebase Auth uses the public client configuration (API key, project ID, etc.) — these are safe to expose in client-side code and are locked down by Firebase security rules.

### Session Handling

- Sessions are stored as plain JSON in `localStorage` / `sessionStorage` — they contain only `user_id` and display name, not authentication tokens
- Actual identity verification happens server-side: the backend verifies `user_id` ownership on all protected operations

### XSS Awareness

- User-generated content rendered into the DOM uses `textContent` assignment rather than `innerHTML` where possible to prevent XSS injection
- Score inputs are validated as integers before use — raw user strings are not evaluated or injected

### HTTPS (Production)

All API calls use `http://127.0.0.1:8000` in development. In production, `API_BASE` in `api.js` must be updated to an `https://` URL to ensure transport security.

---

## CSS Architecture

### Files

| File | Purpose |
|------|---------|
| `css/styles.css` | Main application stylesheet — global layout, typography, component styles |
| `css/additional-styles.css` | Extended styles — page-specific overrides, feature additions |

### Design Approach

- Mobile-responsive layout using CSS flexbox and media queries
- Benji brand colors applied consistently across components
- Modals (check-in, goal creation) use overlay + card pattern with scroll support for long forms
- Progress rings use SVG `stroke-dasharray` / `stroke-dashoffset` for animated completion display
- Loading states use CSS class toggling (`.loading`, `.hidden`) to show/hide UI elements

---

## Development Setup

### Serving the Frontend Locally

The frontend requires no build step. Options:

**Option 1: Open directly**
```
Open frontend/html/landing.html in a browser
```
Note: Some browsers block cross-origin requests from `file://` URLs. Use a local server for full functionality.

**Option 2: Python static server**
```bash
cd frontend
python -m http.server 3000
# Visit: http://localhost:3000/html/landing.html
```

**Option 3: VS Code Live Server**
- Install the Live Server extension
- Right-click `landing.html` → Open with Live Server

### Backend Requirement

The frontend requires the backend to be running. Set up and start the backend first:
```bash
python -m uvicorn backend.app.main:app --reload
```

The `API_BASE` in `js/api.js` defaults to `http://127.0.0.1:8000` — this matches the default uvicorn address.

### Updating the API Base URL

For staging or production, edit `js/api.js`:
```javascript
var API_BASE = "https://your-production-api.example.com";
```

This is the only change needed to point the entire frontend at a different backend.
