from fastapi import FastAPI
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


from backend.llm.client import BenjiLLM

app = FastAPI(
    title="BenjiLLM API",
    description="Agentic fitness recommendation system",
    version="0.1.0",
)

benji = BenjiLLM()

class RunRequest(BaseModel):
    user_input: str = Field(
        ...,
        example="I want to get much stronger and improve my fitness"
    )
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

@app.post("/run", response_model=RunResponse)
def run_agent(payload: RunRequest):
    """
    Run BenjiLLM with optional pre-known user facts.
    """
    output = benji.run(
        user_input=payload.user_input,
        user_facts=payload.user_facts,
    )
    return {"response": output}