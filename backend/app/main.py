from fastapi import FastAPI, HTTPException
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field
from hashlib import sha256
from uuid import uuid4
from fastapi.middleware.cors import CORSMiddleware

import json
import os

from backend.llm.client import BenjiLLM

app = FastAPI(
    title="BenjiLLM API",
    description="Agentic fitness recommendation system",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or restrict to your frontend URL like ["http://localhost:5500"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

benji = BenjiLLM()

USERS_DB_FILE = os.path.join("backend", "users.json")
if not os.path.exists(USERS_DB_FILE):
    with open(USERS_DB_FILE, "w") as f:
        json.dump({}, f)
        
class SignupRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
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
            "goal": "build muscle"
        },
        example={
            "age": 30,
            "weight": 180,
            "height": "5'10\"",
            "fitness_level": "intermediate",
            "goal": "build muscle"
        },
        description="Optional structured facts about the user. Used by tools like BodyStatsTool."
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
            "goal": "build muscle"
        },
        example={
            "age": 30,
            "weight": 180,
            "height": "5'10\"",
            "fitness_level": "intermediate",
            "goal": "build muscle"
        },
        description="Optional structured facts about the user. Used by tools like BodyStatsTool."
    )


class RunResponse(BaseModel):
    response: str
    

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

def hash_password(password: str) -> str:
    return sha256(password.encode()).hexdigest()

def authenticate(username: str, password: str) -> Optional[str]:
    """
    Returns user_id if authentication succeeds, None otherwise.
    """
    users = load_users()
    for uid, user in users.items():
        if user["username"] == username and user["password"] == hash_password(password):
            return uid
    return None

def get_user_by_id(user_id: str) -> Optional[dict]:
    users = load_users()
    return users.get(user_id)

@app.post("/signup", response_model=LoginResponse)
def signup(request: SignupRequest):
    users = load_users()
    # Check for existing username
    if any(user["username"] == request.username for user in users.values()):
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user_id
    user_id = str(uuid4())
    users[user_id] = {
        "username": request.username,
        "password": hash_password(request.password),
        "user_facts": {}
    }
    save_users(users)
    return LoginResponse(user_id=user_id, message="User created successfully")

@app.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    user_id = authenticate(request.username, request.password)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid username or password")
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