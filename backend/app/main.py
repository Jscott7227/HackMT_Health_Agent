from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from hashlib import sha256
from uuid import uuid4
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from datetime import datetime, timedelta
import random

import json
import os

from backend.llm.client import BenjiLLM

import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

FIREBASE_PROJECT_ID = "gen-lang-client-0263033980"
FIRESTORE_DB_ID = "benji"

creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
if not creds_path:
    raise RuntimeError("GOOGLE_APPLICATION_CREDENTIALS not set (check .env load)")

if firebase_admin._apps:
    firebase_admin.delete_app(firebase_admin.get_app())

cred = credentials.Certificate(creds_path)
firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})

db = firestore.client(database_id="benji")

ROOT_ENV = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env"))
load_dotenv(ROOT_ENV, override=True)

app = FastAPI(
    title="BenjiLLM API",
    description="Agentic fitness recommendation system",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def disable_cache(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

benji = BenjiLLM()

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    user_input: str
    user_id: Optional[str] = None
    history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    response: str
class UpdateUserNameRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None

class UpdateUserNameResponse(BaseModel):
    user_id: str
    message: str

class DeleteUserResponse(BaseModel):
    message: str

class CreateGoalEntryRequest(BaseModel):
    end_date: datetime
    check_ins: List[str] = []

class UpdateGoalEntryRequest(BaseModel):
    # each optional
    date_created: Optional[datetime] = None
    end_date: Optional[datetime] = None
    check_ins: Optional[List[str]] = None

class GoalEntryOut(BaseModel):
    goal_id: str
    user_id: str
    date_created: datetime
    end_date: datetime
    check_ins: List[str]

class DeleteGoalEntryResponse(BaseModel):
    message: str

class ProfileFields(BaseModel):
    benji_facts: str = "{}"
    height: Optional[str] = None
    weight: Optional[str] = None

class CreateProfileInfoRequest(BaseModel):
    benji_facts: Optional[str] = "{}"
    height: Optional[str] = None
    weight: Optional[str] = None

class ProfileFieldsPatch(BaseModel):
    benji_facts: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None

class UpdateProfileInfoRequest(BaseModel):
    benji_facts: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None

class ProfileInfoOut(BaseModel):
    user_id: str
    benji_facts: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None

class UserInfoOut(BaseModel):
    user_id: str
    first_name: str
    last_name: str
    email: str


class RunGoalsRequest(BaseModel):
    user_goal: str
    user_facts: Optional[Dict] = None
    user_id: Optional[str] = None
    
class RunUpcomingRequest(BaseModel):
    user_facts: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None


class RunUpcomingResponse(BaseModel):
    upcoming: Dict[str, Any]

class SMARTGoal(BaseModel):
    Specific: str
    Measurable: str
    Attainable: str
    Relevant: str
    Time_Bound: str

class RunGoalsResponse(BaseModel):
    smart_goals: List[SMARTGoal]

USERS_DB_FILE = os.path.join("backend", "users.json")
if not os.path.exists(USERS_DB_FILE):
    with open(USERS_DB_FILE, "w") as f:
        json.dump({}, f)
        
class SignupRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    user_id: str
    message: str

class QuestionRequest(BaseModel):
    active_goals: List[str]
    user_id: str  # take user id instead of raw facts

class QuestionResponse(BaseModel):
    questions: Dict[str, List[str]]

class UpdateUserFacts(BaseModel):
    user_id: str
    user_facts: Dict[str, Any] = Field(
        default={
            "age": 30,
            "weight": 180,
            "height": "5'10\"",
            "fitness_level": "intermediate",
            "goal": "build muscle",
            "medications": []
        },
        example={
            "age": 30,
            "weight": 180,
            "height": "5'10\"",
            "fitness_level": "intermediate",
            "goal": "build muscle",
            "medications": [
                {
                    "id": "med_123",
                    "name": "Lisinopril",
                    "strength": "10 mg",
                    "frequency": "once daily in morning"
                }
            ]
        },
        description="Optional structured facts about the user. Used by tools like BodyStatsTool and MedicationScheduleTool."
    )

class RunRequest(BaseModel):
    user_input: str = Field(..., example="I want to get much stronger and improve my fitness")
    user_id: Optional[str] = Field(None, example="uuid-of-user")
    user_facts: Optional[Dict[str, Any]] = Field(
        default={
            "age": 30,
            "weight": 180,
            "height": "5'10\"",
            "fitness_level": "intermediate",
            "goal": "build muscle",
            "medications": []
        },
        example={
            "age": 30,
            "weight": 180,
            "height": "5'10\"",
            "fitness_level": "intermediate",
            "goal": "build muscle",
            "medications": []
        },
        description="Optional structured facts about the user. Used by tools like BodyStatsTool and MedicationScheduleTool."
    )


class RunResponse(BaseModel):
    response: str
    
def authenticate_firestore(email: str, password: str) -> Optional[str]:
    docs = (
        db.collection("User")
          .where("email", "==", email)
          .limit(1)
          .stream()
    )
    doc = next(docs, None)
    if not doc:
        return None

    user = doc.to_dict() or {}
    if user.get("password") != password:
        return None

    return doc.id


def load_users() -> dict:
    try:
        with open(USERS_DB_FILE, "r") as f:
            return json.load(f)
    except json.JSONDecodeError:
        # reset file if invalid
        with open(USERS_DB_FILE, "w") as f:
            json.dump({}, f, indent=2)
        return {}
    
def save_users(users: dict):
    with open(USERS_DB_FILE, "w") as f:
        json.dump(users, f, indent=2)

def authenticate(username: str, password: str) -> Optional[str]:
    """
    Returns user_id if authentication succeeds, None otherwise.
    """
    users = load_users()
    for uid, user in users.items():
        if user["username"] == username and user["password"] == password:
            return uid
    return None

def get_user_by_id(user_id: str) -> Optional[dict]:
    users = load_users()
    return users.get(user_id)

@app.post("/signup", response_model=LoginResponse)
def signup(request: SignupRequest):
    # unique email
    existing = (
        db.collection("User")
          .where("email", "==", request.email)
          .limit(1)
          .stream()
    )
    if next(existing, None) is not None:
        raise HTTPException(status_code=400, detail="Email already exists")

    # Firestore auto-ID
    doc_ref = db.collection("User").document()
    doc_ref.set({
        "first_name": request.first_name,
        "last_name": request.last_name,
        "email": request.email,
        "password": request.password
    })

    return LoginResponse(user_id=doc_ref.id, message="User created successfully")


@app.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    user_id = authenticate_firestore(request.email, request.password)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return LoginResponse(user_id=user_id, message="Login successful")

@app.post("/relevant-questions", response_model=QuestionResponse)
def get_relevant_questions(payload: QuestionRequest):
    """
    Return relevant check-in questions based on active goals and user's existing facts.
    """
    try:
        # Fetch the user facts from the backend
        print(payload.user_id)
        d = get_profileinfo(payload.user_id)
        user_facts = {
            "benji_facts": d.benji_facts,
            "height": d.height,
            "weight": d.weight,
        }
        print(user_facts)
        if user_facts is None:
            raise HTTPException(status_code=404, detail="User not found")

        relevant = benji.select_relevant_questions(
            active_goals={},
            user_facts=user_facts
        )
        print(relevant)
        return QuestionResponse(questions=relevant)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/user/{user_id}", response_model=UserInfoOut)
def get_user_info(user_id: str):
    """Retrieve basic user info (name, email) from Firestore."""
    snap = db.collection("User").document(user_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    d = snap.to_dict() or {}
    return UserInfoOut(
        user_id=user_id,
        first_name=d.get("first_name", ""),
        last_name=d.get("last_name", ""),
        email=d.get("email", ""),
    )


@app.post("/update_facts")
def update_facts(update: UpdateUserFacts):
    user = get_user_by_id(update.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Merge facts
    user["user_facts"].update(update.user_facts)
    users = load_users()
    users[update.user_id] = user
    save_users(users)
    return {"message": "User facts updated successfully", "user_facts": user["user_facts"]}

def fetch_profileinfo(user_id: str):
    snap = db.collection("ProfileInfo").document(user_id).get()
    if not snap.exists:
        return None  # don’t raise HTTPException here

    d = snap.to_dict() or {}

    benji_facts = d.get("BenjiFacts") or {}
    if isinstance(benji_facts, str):
        try:
            benji_facts = json.loads(benji_facts)
        except json.JSONDecodeError:
            benji_facts = {}

    return {
        "user_id": user_id,
        "benji_facts": benji_facts,
        "height": d.get("Height"),
        "weight": d.get("Weight"),
    }

@app.post("/run", response_model=RunResponse)
def run_agent(payload: RunRequest):
    """
    Run BenjiLLM with optional pre-known user facts.
    If user_id provided, automatically load stored user_facts.
    """
    user_facts = payload.user_facts or {}

    if payload.user_id:
        user = get_user_by_id(payload.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        # Merge stored facts with request facts
        stored_facts = user.get("user_facts", {})
        stored_facts.update(user_facts)
        user_facts = stored_facts

    output = benji.run(
        user_input=payload.user_input,
        user_facts=user_facts
    )
    
    return {"response": output}

##########################
#STARTING USER DATA PULLS#
##########################

@app.get("/firebase/health")
def firebase_health():
    ref = db.collection("debug").document("api_health")
    ref.set({"ok": True})
    doc = ref.get()
    return {"firestore": "ok", "db": "benji", "doc": doc.to_dict()}


@app.post("/goals", response_model=RunGoalsResponse)
def run_goals_endpoint(payload: RunGoalsRequest):
    """
    Generate SMART goals for a user's input goal and optionally persist to user facts.
    """
    try:
        print("Payload received:", payload)
        
        user_facts = fetch_profileinfo(payload.user_id)
        result = benji.run_goals(
            user_goal=payload.user_goal,
            user_facts=user_facts
        )
        # Return only the smart_goals list
        smart_goals = result.get("smart_goals", [])
        return {"smart_goals": smart_goals}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    
##TODO Create a route to update user facts adding goals

@app.post("/upcoming", response_model=RunUpcomingResponse)
def run_upcoming_endpoint(payload: RunUpcomingRequest):
    """
    Generate a 2-day upcoming plan using stored SMART goals
    and optionally persist it to user facts.
    """

    try:
        d =  get_profileinfo(payload.user_id)

        user_facts = {
            "benji_facts": d.benji_facts,
            "height": d.height,
            "weight": d.weight,
        }
        
        result = benji.run_upcoming_plan(
            user_facts=user_facts,
            user_id=payload.user_id
        )

        upcoming = result.get("upcoming", {})
        return {"upcoming": upcoming}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/chat", response_model=ChatResponse)
def chat_endpoint(req: ChatRequest):
    # Convert frontend history to LangChain messages
    history_msgs = [
        HumanMessage(content=msg.content) if msg.role == "user" else AIMessage(content=msg.content)
        for msg in (req.history or [])
    ]
    
    user_facts = {}
    if req.user_id:
        try:
            d = get_profileinfo(req.user_id)
            user_facts = {
                "benji_facts": d.benji_facts,
                "height": d.height,
                "weight": d.weight,
            }
        except HTTPException:
            # Profile not found - continue with empty facts
            pass

    # Call chat function, passing LangChain message objects
    reply = benji.chat(req.user_input, history=history_msgs, user_facts=user_facts)

    # Persist chat history to Firestore if user is logged in
    if req.user_id:
        try:
            now = datetime.utcnow().isoformat() + "Z"
            doc_ref = db.collection("ChatHistory").document(req.user_id)
            snap = doc_ref.get()
            
            if snap.exists:
                existing = snap.to_dict()
                messages = existing.get("messages", [])
            else:
                messages = []
            
            # Append user message and assistant reply
            messages.append({"role": "user", "content": req.user_input, "ts": now})
            messages.append({"role": "assistant", "content": reply, "ts": now})
            
            # Trim to last 500 messages if too large
            if len(messages) > 500:
                messages = messages[-500:]
            
            doc_ref.set({"UserID": req.user_id, "messages": messages, "updatedAt": now})
        except Exception as e:
            print(f"Warning: failed to persist chat history for {req.user_id}: {e}")

    return ChatResponse(response=reply)


class ChatHistoryResponse(BaseModel):
    messages: List[Dict[str, str]]


@app.get("/chat-history/{user_id}", response_model=ChatHistoryResponse)
def get_chat_history(user_id: str):
    """Return chat history for a user from Firestore."""
    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get chat history
    doc_ref = db.collection("ChatHistory").document(user_id)
    snap = doc_ref.get()
    
    if not snap.exists:
        return {"messages": []}
    
    data = snap.to_dict()
    messages = data.get("messages", [])
    
    return {"messages": messages}

@app.post("/profileinfo/{user_id}", response_model=ProfileInfoOut)
def create_profileinfo(user_id: str, payload: CreateProfileInfoRequest):
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")

    doc_ref = db.collection("ProfileInfo").document(user_id)
    if doc_ref.get().exists:
        raise HTTPException(status_code=409, detail="ProfileInfo already exists for this user")

    # Build doc_data with PascalCase for Firestore
    doc_data = {
        "UserID": user_id,
        "BenjiFacts": payload.benji_facts or "{}",
        "Height": payload.height,
        "Weight": payload.weight
    }

    # Validate BenjiFacts is valid JSON
    if doc_data.get("BenjiFacts"):
        try:
            json.loads(doc_data["BenjiFacts"])
        except Exception:
            raise HTTPException(status_code=400, detail="BenjiFacts must be a valid JSON string")

    doc_ref.set(doc_data)

    return ProfileInfoOut(
        user_id=user_id,
        benji_facts=doc_data.get("BenjiFacts"),
        height=doc_data.get("Height"),
        weight=doc_data.get("Weight"),
    )

@app.get("/profileinfo/{user_id}", response_model=ProfileInfoOut)
def get_profileinfo(user_id: str):
    snap = db.collection("ProfileInfo").document(user_id).get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="ProfileInfo not found")

    d = snap.to_dict() or {}
    
    benji_facts = d.get("BenjiFacts") or {}
    if isinstance(benji_facts, str):
        try:
            benji_facts = json.loads(benji_facts)
        except json.JSONDecodeError:
            # fallback to empty dict if invalid JSON
            benji_facts = {}
    
    return ProfileInfoOut(
        user_id=user_id,
        benji_facts=d.get("BenjiFacts"),
        height=d.get("Height"),
        weight=d.get("Weight"),
    )

@app.patch("/profileinfo/{user_id}", response_model=ProfileInfoOut)
def update_profileinfo(user_id: str, payload: UpdateProfileInfoRequest):
    doc_ref = db.collection("ProfileInfo").document(user_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="ProfileInfo not found")

    # Map lowercase to PascalCase for Firestore
    updates = {}
    if payload.benji_facts is not None:
        updates["BenjiFacts"] = payload.benji_facts
    if payload.height is not None:
        updates["Height"] = payload.height
    if payload.weight is not None:
        updates["Weight"] = payload.weight

    if "BenjiFacts" in updates:
        try:
            json.loads(updates["BenjiFacts"])
        except Exception:
            raise HTTPException(status_code=400, detail="BenjiFacts must be a valid JSON string")

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    doc_ref.update(updates)

    d = doc_ref.get().to_dict() or {}
    return ProfileInfoOut(
        user_id=user_id,
        benji_facts=d.get("BenjiFacts"),
        height=d.get("Height"),
        weight=d.get("Weight"),
    )


# ---------- Firestore: Goals (accepted + generated) ----------
class GoalsAcceptedRequest(BaseModel):
    goals: List[Dict[str, Any]] = Field(default_factory=list, description="List of accepted goal objects")


@app.get("/goals/{user_id}")
def get_goals(user_id: str, goal_type: Optional[str] = None):
    """Return stored goals for user from Firestore.
    
    Args:
        user_id: The user ID to fetch goals for
        goal_type: Optional filter by type ('wellness' or 'fitness')
    
    Returns:
        List of goal documents for the user
    """
    # Query Goals collection by UserID
    query = db.collection("Goals").where("UserID", "==", user_id)
    
    # Optionally filter by type
    if goal_type:
        query = query.where("type", "==", goal_type)
    
    docs = list(query.limit(100).stream())
    
    goals = []
    for doc in docs:
        d = doc.to_dict()
        d["goal_id"] = doc.id
        goals.append(d)
    
    # Also check legacy format (Goals/{user_id} document with accepted/generated arrays)
    legacy_doc_ref = db.collection("Goals").document(user_id)
    legacy_snap = legacy_doc_ref.get()
    legacy_accepted = []
    legacy_generated = []
    if legacy_snap.exists:
        legacy_data = legacy_snap.to_dict() or {}
        legacy_accepted = legacy_data.get("accepted", [])
        legacy_generated = legacy_data.get("generated", [])
    
    return {
        "goals": goals,
        "accepted": legacy_accepted,
        "generated": legacy_generated,
    }


from google.cloud import firestore

@app.post("/goals/{user_id}/accepted")
def save_goals_accepted(user_id: str, payload: GoalsAcceptedRequest):
    """Save SMART goals as individual documents in Goals collection."""

    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")

    saved_ids = []

    for goal in payload.goals:
        doc_ref = db.collection("Goals").document()

        # Ensure EndDate is a datetime object; if string, convert
        end_date = goal.get("EndDate")
        if isinstance(end_date, str):
            try:
                # Attempt ISO format parsing
                end_date = datetime.datetime.fromisoformat(end_date)
            except ValueError:
                # Fallback: random 3-7 weeks from now
                weeks_offset = random.randint(3, 7)
                end_date = datetime.datetime.utcnow() + datetime.timedelta(weeks=weeks_offset)
        elif not end_date:
            # If EndDate is None, also use random 3-7 weeks
            weeks_offset = random.randint(3, 7)
            end_date = datetime.utcnow() + timedelta(weeks=weeks_offset)

        doc_ref.set({
            "Specific": goal.get("Specific"),
            "Measurable": goal.get("Measurable"),
            "Attainable": goal.get("Attainable"),
            "Relevant": goal.get("Relevant"),
            "Time_Bound": goal.get("Time_Bound"),  # keep as string

            # Goal type: wellness or fitness (default to wellness for backward compat)
            "type": goal.get("type", "wellness"),

            # duplicate for UI convenience
            "Description": goal.get("Specific"),

            # store end date as Firestore timestamp
            "EndDate": end_date,

            # empty structured check-ins
            "CheckIns": {
                "checkins": []
            },

            "DateCreated": firestore.SERVER_TIMESTAMP,
            "UserID": user_id
        })

        saved_ids.append(doc_ref.id)

    return {
        "message": f"{len(saved_ids)} goals saved",
        "goal_ids": saved_ids
    }


# ---------- Firestore: Check-ins ----------
class CheckinCreate(BaseModel):
    model_config = {"extra": "allow"}
    user_id: str
    date: Optional[str] = None


@app.get("/checkins/{user_id}")
def get_checkins(user_id: str):
    """Return check-ins for user from Firestore (e.g. list of docs)."""
    docs = list(db.collection("CheckIns").where("UserID", "==", user_id).limit(100).stream())
    out = []
    for doc in docs:
        d = doc.to_dict()
        d["id"] = doc.id
        out.append(d)
    out.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    return out


@app.post("/checkins")
def create_checkin(payload: CheckinCreate):
    """Save one check-in to Firestore."""
    from datetime import datetime
    user_snap = db.collection("User").document(payload.user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    body = payload.model_dump()
    body["UserID"] = payload.user_id
    body["createdAt"] = datetime.utcnow().isoformat() + "Z"
    doc_ref = db.collection("CheckIns").document()
    doc_ref.set(body)
    return {"message": "Check-in saved", "id": doc_ref.id}


# ---------- Check-in Recommendations ----------
class CheckinRecommendationsRequest(BaseModel):
    user_id: str
    user_message: Optional[str] = None

class CheckinRecommendationsResponse(BaseModel):
    response: str

@app.post("/checkin-recommendations", response_model=CheckinRecommendationsResponse)
def get_checkin_recommendations(payload: CheckinRecommendationsRequest):
    """
    Generate personalized check-in focus areas based on user profile and goals.
    Optionally considers a user message for customized suggestions.
    """
    # Validate user exists
    user_snap = db.collection("User").document(payload.user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Load profile info
    try:
        profile = get_profileinfo(payload.user_id)
        user_facts = {
            "benji_facts": profile.benji_facts,
            "height": profile.height,
            "weight": profile.weight,
        }
    except HTTPException:
        # Profile not found - use empty facts
        user_facts = {}
    
    # Load goals
    try:
        goals_data = get_goals(payload.user_id)
        accepted_goals = goals_data.get("accepted", [])
        if accepted_goals:
            user_facts["goals"] = accepted_goals
    except Exception:
        # Goals not found - continue without
        pass
    
    # Call LLM helper
    response_text = benji.checkin_recommendations(
        user_facts=user_facts,
        user_message=payload.user_message
    )
    
    return CheckinRecommendationsResponse(response=response_text)


@app.delete("/user/{user_id}", response_model=DeleteUserResponse)
def delete_user(user_id: str, payload: LoginRequest):
    """
    Delete a user only if they are that user.
    We verify by requiring valid email/password that authenticates to the same user_id.
    """
    # 1) authenticate credentials -> returns the user's doc id
    authed_user_id = authenticate_firestore(payload.email, payload.password)
    if not authed_user_id:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # 2) must match the requested id
    if authed_user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this user")

    # 3) ensure user exists, then delete
    doc_ref = db.collection("User").document(user_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="User not found")

    doc_ref.delete()

    # (optional) clean up dependent docs
    # db.collection("ProfileInfo").document(user_id).delete()

    return DeleteUserResponse(message="User deleted successfully")


@app.patch("/user/{user_id}", response_model=UpdateUserNameResponse)
def update_user_name(user_id: str, payload: UpdateUserNameRequest):
    """
    Update first and/or last name for a User doc.
    NOTE: Auth is disabled for this endpoint until credentials are available.
    """

    # build optional updates
    updates = {}
    if payload.first_name is not None:
        updates["first_name"] = payload.first_name
    if payload.last_name is not None:
        updates["last_name"] = payload.last_name

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    # ensure user exists then update
    doc_ref = db.collection("User").document(user_id)
    snap = doc_ref.get()
    if not snap.exists:
        raise HTTPException(status_code=404, detail="User not found")

    doc_ref.update(updates)

    return UpdateUserNameResponse(user_id=user_id, message="User updated successfully")


# ---------- Medications (Firestore) ----------
class MedicationItem(BaseModel):
    id: str
    name: str
    strength: str
    frequency: str
    foodInstruction: Optional[str] = None  # "with_food", "empty_stomach", "no_preference"
    notes: Optional[str] = None


class MedicationsListRequest(BaseModel):
    list: List[MedicationItem]


class MedicationsListResponse(BaseModel):
    user_id: str
    list: List[Dict[str, Any]]


@app.get("/medications/{user_id}", response_model=MedicationsListResponse)
def get_medications(user_id: str):
    """Get user's medication list from Firestore."""
    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get medications document
    doc_ref = db.collection("Medications").document(user_id)
    snap = doc_ref.get()
    
    if not snap.exists:
        return MedicationsListResponse(user_id=user_id, list=[])
    
    data = snap.to_dict()
    return MedicationsListResponse(user_id=user_id, list=data.get("list", []))


@app.put("/medications/{user_id}", response_model=MedicationsListResponse)
def update_medications(user_id: str, payload: MedicationsListRequest):
    """Create or update user's medication list in Firestore."""
    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Convert to dict list for Firestore storage
    meds_list = [med.model_dump() for med in payload.list]
    
    # Upsert medications document
    doc_ref = db.collection("Medications").document(user_id)
    doc_ref.set({
        "UserID": user_id,
        "list": meds_list,
        "updatedAt": datetime.utcnow().isoformat() + "Z"
    })
    
    return MedicationsListResponse(user_id=user_id, list=meds_list)


# ---------- Menstrual Flow Log (Firestore) ----------
class MenstrualDayEntry(BaseModel):
    flow: Optional[str] = None  # "none", "light", "medium", "heavy", "clots"
    symptoms: Optional[List[str]] = None  # ["cramps", "headache", ...]
    crampPain: Optional[int] = None  # 0-10
    discharge: Optional[str] = None  # "none", "creamy", "watery", etc.


class MenstrualFlowLogRequest(BaseModel):
    entries: Dict[str, MenstrualDayEntry]  # { "YYYY-MM-DD": { flow?, symptoms?, crampPain?, discharge? }, ... }


class MenstrualFlowLogResponse(BaseModel):
    user_id: str
    entries: Dict[str, Any]


@app.get("/menstrual/{user_id}", response_model=MenstrualFlowLogResponse)
def get_menstrual_flow_log(user_id: str):
    """Get user's menstrual flow log from Firestore."""
    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get menstrual flow log document
    doc_ref = db.collection("MenstrualFlowLog").document(user_id)
    snap = doc_ref.get()
    
    if not snap.exists:
        return MenstrualFlowLogResponse(user_id=user_id, entries={})
    
    data = snap.to_dict()
    return MenstrualFlowLogResponse(user_id=user_id, entries=data.get("entries", {}))


@app.put("/menstrual/{user_id}", response_model=MenstrualFlowLogResponse)
def update_menstrual_flow_log(user_id: str, payload: MenstrualFlowLogRequest):
    """Create or update user's menstrual flow log in Firestore."""
    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Convert entries to dict for Firestore storage
    entries_dict = {date: entry.model_dump(exclude_none=True) for date, entry in payload.entries.items()}
    
    # Upsert menstrual flow log document
    doc_ref = db.collection("MenstrualFlowLog").document(user_id)
    doc_ref.set({
        "UserID": user_id,
        "entries": entries_dict,
        "updatedAt": datetime.utcnow().isoformat() + "Z"
    })
    
    return MenstrualFlowLogResponse(user_id=user_id, entries=entries_dict)


# ---------- Cycle Recommendations (AI-powered) ----------
class CycleRecommendationItem(BaseModel):
    icon: Optional[str] = None  # Font Awesome icon class
    title: str
    text: str


class CycleRecommendationsResponse(BaseModel):
    user_id: str
    current_phase: Optional[str] = None  # "Menstrual", "Follicular", "Ovulation", "Luteal"
    cycle_day: Optional[int] = None  # 1-28
    predicted_period_onset: Optional[str] = None  # Date or range string
    recommendations: List[CycleRecommendationItem] = []
    personalization_notes: Optional[str] = None


@app.get("/menstrual-recommendations/{user_id}", response_model=CycleRecommendationsResponse)
def get_cycle_recommendations(user_id: str):
    """
    Get AI-powered cycle phase recommendations based on user's flow log.
    
    Returns current phase, cycle day, predicted next period onset,
    personalized recommendations, and Benji's notes.
    """
    from backend.llm.tools import CycleRecommendationsAgentTool
    
    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get menstrual flow log from Firestore
    doc_ref = db.collection("MenstrualFlowLog").document(user_id)
    snap = doc_ref.get()
    
    # Handle empty/missing flow log
    if not snap.exists:
        return CycleRecommendationsResponse(
            user_id=user_id,
            current_phase=None,
            cycle_day=None,
            predicted_period_onset=None,
            recommendations=[],
            personalization_notes="Log your flow on the calendar to get personalized phase and period predictions from Benji."
        )
    
    data = snap.to_dict()
    entries = data.get("entries", {})
    
    if not entries:
        return CycleRecommendationsResponse(
            user_id=user_id,
            current_phase=None,
            cycle_day=None,
            predicted_period_onset=None,
            recommendations=[],
            personalization_notes="Log your flow on the calendar to get personalized phase and period predictions from Benji."
        )
    
    # Call the CycleRecommendationsAgentTool
    agent_result = CycleRecommendationsAgentTool(
        flow_log_entries=entries,
        model=benji.model
    )
    
    # Handle fallback (LLM failed)
    if agent_result.get("_fallback"):
        return CycleRecommendationsResponse(
            user_id=user_id,
            current_phase=None,
            cycle_day=None,
            predicted_period_onset=None,
            recommendations=[],
            personalization_notes="I couldn't analyze your cycle data right now. Please try again later, or log more flow data for better predictions."
        )
    
    # Build recommendations list from agent result
    recommendations = []
    for rec in agent_result.get("recommendations", []):
        recommendations.append(CycleRecommendationItem(
            icon=rec.get("icon"),
            title=rec.get("title", ""),
            text=rec.get("text", "")
        ))
    
    return CycleRecommendationsResponse(
        user_id=user_id,
        current_phase=agent_result.get("current_phase"),
        cycle_day=agent_result.get("cycle_day"),
        predicted_period_onset=agent_result.get("predicted_period_onset"),
        recommendations=recommendations,
        personalization_notes=agent_result.get("personalization_notes")
    )


# ---------- Medication Schedule (structured) ----------
class DetailedTimeSlot(BaseModel):
    time: str  # "HH:mm"
    label: str  # "8:00 AM"
    slot: str  # "morning", "afternoon", "evening", "night"
    medications: List[str]
    foodNote: str  # Combined food instructions for meds in this slot


class MedicationScheduleResponse(BaseModel):
    timeSlots: Dict[str, List[str]]
    foodInstructions: List[str]
    warnings: List[str]
    spacingNotes: List[str]
    timeSlotsDetailed: List[DetailedTimeSlot] = []  # New: calendar-style schedule
    personalizationNotes: Optional[str] = None  # AI-generated explanation (only when use_ai=true)


@app.get("/medication-schedule/{user_id}", response_model=MedicationScheduleResponse)
def get_medication_schedule(user_id: str, use_ai: bool = False):
    """
    Generate a structured medication schedule with contraindication warnings.
    
    Args:
        user_id: User ID to fetch medications for
        use_ai: If True, use AI agent for personalized scheduling; if False, use rule-based tool
    
    Uses MedicationScheduleTool (rule-based) or MedicationScheduleAgentTool (AI) from tools.py.
    """
    from backend.llm.tools import MedicationScheduleTool, ContraindicationCheckTool, MedicationScheduleAgentTool
    
    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get medications from Firestore
    doc_ref = db.collection("Medications").document(user_id)
    snap = doc_ref.get()
    
    empty_response = MedicationScheduleResponse(
        timeSlots={"morning": [], "afternoon": [], "evening": [], "night": []},
        foodInstructions=[],
        warnings=["No medications found. Add medications to generate a schedule."],
        spacingNotes=[],
        personalizationNotes=None
    )
    
    if not snap.exists:
        return empty_response
    
    data = snap.to_dict()
    medications = data.get("list", [])
    
    if not medications:
        return empty_response
    
    # Build facts dict for the tools
    facts = {"medications": medications}
    
    # Get contraindication warnings from tool (used in both paths)
    contraindication_result = ContraindicationCheckTool(facts)
    warnings = contraindication_result.get("warnings", [])
    
    # Build food_instructions from medication foodInstruction field
    food_instructions = []
    for med in medications:
        food_inst = med.get("foodInstruction")
        name = med.get("name", "Unknown")
        if food_inst == "with_food":
            instruction = f"{name}: Take with food"
            if instruction not in food_instructions:
                food_instructions.append(instruction)
        elif food_inst == "empty_stomach":
            instruction = f"{name}: Take on empty stomach"
            if instruction not in food_instructions:
                food_instructions.append(instruction)
    
    personalization_notes = None
    time_slots_detailed = []
    spacing_notes = []
    use_ai_time_slots = False  # Flag to track if we used AI's explicit time_slots
    
    if use_ai:
        # --- AI Path: Use MedicationScheduleAgentTool ---
        agent_result = MedicationScheduleAgentTool(
            medications=medications,
            contraindication_warnings=warnings,
            food_instructions=food_instructions,
            model=benji.model
        )
        
        if agent_result.get("_fallback"):
            # AI failed, fall back to rule-based
            schedule_result = MedicationScheduleTool(facts)
        elif agent_result.get("time_slots"):
            # AI returned explicit time_slots (new format)
            use_ai_time_slots = True
            personalization_notes = agent_result.get("personalization_notes")
            spacing_notes = agent_result.get("spacing_notes", [])
            
            # Build timeSlotsDetailed directly from AI's time_slots
            for slot_data in agent_result["time_slots"]:
                time_val = slot_data.get("time", "08:00")
                label = slot_data.get("label", time_val)
                meds = slot_data.get("medications", [])
                food_note = slot_data.get("foodNote", "")
                
                if not meds:
                    continue
                
                # Determine slot name from time for compatibility
                try:
                    hour = int(time_val.split(":")[0])
                    if hour < 10:
                        slot_name = "early_morning"
                    elif hour < 12:
                        slot_name = "morning"
                    elif hour < 14:
                        slot_name = "midday"
                    elif hour < 17:
                        slot_name = "afternoon"
                    elif hour < 20:
                        slot_name = "evening"
                    else:
                        slot_name = "night"
                except:
                    slot_name = "custom"
                
                time_slots_detailed.append(DetailedTimeSlot(
                    time=time_val,
                    label=label,
                    slot=slot_name,
                    medications=meds,
                    foodNote=food_note
                ))
            
            # Sort by time
            time_slots_detailed.sort(key=lambda x: x.time)
            
            # Create schedule_result for backward compatibility (timeSlots dict)
            schedule_result = {
                "morning": [],
                "afternoon": [],
                "evening": [],
                "night": [],
                "spacing_notes": spacing_notes
            }
            # Populate the legacy timeSlots from AI result
            for slot_data in agent_result["time_slots"]:
                time_val = slot_data.get("time", "08:00")
                meds = slot_data.get("medications", [])
                try:
                    hour = int(time_val.split(":")[0])
                    if hour < 12:
                        schedule_result["morning"].extend(meds)
                    elif hour < 17:
                        schedule_result["afternoon"].extend(meds)
                    elif hour < 20:
                        schedule_result["evening"].extend(meds)
                    else:
                        schedule_result["night"].extend(meds)
                except:
                    schedule_result["morning"].extend(meds)
        else:
            # AI returned old format (morning/afternoon/evening/night) - use as-is
            schedule_result = agent_result
            personalization_notes = agent_result.get("personalization_notes")
            spacing_notes = agent_result.get("spacing_notes", [])
    else:
        # --- Standard Path: Use rule-based MedicationScheduleTool ---
        schedule_result = MedicationScheduleTool(facts)
    
    # Add food_instructions from rule-based tool if present
    rule_food_instructions = schedule_result.get("food_instructions", [])
    for instr in rule_food_instructions:
        if instr not in food_instructions:
            food_instructions.append(instr)
    
    # Build timeSlotsDetailed for calendar-style view (only if not already built from AI time_slots)
    if not use_ai_time_slots:
        slot_time_mapping = {
            "morning": ("08:00", "8:00 AM"),
            "afternoon": ("12:00", "12:00 PM"),
            "evening": ("18:00", "6:00 PM"),
            "night": ("21:00", "9:00 PM")
        }
        
        for slot in ["morning", "afternoon", "evening", "night"]:
            meds_in_slot = schedule_result.get(slot, [])
            if not meds_in_slot:
                continue
            
            time_val, label = slot_time_mapping[slot]
            
            # Build foodNote for this slot: match med names to food_instructions
            with_food = []
            empty_stomach = []
            
            for med_str in meds_in_slot:
                # Extract med name from string like "Lisinopril 10 mg" or "Metformin 500 mg (1st dose)"
                med_name_lower = med_str.split()[0].lower() if med_str else ""
                
                # Check food_instructions list
                for instruction in food_instructions:
                    instr_lower = instruction.lower()
                    if med_name_lower and med_name_lower in instr_lower:
                        if "with food" in instr_lower:
                            med_display = med_str.split()[0]  # Just the name
                            if med_display not in with_food:
                                with_food.append(med_display)
                        elif "empty stomach" in instr_lower:
                            med_display = med_str.split()[0]
                            if med_display not in empty_stomach:
                                empty_stomach.append(med_display)
            
            # Build the foodNote string
            food_note_parts = []
            if with_food:
                food_note_parts.append(f"With food: {', '.join(with_food)}")
            if empty_stomach:
                food_note_parts.append(f"On empty stomach: {', '.join(empty_stomach)}")
            food_note = ". ".join(food_note_parts)
            
            time_slots_detailed.append(DetailedTimeSlot(
                time=time_val,
                label=label,
                slot=slot,
                medications=meds_in_slot,
                foodNote=food_note
            ))
        
        spacing_notes = schedule_result.get("spacing_notes", [])
    
    return MedicationScheduleResponse(
        timeSlots={
            "morning": schedule_result.get("morning", []),
            "afternoon": schedule_result.get("afternoon", []),
            "evening": schedule_result.get("evening", []),
            "night": schedule_result.get("night", [])
        },
        foodInstructions=food_instructions,
        warnings=warnings,
        spacingNotes=spacing_notes,
        timeSlotsDetailed=time_slots_detailed,
        personalizationNotes=personalization_notes
    )


# ---------- Medication Compliance ----------
class ComplianceEntry(BaseModel):
    medication_id: str
    medication_name: Optional[str] = None
    taken: bool
    time_taken: Optional[str] = None  # "HH:mm" format


class ComplianceRequest(BaseModel):
    user_id: str
    date: str  # "YYYY-MM-DD"
    entries: List[ComplianceEntry]


class ComplianceResponse(BaseModel):
    user_id: str
    date: str
    entries: List[Dict[str, Any]]


class HealthHistoryResponse(BaseModel):
    days: List[Dict[str, Any]]


@app.get("/compliance/{user_id}")
def get_compliance(user_id: str, date: Optional[str] = None, from_date: Optional[str] = None, to_date: Optional[str] = None):
    """
    Get medication compliance for a specific date or date range.
    - If 'date' is provided, return compliance for that single day.
    - If 'from_date' and 'to_date' are provided, return compliance for that range.
    - If no date params, return today's compliance.
    """
    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Default to today if no date provided
    if not date and not from_date:
        date = datetime.utcnow().strftime("%Y-%m-%d")
    
    if date:
        # Single day query
        doc_id = f"{user_id}_{date}"
        doc_ref = db.collection("MedicationCompliance").document(doc_id)
        snap = doc_ref.get()
        
        if not snap.exists:
            return ComplianceResponse(user_id=user_id, date=date, entries=[])
        
        data = snap.to_dict()
        return ComplianceResponse(user_id=user_id, date=date, entries=data.get("entries", []))
    
    # Date range query (uses composite index: user_id ASC, date DESC)
    if from_date and to_date:
        docs = db.collection("MedicationCompliance") \
            .where("user_id", "==", user_id) \
            .where("date", ">=", from_date) \
            .where("date", "<=", to_date) \
            .order_by("date", direction=firestore.Query.DESCENDING) \
            .limit(100) \
            .stream()
        
        results = []
        for doc in docs:
            d = doc.to_dict()
            results.append({
                "date": d.get("date"),
                "entries": d.get("entries", [])
            })
        
        return {"user_id": user_id, "days": results}
    
    return ComplianceResponse(user_id=user_id, date=date or "", entries=[])


@app.post("/compliance", response_model=ComplianceResponse)
def save_compliance(payload: ComplianceRequest):
    """Save/update medication compliance for a specific date."""
    # Validate user exists
    user_snap = db.collection("User").document(payload.user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Document ID is user_id + date for easy lookup
    doc_id = f"{payload.user_id}_{payload.date}"
    
    # Convert entries to dict list
    entries_list = [entry.model_dump() for entry in payload.entries]
    
    # Enrich entries with medication names from Medications collection if not provided
    meds_doc = db.collection("Medications").document(payload.user_id).get()
    if meds_doc.exists:
        meds_data = meds_doc.to_dict()
        meds_list = {m.get("id"): m.get("name", "Unknown") for m in meds_data.get("list", [])}
        for entry in entries_list:
            if not entry.get("medication_name"):
                entry["medication_name"] = meds_list.get(entry.get("medication_id"), "Unknown")
    
    # Upsert compliance document
    doc_ref = db.collection("MedicationCompliance").document(doc_id)
    doc_ref.set({
        "user_id": payload.user_id,
        "date": payload.date,
        "entries": entries_list,
        "updatedAt": datetime.utcnow().isoformat() + "Z"
    })
    
    return ComplianceResponse(user_id=payload.user_id, date=payload.date, entries=entries_list)


@app.get("/health-history/{user_id}", response_model=HealthHistoryResponse)
def get_health_history(user_id: str, limit: int = 30):
    """
    Get health history (medication compliance) for the journal.
    Returns the last N days of compliance data.
    """
    # Validate user exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Query compliance documents (uses composite index: user_id ASC, date DESC)
    docs = db.collection("MedicationCompliance") \
        .where("user_id", "==", user_id) \
        .order_by("date", direction=firestore.Query.DESCENDING) \
        .limit(limit) \
        .stream()
    
    days = []
    for doc in docs:
        d = doc.to_dict()
        days.append({
            "date": d.get("date"),
            "entries": d.get("entries", [])
        })
    
    return HealthHistoryResponse(days=days)


# Favicon: avoid 404 when browser requests /favicon.ico
@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)

# Serve frontend static files (HTML, CSS, JS, assets) so /html/chat.html etc. work
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_FRONTEND_DIR = os.path.join(_PROJECT_ROOT, "frontend")
if os.path.isdir(_FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
