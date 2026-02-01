from typing import Dict, List
from datetime import datetime
from langchain_core.messages import SystemMessage, HumanMessage
import json


# -----------------------------
# PROFILE / GOAL TOOLS
# -----------------------------

def FitnessGoalTypeTool(facts: Dict) -> Dict:
    goal = (facts.get("goal") or "").lower()

    #Export this mapping to be env wide
    mapping = {
        "lose": "weight_loss",
        "cut": "weight_loss",
        "gain": "weight_gain",
        "bulk": "weight_gain",
        "recomp": "body_recomposition",
        "muscle": "muscle_strength",
        "strength": "muscle_strength",
        "cardio": "cardio_endurance",
        "run": "cardio_endurance",
        "mobility": "mobility",
        "injury": "injury_recovery",
        "rehab": "injury_recovery",
        "sport": "sport_performance"
    }

    for k, v in mapping.items():
        if k in goal:
            return {"goal_type": v, "confidence": 0.9}

    return {"goal_type": "general_fitness", "confidence": 0.5}


def BodyStatsTool(facts: Dict) -> Dict:
    weight = facts.get("weight")
    height = facts.get("height")

    bmi = None
    try:
        if isinstance(height, (int, float)):
            bmi = round((weight / (height ** 2)) * 703, 1)
    except:
        pass

    return {
        "age": facts.get("age"),
        "weight": weight,
        "height": height,
        "bmi_estimate": bmi
    }


# -----------------------------
# DAILY CHECK-IN
# -----------------------------

def DailyCheckinTool(checkin: Dict) -> Dict:
    scores = [
        checkin.get("sleep", 3),
        checkin.get("stress", 3),
        checkin.get("mood", 3),
        checkin.get("fitness", 3)
    ]

    day_score = round(sum(scores) / len(scores), 2)

    flags = []
    if checkin.get("sleep", 5) <= 2:
        flags.append("low_sleep")
    if checkin.get("stress", 1) >= 4:
        flags.append("high_stress")

    return {
        "day_score": day_score,
        "recovery_day": checkin.get("recovery_day", False),
        "flags": flags
    }


def RecoveryStatusTool(checkin: Dict) -> Dict:
    if checkin.get("recovery_day"):
        return {
            "is_recovery_day": True,
            "message": "Focus on hydration, mobility, and good nutrition."
        }

    return {"is_recovery_day": False}


# -----------------------------
# TREND ANALYSIS
# -----------------------------

def AnalyzeTrendTool(history: List[Dict]) -> Dict:
    if not history:
        return {"insights": []}

    avg_sleep = sum(d.get("sleep", 3) for d in history) / len(history)
    avg_stress = sum(d.get("stress", 3) for d in history) / len(history)

    insights = []

    if avg_sleep < 3:
        insights.append("Sleep has been low recently.")
    if avg_stress > 3.5:
        insights.append("Stress levels are elevated.")

    return {
        "avg_sleep": round(avg_sleep, 2),
        "avg_stress": round(avg_stress, 2),
        "insights": insights
    }


# -----------------------------
# PLANNING
# -----------------------------

def FitnessPlanTool(profile: Dict, goal_type: str) -> Dict:
    base = {
        "weight_loss": "30 min cardio + calorie deficit",
        "weight_gain": "Strength training + calorie surplus",
        "muscle_strength": "Progressive overload lifting",
        "cardio_endurance": "Zone 2 cardio 40 mins",
        "mobility": "20 min mobility routine",
        "injury_recovery": "Rehab exercises and rest",
        "sport_performance": "Sport-specific drills",
        "general_fitness": "Balanced strength + cardio"
    }

    focus = base.get(goal_type, base["general_fitness"])

    return {
        "today": focus,
        "tomorrow": "Light activity or walking 15-20 mins",
        "weekly_focus": goal_type
    }


