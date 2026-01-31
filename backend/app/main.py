from fastapi import FastAPI, HTTPException
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from hashlib import sha256
from uuid import uuid4
from fastapi.middleware.cors import CORSMiddleware

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

class CreateProfileInfoRequest(BaseModel):
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

class ProfileInfoOut(BaseModel):
    profile_id: str
    user_id: str
    benji_facts: Optional[str] = None
    height: Optional[str] = None
    weight: Optional[str] = None


class CreateProfileInfoRequest(BaseModel):
    user_id: str
    benji_facts: Optional[str] = None
    height: str
    weight: str

class CreateProfileInfoResponse(BaseModel):
    profile_id: str
    message: str


class RunGoalsRequest(BaseModel):
    user_goal: str
    user_facts: Optional[Dict] = None
    user_id: Optional[str] = None

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


@app.post("/goals", response_model=RunGoalsResponse)
def run_goals_endpoint(payload: RunGoalsRequest):
    """
    Generate SMART goals for a user's input goal and optionally persist to user facts.
    """
    try:
        result = benji.run_goals(
            user_goal=payload.user_goal,
            user_facts=payload.user_facts,
            user_id=payload.user_id
        )
        # Return only the smart_goals list
        smart_goals = result.get("smart_goals", [])
        return {"smart_goals": smart_goals}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


#STARTING USER DATA PULLS

@app.get("/firebase/health")
def firebase_health():
    """
    Test Firestore connectivity.
    """
    ref = db.collection("debug").document("api_health")
    ref.set({"ok": True})
    doc = ref.get()
    return {"firestore": "ok", "db": "benji", "doc": doc.to_dict()}

@app.post("/profileinfo/{user_id}", response_model=ProfileInfoOut)
def create_profileinfo(user_id: str, payload: CreateProfileInfoRequest):
    # Optional: verify the User exists
    user_snap = db.collection("User").document(user_id).get()
    if not user_snap.exists:
        raise HTTPException(status_code=404, detail="User not found")

    doc_ref = db.collection("ProfileInfo").document(user_id)

    if doc_ref.get().exists:
        raise HTTPException(status_code=409, detail="ProfileInfo already exists for this user")

    doc_data = {"UserID": user_id}

    if payload.benji_facts is not None:
        doc_data["BenjiFacts"] = payload.benji_facts
    if payload.height is not None:
        doc_data["Height"] = payload.height
    if payload.weight is not None:
        doc_data["Weight"] = payload.weight

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

    updates = {}
    if payload.benji_facts is not None:
        updates["BenjiFacts"] = payload.benji_facts
    if payload.height is not None:
        updates["Height"] = payload.height
    if payload.weight is not None:
        updates["Weight"] = payload.weight

    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    # UserID is untouched because we never update it
    doc_ref.update(updates)

    d = (doc_ref.get().to_dict() or {})
    return ProfileInfoOut(
        user_id=user_id,
        benji_facts=d.get("BenjiFacts"),
        height=d.get("Height"),
        weight=d.get("Weight"),
    )
