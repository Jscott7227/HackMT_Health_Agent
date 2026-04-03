# Backend API Documentation

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Architecture](#architecture)
4. [LLM Agent Architecture](#llm-agent-architecture)
5. [API Endpoint Reference](#api-endpoint-reference)
6. [Firebase Admin SDK Integration](#firebase-admin-sdk-integration)
7. [Firestore Security Rules](#firestore-security-rules)
8. [Security Implementation](#security-implementation)
9. [Environment Setup](#environment-setup)
10. [Running the Server](#running-the-server)
11. [Dependencies](#dependencies)

---

## Overview

The `backend/` directory implements the server-side of Wellness Sanctuary with Benji. It is a **FastAPI application** written in Python that serves as the intermediary between the frontend, Firestore, and Gemini 2.5 Pro.

### Technical Stack

- **Runtime:** Python 3.10+
- **Framework:** FastAPI (ASGI, async support)
- **Server:** Uvicorn
- **LLM:** Google Gemini 2.5 Pro (via `langchain-google-genai`)
- **LLM Orchestration:** LangChain (`langchain`, `langchain-google-genai`)
- **Database:** Firebase Firestore (named database: `benji`) via `firebase-admin`
- **Authentication:** Firebase Auth (Admin SDK — bypasses Firestore security rules)
- **Validation:** Pydantic (request and response models)
- **Configuration:** `python-dotenv`

### Project ID and Database

```python
FIREBASE_PROJECT_ID = "gen-lang-client-0263033980"
FIRESTORE_DB_ID = "benji"
```

The backend connects to the `benji` named Firestore database (not the default `(default)` database). All `firestore.client()` calls pass `database_id="benji"`.

---

## File Structure

```
backend/
├── README.md                  # This file
├── requirements.txt           # Python dependencies
├── app/
│   └── main.py                # FastAPI application — all routes, models, Firestore logic
└── llm/
    ├── client.py              # BenjiLLM class — agent orchestration
    ├── instructions.py        # Agent personality, scope, and constraints (security design)
    └── tools.py               # Tool function definitions (mandatory, optional, LLM-driven)
```

The entire FastAPI application lives in `main.py` (1,842 lines). All Pydantic models, Firestore operations, authentication logic, and route handlers are co-located for this project stage.

---

## Architecture

### Design Principles

- **Single responsibility at the route level:** Each endpoint handles one operation cleanly.
- **Pydantic-first validation:** All request bodies use typed Pydantic models. Invalid payloads are rejected before reaching business logic.
- **Admin SDK trust:** The backend operates with full Firebase Admin SDK access, bypassing Firestore security rules. All authorization is enforced at the API level (verifying `user_id` matches the expected owner).
- **LLM as a service:** AI operations are isolated in the `llm/` module. Routes call `benji.run()`, `benji.chat()`, etc. — the route layer doesn't know about Gemini or LangChain.
- **Cache-disabled responses:** A global middleware sets `no-store, no-cache` headers on all responses to ensure the frontend always receives fresh data.

### Request Flow

```
┌──────────────┐
│   Frontend   │
│  (Browser)   │
└──────┬───────┘
       │ HTTP Request (JSON body)
       ▼
┌────────────────────────────────────────┐
│         FastAPI Middleware Pipeline     │
├────────────────────────────────────────┤
│  1. CORS Handler                        │
│  2. Cache-control headers (global)      │
│  3. Body Parser (JSON via Pydantic)     │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│      Route Handler (main.py)            │
├────────────────────────────────────────┤
│  1. Pydantic model validation           │
│  2. Firestore read (user context)       │
│  3. BenjiLLM call (if AI endpoint)      │
│  4. Firestore write (if applicable)     │
│  5. Return Pydantic response model      │
└────────┬───────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────┐
│         Firebase Firestore              │
│         (database: benji)              │
└────────────────────────────────────────┘
         │ (for AI endpoints)
         ▼
┌────────────────────────────────────────┐
│     BenjiLLM Agent (llm/client.py)     │
├────────────────────────────────────────┤
│  1. Load user context (facts, goals)   │
│  2. Run mandatory tools                │
│  3. Select + run optional tools        │
│  4. Invoke Gemini 2.5 Pro              │
│  5. Return synthesized response        │
└────────────────────────────────────────┘
```

---

## LLM Agent Architecture

The `llm/` module implements the agentic reasoning layer. It is composed of three files that separate concerns cleanly.

### `llm/instructions.py` — Agent Identity and Constraints

This module defines the structured agent instructions that govern how Benji behaves. Rather than hardcoding prompt strings in route handlers, all personality, scope, and safety constraints are defined as structured data and assembled by `format_agent_instructions()`.

#### Agent Personality (`PERSONALITY`)

```python
PERSONALITY = {
    "name": "Benji",
    "role": "informative and caring professor... treats the user as if they are colleagues",
    "focus": "fitness, nutrition, wellness, goals, medications, menstrual/cycle tracking, daily check-ins",
    "tone": "practical, actionable, supportive, and clear"
}
```

#### Allowed Topics (`ALLOWED_TOPICS`)

The agent is constrained to these domains only:

- Fitness and exercise
- Nutrition and diet (general guidance only)
- Wellness and recovery (sleep, stress, mood)
- Goal setting (SMART goals, plans)
- Medication timing and schedules (no dosing or medical advice)
- Daily check-ins and progress
- Body stats (weight, height, BMI in context of goals)
- Menstrual/cycle tracking and phase-based wellness recommendations

#### Hard Constraints (`CONSTRAINTS`)

Safety rules the agent must never violate:

1. **Scope enforcement:** Questions outside allowed topics get a polite redirect — no political, coding, or general knowledge responses
2. **No harmful content:** Self-harm, eating disorders, or dangerous behaviors trigger a care response with professional support suggestions
3. **No illegal activity:** Redirected to lawful, healthy alternatives
4. **No medical diagnoses:** Users are directed to healthcare providers for medical decisions
5. **Medication limits:** Only scheduling and reminders — no specific dosing or prescription advice
6. **Evidence-based only:** No speculation or off-topic tangents
7. **Cycle tracking limits:** Phase awareness and wellness recommendations only — no fertility prediction or diagnostic claims

#### `format_agent_instructions()`

Assembles the three sections into a single system message string. Used by every AI method in `BenjiLLM` to ensure consistent scope and safety across all agent operations.

```python
# Every AI call in the system uses this
agent_instructions = format_agent_instructions(
    include_personality=True,
    include_scope=True,
    include_constraints=True
)
```

---

### `llm/tools.py` — Tool Definitions

All tool functions take user facts or check-in data as input and return structured dictionaries that the agent uses for context-grounded responses.

#### Mandatory Tools (always run on `/run`)

| Tool Key | Function | Purpose |
|----------|----------|---------|
| `goal_type` | `FitnessGoalTypeTool(facts)` | Classifies goal type from goal description string (weight_loss, muscle_strength, cardio_endurance, etc.) |
| `body_stats` | `BodyStatsTool(facts)` | Extracts height, weight, age; computes BMI estimate |
| `daily_checkin` | `DailyCheckinTool(checkin)` | Averages sleep/stress/mood/fitness scores; flags low_sleep and high_stress |
| `fitness_plan` | `FitnessPlanTool(profile, goal_type)` | Returns today's + tomorrow's base activities and weekly focus for the goal type |
| `goal_progress` | `GoalProgressTool(goal, history)` | Calculates completion % and days remaining based on start date and duration |

#### Optional Tools (LLM selects based on user input)

| Tool Key | Function | Purpose |
|----------|----------|---------|
| `nutrition` | `NutritionTool(facts)` | Calculates calorie and protein targets from weight; sets hydration target |
| `wellness_plan` | `WellnessPlanTool(profile)` | Returns sleep target, hydration reminder, and stress tip |
| `trend_analysis` | `AnalyzeTrendTool(history)` | Averages sleep and stress over check-in history; flags low sleep or elevated stress |
| `injury_safety` | `InjurySafetyTool(facts, checkin)` | Returns risk level and restrictions if pain level ≥ 6 |
| `weekly_recap` | `WeeklyFitnessRecapTool(history)` | Averages day scores over the week; returns days logged and summary |
| `emotion_eval` | `WellnessEmotionEvalTool(history)` | Averages mood across check-in history; returns mood trend (stable/down) |
| `medication_schedule` | `MedicationScheduleTool(facts)` | Builds a rule-based time-slotted medication schedule from keyword matching |
| `contraindication_check` | `ContraindicationCheckTool` | Checks medication list for known drug-drug and food interaction patterns |
| `medication_schedule_agent` | `MedicationScheduleAgentTool` | LLM-driven schedule generation — AI builds a personalized, safe schedule with explanations |
| `cycle_recommendations_agent` | `CycleRecommendationsAgentTool` | LLM-driven phase-aware fitness/nutrition recommendations from cycle log data |

#### LLM-Driven Tools (called directly, not through the tool registry)

| Function | Called by | Purpose |
|----------|-----------|---------|
| `BenjiGoalsTool(facts, user_goal, model)` | `BenjiLLM.run_goals()` | Generates 1–3 SMART goals with computed end dates from natural-language goal input |
| `UpcomingPlanTool(facts, smart_goals, model)` | `BenjiLLM.run_upcoming_plan()` | Generates a 2-day actionable schedule directly tied to accepted SMART goals |

---

### `llm/client.py` — BenjiLLM Agent Class

The `BenjiLLM` class orchestrates all AI operations. A single instance is created at app startup (`benji = BenjiLLM()`) and shared across requests.

#### Class Initialization

```python
benji = BenjiLLM()
# - Initializes ChatGoogleGenerativeAI with gemini-2.5-pro
# - Loads MANDATORY_TOOLS and OPTIONAL_TOOLS from tools.py
# - Initializes empty user_facts and history
```

#### Core Methods

**`run(user_input, user_facts)` — Main Agentic Loop**

Called by `POST /run`. Full agent execution:
1. Merges provided `user_facts` with session state
2. Extracts facts from user input (age, weight, height, fitness level, goal) via LLM
3. Runs all mandatory tools (always)
4. Calls `select_optional_tools()` — LLM decides which optional tools are relevant
5. Runs selected optional tools
6. Assembles all tool outputs into a combined context block
7. Adds agent instructions from `format_agent_instructions()` plus medication-scheduling notes
8. Invokes Gemini 2.5 Pro with the full context
9. Returns the response string

**`chat(user_input, history, user_facts)` — Conversational Chat**

Called by `POST /chat`. Lighter than `run()` — no tools, just context-aware conversation:
1. Builds system messages from `format_agent_instructions()` and `format_user_facts()`
2. Appends the full conversation history
3. Invokes Gemini 2.5 Pro
4. Appends the exchange to internal history

**`run_goals(user_goal, user_facts, user_id)` — SMART Goal Generation**

Called by `POST /goals`. Uses `BenjiGoalsTool` to generate SMART goals.

**`run_upcoming_plan(user_facts, user_id)` — 2-Day Plan Generation**

Called by `POST /upcoming`. Uses `UpcomingPlanTool` to generate a goal-driven 2-day schedule.

**`checkin_recommendations(user_facts, user_message)` — Check-in Focus Areas**

Called by `POST /checkin-recommendations`. Generates 3–5 personalized check-in focus areas using `format_agent_instructions()` for consistency with the rest of the agent.

**`checkin_sense(checkin_data, user_facts, recent_checkins)` — "Benji's Notes"**

Called by `POST /checkin-sense`. Generates 2–4 post-check-in insights as a JSON array, correlating scores with the user's goals and recent trends.

**`select_relevant_questions(active_goals, user_facts)` — Check-in Question Selection**

Called by `POST /relevant-questions`. Selects which check-in questions are relevant for this user based on their active goal types.

---

## API Endpoint Reference

### Authentication & User Management

---

#### `POST /signup`

Create a new user account.

**Request body:**
```json
{
  "email": "string",
  "password": "string",
  "first_name": "string",
  "last_name": "string"
}
```

**Response:**
```json
{
  "user_id": "string",
  "message": "string"
}
```

---

#### `POST /login`

Authenticate an existing user.

**Request body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "user_id": "string",
  "message": "string"
}
```

---

#### `GET /user/{user_id}`

Get user account information.

**Response:**
```json
{
  "user_id": "string",
  "first_name": "string",
  "last_name": "string",
  "email": "string"
}
```

---

#### `PATCH /user/{user_id}`

Update user name fields.

**Request body:**
```json
{
  "first_name": "string (optional)",
  "last_name": "string (optional)"
}
```

---

#### `DELETE /user/{user_id}`

Delete a user account and associated data.

---

### Profile

---

#### `POST /profileinfo/{user_id}`

Create a new profile document for the user.

**Request body:** Full profile object (height, weight, `benji_facts` JSON blob, diet, fitness levels, wellness scores, etc.)

**Response:** `ProfileInfoOut` — the created profile

---

#### `GET /profileinfo/{user_id}`

Retrieve the user's profile document.

**Response:** `ProfileInfoOut`

---

#### `PATCH /profileinfo/{user_id}`

Update specific profile fields.

**Response:** `ProfileInfoOut` — updated profile

---

#### `POST /update_facts`

Merge updates into the `user_facts` JSON field in the legacy `users.json` fallback. Used for testing and non-Firestore contexts.

---

### Goals

---

#### `POST /goals`

Generate SMART goals from a natural-language goal description using `BenjiLLM.run_goals()`.

**Request body:**
```json
{
  "user_goal": "string",
  "user_id": "string (optional)",
  "user_facts": { ... }
}
```

**Response:**
```json
{
  "smart_goals": [
    {
      "Specific": "string",
      "Measurable": "string",
      "Attainable": "string",
      "Relevant": "string",
      "Time_Bound": "string",
      "Duration_Days": 30,
      "EndDate": "datetime"
    }
  ]
}
```

---

#### `POST /goals/{user_id}/accepted`

Save the user's accepted goals to Firestore.

**Request body:**
```json
{
  "goals": [ { ... } ]
}
```

---

#### `GET /goals/{user_id}`

Retrieve the user's stored goals.

**Response:**
```json
{
  "accepted": [ { ... } ],
  "generated": [ { ... } ]
}
```

---

#### `POST /upcoming`

Generate a 2-day actionable plan from accepted SMART goals using `BenjiLLM.run_upcoming_plan()`.

**Request body:**
```json
{
  "user_id": "string (optional)",
  "user_facts": { ... }
}
```

**Response:**
```json
{
  "upcoming": {
    "today": ["activity 1", "activity 2"],
    "tomorrow": ["activity 1", "activity 2"]
  }
}
```

---

#### `POST /goals/{goal_id}/checkins`

Add a check-in reference to a specific goal's history.

---

#### `GET /goals/{goal_id}/checkins`

Get all check-in references associated with a goal.

---

### Check-ins

---

#### `GET /checkins/{user_id}`

Retrieve all check-ins for a user, ordered by timestamp.

**Response:** Array of check-in documents

---

#### `POST /checkins`

Save a new daily check-in to Firestore.

**Request body:**
```json
{
  "UserID": "string",
  "dayScore": 8,
  "sleepScore": 4,
  "eatScore": 3,
  "drinkScore": 4,
  "fitnessScore": 4,
  "wellnessScore": 4,
  "recoveryDay": false,
  "fitnessNotes": "string (optional)",
  "dayNotes": "string (optional)",
  "tags": ["Academics", "Work"],
  "timestamp": "datetime"
}
```

---

#### `POST /checkin-recommendations`

Generate 3–5 personalized check-in focus areas using `BenjiLLM.checkin_recommendations()`.

**Request body:**
```json
{
  "user_id": "string",
  "user_facts": { ... },
  "user_message": "string (optional)"
}
```

**Response:**
```json
{
  "recommendations": "string (numbered list)"
}
```

---

#### `POST /checkin-sense`

Generate "Benji's Notes" — 2–4 post-check-in insights using `BenjiLLM.checkin_sense()`.

**Request body:**
```json
{
  "checkin_data": { ... },
  "user_id": "string",
  "recent_checkins": [ { ... } ]
}
```

**Response:**
```json
{
  "notes": ["string", "string", "string"]
}
```

---

### AI Agent & Chat

---

#### `POST /run`

Run the full agentic response via `BenjiLLM.run()`. Loads user context, runs mandatory + selected optional tools, invokes Gemini 2.5 Pro.

**Request body:**
```json
{
  "user_input": "string",
  "user_id": "string (optional)",
  "user_facts": { ... }
}
```

**Response:**
```json
{
  "response": "string"
}
```

---

#### `POST /chat`

Conversational chat via `BenjiLLM.chat()`. Context-aware but no tool invocation.

**Request body:**
```json
{
  "user_input": "string",
  "user_id": "string (optional)",
  "history": [
    { "role": "user", "content": "string" },
    { "role": "assistant", "content": "string" }
  ]
}
```

**Response:**
```json
{
  "response": "string"
}
```

---

#### `GET /chat-history/{user_id}`

Retrieve stored conversation history from Firestore.

**Response:**
```json
{
  "history": [
    { "role": "string", "content": "string" }
  ]
}
```

---

#### `POST /relevant-questions`

Select relevant check-in questions for the user's active goals via `BenjiLLM.select_relevant_questions()`.

**Request body:**
```json
{
  "active_goals": ["weight-loss", "cardio"],
  "user_facts": { ... }
}
```

**Response:**
```json
{
  "questions": {
    "overall_day": ["..."],
    "fitness": ["..."],
    "weight-loss": ["..."]
  }
}
```

---

### Medications

---

#### `GET /medications/{user_id}`

Retrieve the user's medication list from Firestore.

**Response:**
```json
{
  "medications": [
    {
      "name": "string",
      "strength": "string",
      "frequency": "string",
      "schedule": { ... }
    }
  ]
}
```

---

#### `PUT /medications/{user_id}`

Add or update the medication list for a user.

**Request body:**
```json
{
  "medications": [
    {
      "name": "string",
      "strength": "string",
      "frequency": "string"
    }
  ]
}
```

---

#### `GET /medication-schedule/{user_id}?use_ai=true`

Generate a medication schedule for the user.

- Without `?use_ai=true`: returns a rule-based schedule
- With `?use_ai=true`: runs `MedicationScheduleAgentTool` for an LLM-generated, personalized schedule

**Response:**
```json
{
  "timeSlots": {
    "morning": ["med name"],
    "afternoon": [],
    "evening": ["med name"],
    "night": []
  },
  "foodInstructions": ["string"],
  "warnings": ["string"],
  "spacingNotes": ["string"],
  "timeSlotsDetailed": [ { ... } ],
  "personalizationNotes": "string"
}
```

---

#### `GET /compliance/{user_id}`

Get medication compliance history for a user.

---

#### `POST /compliance`

Record today's medication compliance.

**Request body:**
```json
{
  "user_id": "string",
  "date": "YYYY-MM-DD",
  "medications": [
    { "name": "string", "taken": true }
  ]
}
```

---

### Menstrual Cycle

---

#### `GET /menstrual/{user_id}`

Retrieve the user's most recent cycle log.

**Response:** `MenstrualFlowLogResponse` — cycle day, flow, symptoms, cramp level, discharge, OCP data

---

#### `PUT /menstrual/{user_id}`

Save or update the user's cycle log.

**Request body:**
```json
{
  "cycleDay": 5,
  "flow": "medium",
  "symptoms": ["cramps", "fatigue"],
  "crampLevel": 6,
  "discharge": "no discharge",
  "oralContraceptives": false
}
```

---

#### `GET /menstrual-recommendations/{user_id}`

Generate phase-aware fitness and nutrition recommendations via `CycleRecommendationsAgentTool`.

**Response:**
```json
{
  "user_id": "string",
  "current_phase": "Menstruation",
  "cycle_day": 5,
  "predicted_period_onset": "string (optional)",
  "recommendations": ["string"],
  "personalization_notes": "string"
}
```

---

### Health History

---

#### `GET /health-history/{user_id}`

Retrieve longitudinal health data for a user (vitals, progress snapshots, etc.).

---

### Utility

---

#### `GET /firebase/health`

Backend health check — verifies Firebase Admin SDK connection and Firestore access.

**Response:**
```json
{
  "status": "ok",
  "firebase": "connected"
}
```

---

## Firebase Admin SDK Integration

The backend uses `firebase-admin` with a service account credential. The Admin SDK operates with full Firestore access — it bypasses all security rules written in `firestore.rules`.

### Initialization

```python
cred = credentials.Certificate(creds_path)  # Path from GOOGLE_APPLICATION_CREDENTIALS env var
firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})
db = firestore.client(database_id="benji")
```

### Why Admin SDK (Not Client SDK)

The backend uses the Admin SDK rather than the client SDK for several reasons:
- **No security rule constraints:** The backend enforces authorization at the API layer (verifying `user_id` parameters), not at the database layer
- **Server-side trust:** Service account credentials are kept server-side in the `.env` file, never exposed to the browser
- **Full collection access:** The backend can read/write all collections, including `debug`, which is blocked for client SDK access

### User ID Verification

For all user-specific operations, the backend receives `user_id` from the request and queries Firestore for documents matching that ID. The `isOwner()` function pattern in the Firestore rules governs client-side access; the backend enforces equivalent ownership logic at the route level.

---

## Firestore Security Rules

Security rules are maintained in [`firestore.rules`](../firestore.rules) and deployed to the `benji` database. These rules apply to **client SDK access only** — the Admin SDK (backend) bypasses them entirely.

### Key Design Decisions

#### `isOwner()` Helper

```javascript
function isOwner(userId) {
  return request.auth != null && request.auth.uid == userId;
}
```

All per-user collections use this helper. It ensures:
1. The request is authenticated (`request.auth != null`)
2. The authenticated user's UID matches the document owner's ID

#### Per-Collection Rules

| Collection | Rule Logic | Notes |
|-----------|-----------|-------|
| `User/{userId}` | `isOwner(userId)` | Document ID = UID |
| `ProfileInfo/{userId}` | `isOwner(userId)` | Document ID = UID |
| `Goals/{userId}` | `isOwner(userId)` | Document ID = UID |
| `ChatHistory/{userId}` | `isOwner(userId)` | Document ID = UID |
| `Medications/{userId}` | `isOwner(userId)` | Document ID = UID |
| `MenstrualFlowLog/{userId}` | `isOwner(userId)` | Document ID = UID |
| `CheckIns/{docId}` | `resource.data.UserID == request.auth.uid` | Auto-generated doc ID; ownership via field |
| `MedicationCompliance/{docId}` | `resource.data.user_id == request.auth.uid` (null-safe for creates) | Doc ID = `{userId}_{date}` |
| `debug/{docId}` | `allow read, write: if false` | No client access ever |

#### CheckIns Special Handling

CheckIn documents have auto-generated IDs (not the user's UID), so ownership is verified via a `UserID` field in the document data:

```javascript
match /CheckIns/{docId} {
  allow read, update, delete: if request.auth != null
    && resource.data.UserID == request.auth.uid;
  allow create: if request.auth != null
    && request.resource.data.UserID == request.auth.uid;
}
```

#### MedicationCompliance Null-Safe Rule

On document creation, `resource` is null (the doc doesn't exist yet). The rule uses `resource == null` to handle this safely:

```javascript
match /MedicationCompliance/{docId} {
  allow read, write: if request.auth != null
    && (resource == null
      ? request.resource.data.user_id == request.auth.uid
      : resource.data.user_id == request.auth.uid);
}
```

#### Catch-All Deny

```javascript
match /{document=**} {
  allow read, write: if false;
}
```

Any collection not explicitly listed is denied. This prevents accidental exposure when new collections are created.

### Deploying Rules

**Via Firebase CLI:**
```bash
firebase deploy --only firestore:rules
```

**Via Firebase Console:**
1. Go to Firebase Console → Firestore Database
2. Select the `benji` database
3. Navigate to the Rules tab
4. Paste the contents of `firestore.rules` and publish

---

## Security Implementation

Security is implemented across four layers: Firestore access control (rules), Firebase Auth (identity), backend authorization (API-level user_id verification), and input validation (Pydantic).

### Firebase Auth Token Flow

1. Frontend: user logs in via `POST /login` → receives `user_id`
2. All subsequent API calls include `user_id` in the request body
3. Backend: route handlers verify that the `user_id` matches the expected owner of the requested resource
4. Firestore security rules enforce the same ownership constraint on any direct client SDK access

### Input Validation (Pydantic)

All request bodies are typed Pydantic models. Pydantic rejects:
- Missing required fields (HTTP 422 Unprocessable Entity)
- Wrong field types (string where int expected, etc.)
- Invalid optional fields (caught before reaching business logic)

Example models in `main.py`:
```python
class ChatRequest(BaseModel):
    user_input: str
    user_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = []

class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str
```

### CORS Configuration

CORS middleware is configured globally:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # Tighten for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

> **Production note:** `allow_origins=["*"]` should be replaced with the specific frontend domain(s) before deploying to production.

### Cache-Control Headers

A global middleware disables all HTTP caching:

```python
@app.middleware("http")
async def disable_cache(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response
```

This ensures the frontend always fetches fresh data — no stale goal plans, check-in history, or medication schedules from browser caches.

### Environment Variable Handling

Credentials are loaded exclusively from the `.env` file — never hardcoded in source files:

```python
creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if not creds_path:
    raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS not set")
```

The `.env` file is gitignored. Required variables:
- `GOOGLE_APPLICATION_CREDENTIALS` — path to Firebase service account JSON
- `GEMINI_API_KEY` — Google AI Studio API key
- `GEMINI_MODEL` — model ID (e.g., `gemini-2.5-pro`)

### AI Safety Guardrails

Beyond the system-level security, the AI itself enforces safety constraints via `instructions.py`:
- Out-of-scope questions receive a polite redirect, not an answer
- Self-harm or crisis topics trigger a care response + professional support suggestions
- Medication advice is strictly limited to scheduling — no dosing or prescribing
- Cycle tracking stops at phase awareness — no fertility prediction or diagnostic claims

These constraints are applied consistently across every agent method via `format_agent_instructions()`, which is called at the start of every AI operation.

---

## Environment Setup

### `.env` File

Create a `.env` file in the **project root** (one level above `backend/`):

```env
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-service-account.json
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-pro
```

### Getting the Credentials

**Firebase service account JSON:**
1. Go to [Firebase Console](https://console.firebase.google.com) → Your Project → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save the downloaded JSON file to a secure location
4. Set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of that file

**Gemini API key:**
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Create or retrieve your API key
3. Set `GEMINI_API_KEY` to that value

### Firestore Setup

1. In Firebase Console, create a new Firestore database
2. Name it `benji` (this matches `FIRESTORE_DB_ID` in `main.py`)
3. Start in production mode (rules will be deployed separately)
4. Deploy `firestore.rules` as described in [Deploying Rules](#deploying-rules)

---

## Running the Server

### Install Dependencies

```bash
pip install -r backend/requirements.txt
```

### Start the Server

From the **project root** (not from inside `backend/`):

```bash
python -m uvicorn backend.app.main:app --reload
```

- Server runs at: `http://127.0.0.1:8000`
- Auto-reload is enabled on file changes (development mode)
- Remove `--reload` for production

### Access the API Docs

FastAPI generates interactive Swagger documentation automatically:

```
http://127.0.0.1:8000/docs
```

Use the Swagger UI to test any endpoint directly with real request bodies.

### Health Check

```bash
curl http://127.0.0.1:8000/firebase/health
# Expected: {"status": "ok", "firebase": "connected"}
```

---

## Dependencies

`backend/requirements.txt`:

| Package | Purpose |
|---------|---------|
| `google-genai` | Direct access to Google Generative AI APIs (Gemini) |
| `fastapi` | REST API framework — routing, middleware, response models |
| `python-dotenv` | Load environment variables from `.env` file |
| `langchain` | LLM orchestration framework — message types, chains |
| `langchain-google-genai` | LangChain integration for Google Generative AI (Gemini) |
| `pydantic` | Data validation and serialization — request/response models |
| `uvicorn` | ASGI server for running FastAPI in development and production |
| `firebase-admin` | Firebase Admin SDK — Firestore read/write, Auth token verification |

Install all dependencies:
```bash
pip install -r backend/requirements.txt
```
