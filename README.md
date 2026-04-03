# Wellness Sanctuary with Benji

## About The Project

Wellness Sanctuary with Benji is an AI-powered health and wellness coaching platform built for the 2026 MTSU Hackathon. Benji is an agentic AI that acts as a personal trainer, wellness advocate, and daily accountability partner — adapting to each user's goals, fitness level, circumstances, and progress over time.

The platform was built in 72 hours as a hackathon prototype and has continued development post-event. It demonstrates a full agentic AI architecture: user context flows into Gemini 2.5 Pro as the reasoning engine, which produces personalized recommendations, plans, and insights tailored to the individual.

### What Makes It Agentic

Most fitness apps give generic content. Benji is different: it knows who you are. Your profile, goals, check-in history, medication list, and menstrual cycle data are all loaded as context before the AI responds. The model doesn't just answer — it reasons across your situation, calls structured tools to compute stats and plans, and returns output that is specific to you.

### Live URL

> Deployment in progress — production URL will be linked here on launch.

---

## Hackathon Context

| Field | Details |
|---|---|
| **Event** | MTSU 2026 Hackathon |
| **Dates** | January 30 – February 1, 2026 (72 hours) |
| **Team Size** | 5 members |
| **Outcome** | Functional prototype delivered; ongoing development post-hackathon |

The hackathon was a 3-day competition. The team built the entire platform — frontend, backend, AI agent, Firebase integration, and security layer — within the event window. Development has continued since.

---

## The Problem We Solve

- **Generic apps don't adapt to the individual.** Most fitness and wellness tools offer the same plans to everyone, regardless of injury history, schedule, fitness level, or goals.
- **Consistency and accountability are hard to maintain alone.** People benefit from a coach who checks in, notices trends, and adjusts recommendations based on what's actually happening.
- **Access to personalized coaching is limited.** A dedicated personal trainer or wellness coach is expensive and not always available. An AI that knows your history and goals can fill that gap 24/7.
- **Health is multidimensional.** Fitness, nutrition, sleep, stress, medications, and menstrual health all interact — but most apps treat these as separate silos.

---

## Solution Overview

Benji unifies health tracking and personalized AI coaching into one platform. The data flow is:

```
User provides context (profile, goals, check-ins)
          ↓
   Frontend (HTML/JS)
          ↓
   Backend API (FastAPI/Python)
          ↓
   Firestore (user data + history)
          ↓
   Gemini 2.5 Pro (agentic reasoning + tools)
          ↓
   Personalized recommendations, plans, insights
          ↓
   Response returned to frontend
```

Gemini 2.5 Pro serves as the "brain" — it receives the user's full context, invokes structured tool functions to compute stats and plans, and synthesizes everything into clear, actionable output. This is not a chatbot with a prompt — it is an agent with persistent user context and a toolset.

---

## Core Features

### 1. User Profile & Onboarding

A comprehensive onboarding flow captures everything Benji needs to personalize recommendations:

**General**
- Name, gender, height, weight
- Busyness level (1–5), routine stability (1–5), accountability preference (1–5)
- Lifestyle choices (caffeine, alcohol use, etc.)

**Diet**
- Open, Vegetarian, Vegan, or Keto

**Fitness Level**
- Cardio and activity level (1–5), cardio training experience
- Muscle mass (1–5), strength training experience, workout frequency
- Injury history with description

**Wellness**
- Sleep quality (1–5), average sleep duration
- Emotional stability (1–5)
- Optional mental health questionnaire (user-controlled — prompted at profile creation)

---

### 2. Daily Check-in

A structured daily check-in captures what actually happened and drives trend analysis and AI insights.

**Core check-in fields:**
- Overall day rating (1–10) with optional notes
- Relevant tags: Academics, Relationships, Work, etc.
- Eat, Drink, Sleep quality scores (1–5)
- Overall fitness check-in (1–5)
- Recovery Day toggle — skips fitness fields when active

**Goal-type–specific check-in fields:**

| Goal Type | Additional Fields |
|-----------|------------------|
| Weight Loss | Caloric intake |
| Weight Gain | Caloric intake (above maintenance) |
| Body Recomposition | Calories, protein, carbs, fats, fiber, hydration |
| Muscle / Strength | Calories, protein, carbs, fat, hydration |
| Cardio / Endurance | Activity type, volume, distance, pace, intensity (1–5) |
| General Maintenance | Activity method, training type, daily weight |
| Mobility / Flexibility | Sessions, tightness/stiffness/soreness (1–5), pain level, ROM notes |
| Injury / Recovery | Pain intensity (1–10), location, type, frequency, stiffness, activity tolerance, rehab adherence, flare-up events |
| Performance / Sport | Minutes trained, intensity, difficulty, soreness, fatigue, stress, mood |

