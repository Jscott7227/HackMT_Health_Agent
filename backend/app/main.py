from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from hashlib import sha256
from uuid import uuid4
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from datetime import datetime

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
        d =  get_profileinfo(payload.user_id)

        user_facts = {
            "benji_facts": d.benji_facts,
            "height": d.height,
            "weight": d.weight,
        }
        
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
def get_goals(user_id: str):
    """Return stored goals for user (accepted and optionally generated) from Firestore."""
    doc_ref = db.collection("Goals").document(user_id)
    snap = doc_ref.get()
    if not snap.exists:
        return {"accepted": [], "generated": []}
    d = snap.to_dict() or {}
    return {
        "accepted": d.get("accepted", []),
        "generated": d.get("generated", []),
    }


@app.post("/goals/{user_id}/accepted")
def save_goals_accepted(user_id: str, payload: GoalsAcceptedRequest):
    """Save accepted goals for user in Firestore."""
    print(user_id)
    user_snap = db.collection("User").document(user_id).get()
    print(user_snap.exists)
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")
    doc_ref = db.collection("Goals").document(user_id)
    print("TEST")
    doc_ref.set({"UserID": user_id, "accepted": payload.goals}, merge=True)
    return {"message": "Goals saved", "goals": payload.goals}


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


# Favicon: avoid 404 when browser requests /favicon.ico
@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return Response(status_code=204)

# Serve frontend static files (HTML, CSS, JS, assets) so /html/chat.html etc. work
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_FRONTEND_DIR = os.path.join(_PROJECT_ROOT, "frontend")
if os.path.isdir(_FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