def NutritionTool(facts: Dict) -> Dict:
    weight = facts.get("weight", 170)

    protein = round(weight * 0.8)
    calories = weight * 14

    return {
        "calories_target": calories,
        "protein_target": protein,
        "hydration_target": "2-3L daily"
    }


def WellnessPlanTool(profile: Dict) -> Dict:
    return {
        "sleep_target": "7-9 hours",
        "hydration_reminder": True,
        "stress_tip": "5-minute breathing exercise"
    }


# -----------------------------
# PROGRESS
# -----------------------------

def GoalProgressTool(goal: Dict, history: List[Dict]) -> Dict:
    duration = goal.get("duration_days", 30)
    start = goal.get("start_date")

    if not start:
        return {"completion_pct": 0}

    days_passed = (datetime.now() - datetime.fromisoformat(start)).days
    pct = min(100, int((days_passed / duration) * 100))

    return {
        "completion_pct": pct,
        "days_remaining": max(0, duration - days_passed),
        "on_track": pct < 100
    }


# -----------------------------
# SAFETY
# -----------------------------

def InjurySafetyTool(facts: Dict, checkin: Dict) -> Dict:
    pain = checkin.get("pain", 0)

    if pain >= 6:
        return {
            "risk_level": "high",
            "restrictions": ["avoid heavy lifting"]
        }

    return {"risk_level": "low"}


# -----------------------------
# RECAP
# -----------------------------

def WeeklyFitnessRecapTool(history: List[Dict]) -> Dict:
    if not history:
        return {}

    avg = sum(d.get("day_score", 5) for d in history) / len(history)

    return {
        "avg_score": round(avg, 2),
        "days_logged": len(history),
        "summary": "Consistent effort this week."
    }


def WellnessEmotionEvalTool(history: List[Dict]) -> Dict:
    moods = [d.get("mood", 3) for d in history]
    avg = sum(moods) / len(moods) if moods else 3

    return {
        "mood_trend": "down" if avg < 3 else "stable",
        "avg_mood": round(avg, 2)
    }
    
    
def UpcomingPlanTool(facts: Dict, smart_goals: list, model) -> Dict:
    """
    Generate a 2-day actionable preview plan based on SMART goals and user facts.

    Returns structured JSON schedule.
    """

    prompt = (
        "You are a professional fitness coach creating a short actionable schedule.\n\n"

        "The schedule MUST directly support the user's SMART goals.\n"
        "Every activity must clearly move the user closer to those goals.\n"
        "Do NOT include generic filler tasks.\n\n"

        "Using the SMART goals and user context below, generate a focused plan for:\n"
        "- Today\n"
        "- Tomorrow\n\n"

        "Each day should include 2-4 short actionable activities.\n"
        "Activities must:\n"
        "- Be directly tied to the SMART goals\n"
        "- Match the user's fitness level and situation\n"
        "- Be realistic and safe\n"
        "- Include training, recovery, or nutrition if relevant\n\n"

        "IMPORTANT RULES:\n"
        "- Speak as a coach giving instructions\n"
        "- Keep activities concise (checklist style)\n"
        "- Avoid vague advice\n"
        "- Prioritize goal-driven actions over general wellness\n\n"

        "USER CONTEXT:\n"
        f"{json.dumps(facts, indent=2)}\n\n"

        "SMART GOALS:\n"
        f"{json.dumps(smart_goals, indent=2)}\n\n"

        "Return STRICT JSON in this format:\n\n"

        "{\n"
        '  "upcoming": {\n'
        '    "today": ["activity 1", "activity 2"],\n'
        '    "tomorrow": ["activity 1", "activity 2"]\n'
        "  }\n"
        "}\n\n"

        "Do not include explanations.\n"
        "Do not include markdown.\n"
        "Only output JSON.\n"
    )

    
    print(prompt)

    messages = [
        SystemMessage(content="You are a smart fitness planning agent that outputs only valid JSON."),
        HumanMessage(content=prompt)
    ]

    response = model.invoke(messages)
    raw = response.content.strip()

    # Strip markdown if model adds it
    if raw.startswith("```"):
        lines = raw.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        raw = "\n".join(lines)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        data = {
            "upcoming": {
                "today": [],
                "tomorrow": []
            }
        }

    return data