After a check-in is submitted, Benji generates 2–4 personalized "Benji's Notes" — AI-driven insights that correlate the day's scores with the user's active goals.

---

### 3. Fitness Goal Planning

**Goal creation:**
- User provides a goal description in natural language
- Benji (via `BenjiGoalsTool`) generates 1–3 SMART goals: Specific, Measurable, Attainable, Relevant, Time-bound
- Each goal includes a computed end date based on `Duration_Days`
- User reviews and accepts goals

**Supported fitness goal types:**
- Weight loss
- Weight gain
- Body recomposition
- Muscle / strength training
- Cardio / endurance
- General body maintenance
- Mobility / flexibility
- Injury recovery / pain reduction
- Performance / sport-specific

**Upcoming plan generation:**
- `UpcomingPlanTool` generates a 2-day actionable schedule directly tied to the user's accepted SMART goals
- Activities are realistic, goal-driven, and adjusted to the user's fitness level

**Goal overview:**
- Progress ring (timeline-based completion %)
- Today's and tomorrow's plan preview
- Weekly recap with scores graph and AI recommendations
- Diet summary for nutrition-related goals
- Goal-specific chatbot helper

---

### 4. Wellness Goals

Separate from fitness goals, wellness goals track mental health, stress, and overall wellbeing:

- Goal description and timeline
- Trend analysis over the past 3 days
- AI-generated suggestions for improvement
- Weekly recap with summary scores, graph, and recommendations
- Emotional summary: AI assesses whether mood trends require attention

---

### 5. Home Dashboard

The home screen aggregates everything into a unified daily view:

- **Goal progress rings** — one per active goal, showing timeline completion %
- **Today's / Tomorrow's plan preview** — pulled from the most recent upcoming plan
- **Recovery day messaging** — hydration and nutrition reminders when applicable
- **Injury / soreness notice** — shown when injury history or prior soreness is logged
- **Week at a Glance** — rest day status, today's rating, goal score averages
- **Trend section** — past 3 days; Benji flags issues (e.g., consistently low sleep)
- **Medication schedule preview** — next scheduled medications
- **Check-in prompt** — reminder banner when today's check-in hasn't been submitted

---

### 6. Medication Manager

Benji tracks the user's medications and builds a personalized, safe daily schedule.

**Input per medication:**
- Drug name
- Strength (e.g., 10 mg, 500 mg)
- Frequency (e.g., twice daily, every 8 hours, with breakfast)

**AI-driven scheduling:**
- `MedicationScheduleAgentTool` generates a time-slotted schedule (morning / afternoon / evening / night)
- Respects contraindications: drug–drug interactions (spacing or avoidance), food interactions (take with meals / on empty stomach)
- Checks for known conflicts via `ContraindicationCheckTool`
- Formats output with time slots, food instructions, spacing notes, and safety warnings
- Always recommends consulting a healthcare provider; never provides dosing advice

**Compliance tracking:**
- Daily compliance records stored per user per date
- `GET /compliance/{user_id}` retrieves compliance history
- `POST /compliance` submits today's adherence

---

### 7. Menstrual Cycle Tracking

Benji provides phase-aware fitness and wellness recommendations based on cycle data.

**Input fields:**
- Current cycle day
- Flow intensity: light, medium, heavy, blood clots
- Symptoms: cramps, headache, acne, backache, fatigue, hot flashes, brain fog, cravings, etc.
- Cramp / pain level (0–10)
- Discharge type: no discharge, creamy, watery, sticky, egg white, spotting, clumpy white, unusual, gray
- Oral contraceptive use and type

**Phase detection logic:**

| Condition | Phase |
|-----------|-------|
| Bleeding medium/heavy OR cycle day 1–7 | Menstruation |
| No bleeding, high energy, low irritability, cycle day 8–14 | Follicular / higher capacity |
| Cycle day 15–21, moderate appetite, moderate energy | Ovulation / early luteal |
| Cycle day 22–28+, or high cravings/irritability/bloating | Late luteal / PMS-leaning |
| Uncertain | Symptoms + energy used to determine today's capacity mode |

**Recommendations by phase:**
- Phase-specific workout guidance (e.g., reduce load 20–40% during menstruation, keep reps smooth)
- Nutrition guidance (e.g., protein anchor + craving-compatible carbs during PMS-leaning phase)
- Benji does not diagnose, predict fertility, or give medical advice — professional consultation is always recommended

---

### 8. Conversational AI Chat

A full conversational interface with Benji, powered by the `BenjiLLM.chat()` method:

- Personalized coaching and guidance within the wellness domain
- Question answering: exercise form, nutrition basics, recovery, goal strategy
- Context-aware: user's profile, goals, and recent check-in data are loaded as background context
- Conversation history stored in Firestore (`ChatHistory` collection) per user
- Scope-constrained: Benji stays on topic and redirects off-topic requests politely

---

## Architecture Overview

### System Architecture

```
┌──────────────────────────────────────────────────────┐
│                      Frontend                        │
│   HTML / CSS / Vanilla JS + Firebase Client SDK      │
│   17 pages · 23+ JS modules · Shared BenjiAPI layer  │
└───────────────────────┬──────────────────────────────┘
                        │  HTTP (REST) + Firebase Auth tokens
                        ▼
┌──────────────────────────────────────────────────────┐
│               Backend API (FastAPI / Python)         │
│   33 endpoints · Pydantic validation · CORS          │
│   Firebase Admin SDK · BenjiLLM agent                │
└──────────┬────────────────────┬─────────────────────┘
           │                    │
           ▼                    ▼
┌──────────────────┐  ┌────────────────────────────────┐
│  Firebase /      │  │      Gemini 2.5 Pro            │
│  Firestore       │  │  (via LangChain + google-genai) │
│  (database: benji│  │                                │
│  9 collections)  │  │  BenjiLLM agent class          │
│                  │  │  5 mandatory tools             │
│  Security rules  │  │  10 optional tools             │
│  enforced for    │  │  2 LLM-driven tools            │
│  client SDK      │  │  (SMART goals, 2-day plan)     │
└──────────────────┘  └────────────────────────────────┘
```

### Request Flow

1. User interacts with the frontend (HTML page + JS controller)
2. JS controller calls `BenjiAPI.*` — the shared API layer (`api.js`)
3. Backend receives the request; Pydantic validates the payload
4. For AI operations: `BenjiLLM` loads user context from Firestore, runs mandatory tools, selects and runs optional tools, then invokes Gemini 2.5 Pro with full context + tool outputs
5. Gemini synthesizes the output; backend returns the response
6. JS controller updates the UI

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | HTML5, CSS3, JavaScript (ES6, vanilla) | UI pages and controllers |
| **Frontend Auth** | Firebase Client SDK | Authentication, session management |
| **Backend** | Python, FastAPI | REST API, business logic |
| **LLM / Agent** | Google Gemini 2.5 Pro | Agentic reasoning and response generation |
| **LLM Orchestration** | LangChain, langchain-google-genai | Tool invocation, message formatting |
| **Database** | Firebase Firestore (database ID: `benji`) | User data, goals, check-ins, history |
| **Authentication** | Firebase Auth (Admin SDK + Client SDK) | User identity, token verification |
| **Server** | Uvicorn (ASGI) | FastAPI runtime |
| **Validation** | Pydantic | Request/response schema enforcement |
| **Configuration** | python-dotenv | Environment variable management |

---

## Firestore Database Schema

The app uses a named Firestore database with ID `benji`. The backend connects via Firebase Admin SDK (service account); the frontend uses the Firebase Client SDK with security rules applied.

| Collection | Document ID | Key Fields | Security |
|-----------|-------------|-----------|---------|
| `User` | `user_id` | first_name, last_name, email | `auth.uid == userId` |
| `ProfileInfo` | `user_id` | height, weight, benji_facts (JSON profile blob) | `auth.uid == userId` |
| `Goals` | `user_id` | accepted (list), generated (list) | `auth.uid == userId` |
| `CheckIns` | auto-generated | UserID, dayScore, sleepScore, fitnessScore, recoveryDay, tags, timestamp | `UserID == auth.uid` (create + read/update/delete) |
| `ChatHistory` | `user_id` | messages (list of role/content pairs) | `auth.uid == userId` |
| `Medications` | `user_id` | medications (list: name, strength, frequency, schedule) | `auth.uid == userId` |
| `MenstrualFlowLog` | `user_id` | cycleDay, flow, symptoms, crampLevel, discharge, ocp | `auth.uid == userId` |
| `MedicationCompliance` | `{user_id}_{date}` | user_id, date, medications (compliance per med) | `user_id == auth.uid` |
| `debug` | internal | backend health/diagnostic data | **No client access** |