def BenjiGoalsTool(facts: Dict, user_goal: str, model) -> Dict:
    """
    Generate SMART goals using the LLM based on user facts + goal.
    
    model = ChatGoogleGenerativeAI instance
    """

    prompt = (
        "You are a professional fitness coach.\n\n"
        "Given the user's goal and known facts, generate 1-3 SMART goals.\n\n"
        "SMART = Specific, Measurable, Attainable, Relevant, Time-bound.\n\n"
        "IMPORTANT: The Measurable field must contain a numeric/quantifiable target "
        "Return STRICT JSON in this format:\n\n"
        "{\n"
        '  "smart_goals": [\n'
        "    {\n"
        '      "Specific": \"...\",\n'
        '      "Measurable": \"...\",\n'
        '      "Attainable": \"...\",\n'
        '      "Relevant": \"...\",\n'
        '      "Time_Bound": \"...\"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Do not include explanations.\n"
        "Do not include markdown.\n"
        "Only output JSON.\n\n"
        f"USER GOAL:\n{user_goal}\n\n"
        f"USER FACTS:\n{json.dumps(facts, indent=2)}"
    )

    messages = [
        SystemMessage(content="You are a smart fitness agent that outputs only valid JSON."),
        HumanMessage(content=prompt)
    ]

    response = model.invoke(messages)
    raw = response.content.strip()

    # Strip markdown code blocks if model adds them
    if raw.startswith("```"):
        lines = raw.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        raw = "\n".join(lines)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Safe fallback
        data = {
            "smart_goals": []
        }

    return data
    

# -----------------------------
# MEDICATION MANAGEMENT
# -----------------------------

def MedicationScheduleTool(facts: Dict) -> Dict:
    """
    Generate a medication schedule from user's medication list.
    Returns a schedule with timing, contraindications, and food instructions.
    """
    medications = facts.get("medications", [])
    
    if not medications:
        return {"schedule": [], "message": "No medications found"}
    
    # Build schedule with time-of-day recommendations
    schedule = {
        "morning": [],
        "afternoon": [],
        "evening": [],
        "night": [],
        "contraindications": [],
        "food_instructions": [],
        "spacing_notes": []
    }
    
    # Common timing patterns
    morning_keywords = ["morning", "am", "breakfast", "wake"]
    afternoon_keywords = ["afternoon", "lunch", "noon", "midday"]
    evening_keywords = ["evening", "dinner", "pm"]
    night_keywords = ["night", "bedtime", "sleep", "before bed"]
    
    # Parse frequency and assign time slots
    # For demo: when frequency is unclear, alternate between morning and evening (8 AM / 6 PM)
    default_slot_cycle = ["morning", "evening"]
    default_slot_index = [0]  # use list so we can mutate inside loop

    for med in medications:
        name = med.get("name", "Unknown")
        strength = med.get("strength", "")
        frequency = med.get("frequency", "").lower()
        
        med_info = f"{name} {strength}"
        
        # Determine time slot based on frequency
        if any(kw in frequency for kw in morning_keywords):
            schedule["morning"].append(med_info)
        elif any(kw in frequency for kw in night_keywords):
            schedule["night"].append(med_info)
        elif any(kw in frequency for kw in evening_keywords):
            schedule["evening"].append(med_info)
        elif any(kw in frequency for kw in afternoon_keywords):
            schedule["afternoon"].append(med_info)
        elif "twice" in frequency or "2x" in frequency:
            schedule["morning"].append(f"{med_info} (1st dose)")
            schedule["evening"].append(f"{med_info} (2nd dose)")
        elif "three times" in frequency or "3x" in frequency:
            schedule["morning"].append(f"{med_info} (1st dose)")
            schedule["afternoon"].append(f"{med_info} (2nd dose)")
            schedule["evening"].append(f"{med_info} (3rd dose)")
        else:
            # Distribute between morning and evening for demo (avoid stacking all at 8 AM)
            slot = default_slot_cycle[default_slot_index[0] % len(default_slot_cycle)]
            default_slot_index[0] += 1
            schedule[slot].append(med_info)
        
        # Food instructions
        if "with food" in frequency or "with meal" in frequency:
            schedule["food_instructions"].append(f"{name}: Take with food")
        elif "empty stomach" in frequency or "without food" in frequency:
            schedule["food_instructions"].append(f"{name}: Take on empty stomach")
    
    return schedule