All other collections are explicitly denied for client SDK access via a catch-all rule.

---

## Security

The security architecture covers four layers: Firestore access control, Firebase Auth, backend token verification, and input validation.

### Firestore Security Rules

Rules are defined in [`firestore.rules`](./firestore.rules) and deployed to the `benji` database. Key design decisions:

- **Identity-based access:** An `isOwner(userId)` helper function verifies `request.auth.uid == userId` — no user can read or write another user's documents.
- **CheckIns special handling:** Documents use a `UserID` field (not document ID) to associate check-ins with a user. Rules verify `resource.data.UserID == request.auth.uid` on reads/updates/deletes and `request.resource.data.UserID == request.auth.uid` on creates.
- **MedicationCompliance:** Document ID is `{userId}_{date}`. Rules check the `user_id` field in the document, with null-safe handling for new document creation.
- **debug collection:** Explicitly set to `allow read, write: if false` — internal backend diagnostics are never accessible to any client.
- **Catch-all deny:** A `/{document=**}` rule denies all collections not explicitly listed, preventing accidental exposure of future collections.
- **Backend bypass:** The Firebase Admin SDK (used in `backend/app/main.py`) bypasses all client security rules by design, operating with full service-account trust.

### Firebase Authentication

- Firebase Auth manages user identity (signup, login, token issuance)
- The backend uses Firebase Admin SDK to verify ID tokens on protected operations
- Frontend stores session state in `localStorage` (`sanctuary_session`) or `sessionStorage` for session persistence
- All user-specific API calls pass `user_id`; backend verifies this against the authenticated session

### Input Validation

- All API request bodies are validated using **Pydantic models** with typed fields and optional/required constraints
- Pydantic rejects malformed payloads before they reach business logic or Firestore
- Field-level constraints (e.g., score ranges 1–10, required string fields) are enforced at the model level

### CORS Configuration

- CORS middleware is configured in FastAPI (`allow_origins=["*"]` for development)
- Cache-control headers (`no-store, no-cache, must-revalidate`) are applied globally via middleware to prevent stale data serving

---

## Getting Started

### Prerequisites

- Python 3.10+
- A Firebase project with Firestore enabled (database ID: `benji`)
- A Google Cloud service account JSON key with Firestore access
- A Gemini API key from Google AI Studio

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jscott7227/HackMT_Health_Agent.git
   cd HackMT_Health_Agent
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r backend/requirements.txt
   ```

3. **Create the `.env` file** in the project root:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/firebase-service-account.json
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-pro
   ```

4. **Deploy Firestore security rules**
   ```bash
   firebase deploy --only firestore:rules
   ```
   Or paste the contents of `firestore.rules` into the Firebase Console → Firestore → Rules for the `benji` database.

5. **Start the backend server**
   ```bash
   python -m uvicorn backend.app.main:app --reload
   ```
   Server runs at `http://127.0.0.1:8000`

6. **Access the auto-generated API docs**
   ```
   http://127.0.0.1:8000/docs
   ```

### Frontend Setup

The frontend is a static HTML/JS application — no build step required.

1. Ensure the backend server is running at `http://127.0.0.1:8000`
2. Open `frontend/html/landing.html` directly in a browser, **or** serve the `frontend/` directory via a static file server:
   ```bash
   # Using Python
   cd frontend
   python -m http.server 3000
   # Then open http://localhost:3000/html/landing.html
   ```

---

## Project Structure

```
HackMT_Health_Agent/
│
├── README.md                    # This file
├── FIRESTORE.md                 # Firestore schema and deployment guide
├── INTEGRATION.md               # Frontend-backend integration reference
├── firestore.rules              # Firestore security rules
├── .env                         # Environment variables (not committed)
│
├── backend/
│   ├── README.md                # Backend API documentation
│   ├── requirements.txt         # Python dependencies
│   └── app/
│   │   └── main.py              # FastAPI application — all routes (33 endpoints)
│   └── llm/
│       ├── client.py            # BenjiLLM agent class — orchestration logic
│       ├── instructions.py      # Agent personality, scope, and constraints
│       └── tools.py             # Tool definitions (5 mandatory, 10 optional, 2 LLM-driven)
│
└── frontend/
    ├── README.md                # Frontend architecture documentation
    ├── html/                    # 20 HTML pages
    │   ├── landing.html         # Entry / authentication page
    │   ├── setup.html           # Profile onboarding
    │   ├── index.html           # Home dashboard
    │   ├── goals.html           # Goal management
    │   ├── chat.html            # AI chat interface
    │   ├── profile.html         # User profile editor
    │   ├── medications.html     # Medication manager
    │   ├── menstrual.html       # Cycle tracking
    │   ├── journal.html         # Notes / journaling
    │   ├── insights.html        # Analytics and trends
    │   ├── settings.html        # App settings
    │   ├── targetedgoal.html    # Goal detail view
    │   ├── about.html           # About page
    │   ├── privacy.html         # Privacy policy
    │   ├── terms.html           # Terms of service
    │   ├── forgot-password.html # Password reset request
    │   ├── reset-password.html  # Password reset form
    │   ├── verify-email.html    # Email verification
    │   └── 404.html             # Error page
    ├── js/                      # 23 JavaScript modules
    │   ├── api.js               # Shared API layer (BenjiAPI global object)
    │   ├── auth.js              # Firebase Auth integration
    │   ├── home-dashboard.js    # Dashboard logic
    │   ├── check-in.js          # Daily check-in
    │   ├── goals.js             # Goal management
    │   ├── medications.js       # Medication tracking
    │   ├── menstrual.js         # Cycle tracking
    │   ├── chat.js              # Chat interface
    │   ├── setup.js             # Onboarding flow
    │   ├── profile.js           # Profile editing
    │   ├── insights.js          # Analytics
    │   ├── journal.js           # Journaling
    │   ├── settings.js          # Settings
    │   ├── agent.js             # Agent runner
    │   ├── landing.js           # Landing page auth flow
    │   ├── app.js               # App init / global utilities
    │   ├── ui.js                # Shared UI helpers
    │   ├── targetedgoal.js      # Goal detail logic
    │   ├── forgot-password.js   # Password reset flow
    │   ├── reset-password.js    # Password reset handler
    │   └── index.js             # Index page bootstrap
    ├── css/
    │   ├── styles.css           # Main stylesheet
    │   └── additional-styles.css
    ├── components/
    │   ├── topbar.html          # Navigation bar component
    │   └── topbar.js            # Navigation logic
    └── assets/
        └── img/                 # Benji logo and assets
```

---

## Contributors

| Contributor | Role | GitHub |
|-------------|------|--------|
| **Thomas Robertson** | Security Architect — Firestore security rules, Firebase Auth integration, backend security standards, input validation design; AI system design — Benji personality, guardrails, and constraints (`instructions.py`); Medication scheduling feature; UI / connectivity | [@TDRobertson](https://github.com/TDRobertson) |
| **Jared Scott** | Backend Lead — FastAPI application architecture, core API routes, project coordination; AI integration and LLM agent development| [@Jscott7227](https://github.com/Jscott7227) |
| **Jacob Hernando** | Infrastructure Lead — Cloud infrastructure setup and management; API development, endpoint implementation alongside Jared | [@jacobhernando128](https://github.com/jacobhernando128) |
| **Kashaina Nucum** | Frontend — UI development and frontend-backend connectivity; Chatbox Interface Implementation; Responsive design improvements; Female health features implementation | [@kashaina](https://github.com/kashaina) |
| **Jun Han** | Auxiliary — Contributed across frontend and backend areas as needed | (fhan43@tntech.edu) |

---

## Roadmap

### Immediate
- [ ] Production deployment (cloud hosting TBD)
- [ ] Firebase Auth client SDK integration in frontend JS modules
- [ ] Live URL linked in this README

### Near-term
- [ ] Push notifications / reminders for check-ins and medications
- [ ] Offline support / PWA manifest
- [ ] Export health data (PDF reports)
- [ ] Calendar view for check-in history

### Long-term
- [ ] Wearable device integration (step count, heart rate)
- [ ] Social / community features (accountability partners)
- [ ] Provider dashboard for sharing data with a healthcare provider
- [ ] Native mobile apps (iOS / Android)

---

## Further Documentation

- [Backend API Documentation](./backend/README.md) — Endpoint reference, LLM agent architecture, Firestore schema, security implementation
- [Frontend Architecture Documentation](./frontend/README.md) — Page reference, JavaScript modules, Firebase integration, state management
- [Firestore Schema and Deployment](./FIRESTORE.md) — Detailed collection schemas, index requirements, deployment steps
- [Integration Guide](./INTEGRATION.md) — How frontend pages connect to backend endpoints