def ContraindicationCheckTool(facts: Dict) -> Dict:
    """
    Check for drug-drug interactions and food contraindications.
    Returns warnings and recommendations.
    """
    medications = facts.get("medications", [])
    
    if len(medications) < 2:
        return {"warnings": [], "message": "Need at least 2 medications to check interactions"}
    
    warnings = []
    
    # Extract medication names (lowercase for comparison)
    med_names = [med.get("name", "").lower() for med in medications]
    
    # Common contraindication patterns (simplified for MVP)
    contraindications = {
        "warfarin": ["aspirin", "ibuprofen", "naproxen", "nsaid"],
        "aspirin": ["warfarin", "ibuprofen", "naproxen"],
        "lisinopril": ["potassium", "spironolactone"],
        "metformin": ["alcohol"],
        "simvastatin": ["grapefruit"],
        "atorvastatin": ["grapefruit"],
        "levothyroxine": ["calcium", "iron"],
        "omeprazole": ["clopidogrel"],
    }
    
    # Check for interactions
    for i, med1 in enumerate(med_names):
        for med2 in med_names[i+1:]:
            # Check if med1 has known interactions with med2
            for drug, interacts_with in contraindications.items():
                if drug in med1:
                    if any(interaction in med2 for interaction in interacts_with):
                        warnings.append(
                            f"CAUTION: Potential interaction between {medications[i].get('name')} "
                            f"and {medications[med_names.index(med2)].get('name')}. "
                            f"Space doses apart and consult your doctor."
                        )
                
                if drug in med2:
                    if any(interaction in med1 for interaction in interacts_with):
                        warnings.append(
                            f"CAUTION: Potential interaction between {medications[med_names.index(med2)].get('name')} "
                            f"and {medications[i].get('name')}. "
                            f"Space doses apart and consult your doctor."
                        )
    
    # General timing recommendations if multiple medications
    if len(medications) >= 2 and not warnings:
        warnings.append(
            "TIP: When taking multiple medications, space them at least 1-2 hours apart "
            "unless instructed otherwise by your healthcare provider."
        )
    
    return {
        "warnings": warnings,
        "interaction_count": len([w for w in warnings if "CAUTION" in w])
    }


# -----------------------------
# TOOL REGISTRIES
# -----------------------------

#Adjust to be based on front end splits

MANDATORY_TOOLS = {
    "goal_type": FitnessGoalTypeTool,
    "body_stats": BodyStatsTool,
    "daily_checkin": DailyCheckinTool,
    "fitness_plan": FitnessPlanTool,
    "goal_progress": GoalProgressTool,
}

OPTIONAL_TOOLS = {
    "nutrition": NutritionTool,
    "wellness_plan": WellnessPlanTool,
    "trend_analysis": AnalyzeTrendTool,
    "injury_safety": InjurySafetyTool,
    "weekly_recap": WeeklyFitnessRecapTool,
    "emotion_eval": WellnessEmotionEvalTool,
    "medication_schedule": MedicationScheduleTool,
    "contraindication_check": ContraindicationCheckTool,
}
