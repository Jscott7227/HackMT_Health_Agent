from typing import Dict, List
from datetime import datetime, timedelta
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
    Generate SMART goals + computed end date.
    """

    prompt = (
        "You are a professional fitness coach.\n\n"
        "Generate 1-3 SMART goals.\n\n"
        "SMART = Specific, Measurable, Attainable, Relevant, Time-bound.\n\n"
        "IMPORTANT RULES:\n"
        "- Measurable must contain a numeric target\n"
        "- Duration_Days must be an integer number of days\n"
        "- Duration_Days represents how long the goal lasts\n\n"
        "Return STRICT JSON:\n\n"
        "{\n"
        '  "smart_goals": [\n'
        "    {\n"
        '      "Specific": \"...\",\n'
        '      "Measurable": \"...\",\n'
        '      "Attainable": \"...\",\n'
        '      "Relevant": \"...\",\n'
        '      "Time_Bound": \"...\",\n'
        '      "Duration_Days": 30\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Only output JSON.\n\n"
        f"USER GOAL:\n{user_goal}\n\n"
        f"USER FACTS:\n{json.dumps(facts, indent=2)}"
    )

    messages = [
        SystemMessage(content="Output only valid JSON."),
        HumanMessage(content=prompt)
    ]

    response = model.invoke(messages)
    raw = response.content.strip()

    # Remove markdown fences if present
    if raw.startswith("```"):
        lines = raw.split("\n")[1:-1]
        raw = "\n".join(lines)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {"smart_goals": []}

    # Compute end dates using server time
    now = datetime.utcnow()

    for goal in data.get("smart_goals", []):
        days = goal.get("Duration_Days", 30)
        goal["EndDate"] = now + timedelta(days=int(days))

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


def MedicationScheduleAgentTool(
    medications: List[Dict],
    contraindication_warnings: List[str],
    food_instructions: List[str],
    model
) -> Dict:
    """
    Generate a personalized medication schedule using LLM with explicit time slots.
    
    Args:
        medications: List of medication dicts with name, strength, frequency, foodInstruction, notes
        contraindication_warnings: Pre-computed warnings from ContraindicationCheckTool
        food_instructions: List of food instruction strings
        model: ChatGoogleGenerativeAI instance
    
    Returns:
        Dict with time_slots (explicit times 6 AM - 10 PM), spacing_notes, personalization_notes
        Or {"_fallback": True} if LLM fails
    """
    if not medications:
        return {"_fallback": True}
    
    # Build list of medication names for validation
    med_names = [f"{m.get('name', 'Unknown')} {m.get('strength', '')}".strip() for m in medications]
    
    # Build the prompt with explicit time slots (6 AM - 10 PM)
    prompt = (
        "You are a medication scheduling assistant. Your role is to recommend SPECIFIC TIMES "
        "between 6:00 AM and 10:00 PM to take each medication.\n\n"
        
        "IMPORTANT RULES:\n"
        "- Do NOT give dosing or medical advice.\n"
        "- Only recommend WHEN (specific time of day) to take each medication.\n"
        "- Always recommend consulting a healthcare provider for medical decisions.\n"
        "- You MUST use specific times, NOT generic slots like 'morning' or 'evening'.\n\n"
        
        "AVAILABLE TIME SLOTS (use any of these, or times in between):\n"
        "- 06:00 (6:00 AM) - Early morning, before breakfast\n"
        "- 07:00 (7:00 AM) - Morning, before or with breakfast\n"
        "- 08:00 (8:00 AM) - With breakfast\n"
        "- 10:00 (10:00 AM) - Mid-morning\n"
        "- 12:00 (12:00 PM) - With lunch\n"
        "- 14:00 (2:00 PM) - Afternoon\n"
        "- 18:00 (6:00 PM) - With dinner\n"
        "- 20:00 (8:00 PM) - Evening\n"
        "- 21:00 (9:00 PM) - Before bed\n"
        "- 22:00 (10:00 PM) - Bedtime\n\n"
        
        "SCHEDULING GUIDELINES:\n"
        "1. **SPACING**: Medications with contraindications or interactions MUST be placed at least 2 hours apart.\n"
        "   - If two medications interact, put them at different times (e.g., 6:00 AM and 8:00 AM).\n"
        "   - Document this in spacing_notes.\n\n"
        "2. **EMPTY STOMACH medications** (foodInstruction='empty_stomach'):\n"
        "   - Schedule at 6:00 AM or 7:00 AM (30-60 min before breakfast)\n"
        "   - OR at 21:00 or 22:00 (before bed, 2+ hours after dinner)\n"
        "   - Set foodNote to 'Take on empty stomach'\n\n"
        "3. **WITH FOOD medications** (foodInstruction='with_food'):\n"
        "   - Schedule at meal times: 08:00 (breakfast), 12:00 (lunch), or 18:00 (dinner)\n"
        "   - Set foodNote to 'Take with food'\n\n"
        "4. **FREQUENCY**:\n"
        "   - 'once daily': Pick the single best time based on medication type and food requirements\n"
        "   - 'twice daily': Space at least 10-12 hours apart (e.g., 07:00 and 19:00)\n"
        "   - 'three times daily': Space 5-6 hours apart (e.g., 07:00, 13:00, 19:00)\n\n"
        "5. **COMMON MEDICATION KNOWLEDGE**:\n"
        "   - Levothyroxine: 06:00 AM on empty stomach (30-60 min before food)\n"
        "   - Metformin: with meals (08:00, 12:00, 18:00) to reduce GI side effects\n"
        "   - Blood pressure meds (lisinopril, amlodipine): morning (07:00 or 08:00)\n"
        "   - Statins (simvastatin, atorvastatin): evening/night (20:00 or 21:00)\n"
        "   - Proton pump inhibitors (omeprazole): 06:00-07:00 AM before breakfast\n"
        "   - Calcium/Iron supplements: space 2+ hours from thyroid meds\n\n"
        
        f"MEDICATIONS TO SCHEDULE:\n{json.dumps(medications, indent=2)}\n\n"
        
        f"CONTRAINDICATION WARNINGS (MUST respect spacing):\n{json.dumps(contraindication_warnings, indent=2)}\n\n"
        
        f"FOOD INSTRUCTIONS:\n{json.dumps(food_instructions, indent=2)}\n\n"
        
        "OUTPUT FORMAT - Return STRICT JSON only, no markdown:\n"
        "{\n"
        '  "time_slots": [\n'
        '    {\n'
        '      "time": "06:00",\n'
        '      "label": "6:00 AM",\n'
        '      "medications": ["Levothyroxine 50 mcg"],\n'
        '      "foodNote": "Take on empty stomach, 30-60 min before breakfast"\n'
        '    },\n'
        '    {\n'
        '      "time": "08:00",\n'
        '      "label": "8:00 AM",\n'
        '      "medications": ["Metformin 500 mg (1st dose)", "Lisinopril 10 mg"],\n'
        '      "foodNote": "Take with breakfast"\n'
        '    },\n'
        '    {\n'
        '      "time": "18:00",\n'
        '      "label": "6:00 PM",\n'
        '      "medications": ["Metformin 500 mg (2nd dose)"],\n'
        '      "foodNote": "Take with dinner"\n'
        '    },\n'
        '    {\n'
        '      "time": "21:00",\n'
        '      "label": "9:00 PM",\n'
        '      "medications": ["Atorvastatin 20 mg"],\n'
        '      "foodNote": ""\n'
        '    }\n'
        '  ],\n'
        '  "spacing_notes": [\n'
        '    "Levothyroxine at 6:00 AM, Metformin at 8:00 AM - spaced 2 hours apart as thyroid meds should be taken separately."\n'
        '  ],\n'
        '  "personalization_notes": "This schedule spaces thyroid medication from other meds, aligns Metformin with meals to reduce GI issues, and places the statin at night for optimal effectiveness."\n'
        "}\n\n"
        
        "CRITICAL REQUIREMENTS:\n"
        "1. Assign EVERY medication to at least one time slot. Do not skip any.\n"
        "2. Use specific times (HH:mm format) between 06:00 and 22:00.\n"
        "3. Each time_slot must have: time, label, medications (array), foodNote (string).\n"
        "4. Sort time_slots by time (earliest first).\n"
        "5. Include spacing_notes explaining any timing decisions for interactions.\n"
        "6. Include personalization_notes summarizing the overall schedule rationale.\n"
        "Only output JSON. No explanations outside the JSON."
    )
    
    messages = [
        SystemMessage(content="You are a medication scheduling assistant that outputs only valid JSON with specific times. Do not give medical advice, only timing recommendations. Use times between 06:00 and 22:00."),
        HumanMessage(content=prompt)
    ]
    
    try:
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
        
        data = json.loads(raw)
        
        # Validate time_slots exists and is a list
        if "time_slots" not in data or not isinstance(data.get("time_slots"), list):
            print("MedicationScheduleAgentTool: Missing or invalid time_slots")
            return {"_fallback": True}
        
        time_slots = data["time_slots"]
        
        # Validate each time slot has required fields
        for slot in time_slots:
            if not isinstance(slot, dict):
                print("MedicationScheduleAgentTool: time_slot is not a dict")
                return {"_fallback": True}
            if "time" not in slot or "medications" not in slot:
                print("MedicationScheduleAgentTool: time_slot missing time or medications")
                return {"_fallback": True}
            if not isinstance(slot.get("medications"), list):
                print("MedicationScheduleAgentTool: medications is not a list")
                return {"_fallback": True}
            # Ensure label exists
            if "label" not in slot:
                # Generate label from time
                time_str = slot["time"]
                try:
                    hour = int(time_str.split(":")[0])
                    minute = time_str.split(":")[1] if ":" in time_str else "00"
                    if hour < 12:
                        slot["label"] = f"{hour}:{minute} AM"
                    elif hour == 12:
                        slot["label"] = f"12:{minute} PM"
                    else:
                        slot["label"] = f"{hour - 12}:{minute} PM"
                except:
                    slot["label"] = time_str
            # Ensure foodNote exists
            if "foodNote" not in slot:
                slot["foodNote"] = ""
        
        # Check that at least some medications were assigned
        total_assigned = sum(len(slot.get("medications", [])) for slot in time_slots)
        if total_assigned == 0 and len(medications) > 0:
            print("MedicationScheduleAgentTool: No medications assigned")
            return {"_fallback": True}
        
        # Sort time_slots by time
        try:
            time_slots.sort(key=lambda x: x.get("time", "99:99"))
        except:
            pass  # If sorting fails, keep original order
        
        # Ensure spacing_notes and personalization_notes exist
        if "spacing_notes" not in data:
            data["spacing_notes"] = []
        if "personalization_notes" not in data:
            data["personalization_notes"] = None
        
        return data
        
    except (json.JSONDecodeError, Exception) as e:
        # Return fallback sentinel on any error
        print(f"MedicationScheduleAgentTool error: {e}")
        return {"_fallback": True}


def CycleRecommendationsAgentTool(
    flow_log_entries: Dict,
    model
) -> Dict:
    """
    Generate personalized cycle phase recommendations using LLM.
    
    Args:
        flow_log_entries: Dict of date strings to entry objects
            e.g. { "2025-01-15": { "flow": "medium", "symptoms": ["cramps"], "crampPain": 5, "discharge": "none" }, ... }
        model: ChatGoogleGenerativeAI instance
    
    Returns:
        Dict with current_phase, cycle_day, predicted_period_onset, recommendations, personalization_notes
        Or {"_fallback": True} if LLM fails
    """
    from datetime import datetime, timedelta
    
    if not flow_log_entries:
        return {"_fallback": True}
    
    # Get today's date for context
    today_str = datetime.utcnow().strftime("%Y-%m-%d")
    
    # Build the prompt
    prompt = (
        "You are a wellness assistant helping users track their menstrual cycle. Your role is to:\n"
        "1. Infer the user's current cycle phase and cycle day from their flow log\n"
        "2. Predict their next period onset date (as an estimate)\n"
        "3. Provide 3-5 short wellness recommendations for the current phase\n\n"
        
        "IMPORTANT RULES:\n"
        "- Do NOT give medical or diagnostic advice.\n"
        "- Do NOT predict fertility or give pregnancy advice.\n"
        "- Only provide tracking support, phase awareness, and general wellness recommendations.\n"
        "- Always recommend consulting a healthcare provider for medical concerns.\n"
        "- Predictions are estimates only; include this disclaimer.\n\n"
        
        "CYCLE PHASE LOGIC (use this to derive phase):\n"
        "- A period starts when flow is logged (light/medium/heavy/clots) after a gap of >5 days from the previous flow.\n"
        "- Typical cycle length is 28 days (can vary 21-35 days).\n"
        "- Phases based on cycle day (day 1 = first day of period):\n"
        "  - Menstrual: Days 1-5 (bleeding phase)\n"
        "  - Follicular: Days 6-13 (post-period, before ovulation)\n"
        "  - Ovulation: Days 14-16 (most fertile window)\n"
        "  - Luteal: Days 17-28 (post-ovulation, before next period)\n\n"
        
        f"TODAY'S DATE: {today_str}\n\n"
        
        f"USER'S FLOW LOG (dates with logged data):\n{json.dumps(flow_log_entries, indent=2)}\n\n"
        
        "ANALYSIS STEPS:\n"
        "1. Find the most recent period start (first day of consecutive flow days after a gap >5 days).\n"
        "2. Calculate cycle day = (today - period_start) % 28 + 1.\n"
        "3. Determine current phase from cycle day.\n"
        "4. Predict next period onset = last_period_start + 28 days (give a range of 2-3 days for variability).\n"
        "5. Generate 3-5 wellness recommendations based on current phase and any logged symptoms.\n\n"
        
        "OUTPUT FORMAT - Return STRICT JSON only, no markdown:\n"
        "{\n"
        '  "current_phase": "Luteal",\n'
        '  "cycle_day": 22,\n'
        '  "predicted_period_onset": "2025-02-15 to 2025-02-17",\n'
        '  "recommendations": [\n'
        '    { "icon": "fa-spa", "title": "Wind Down Gradually", "text": "Energy may be lower as your period approaches. Focus on gentle exercise like yoga or walking." },\n'
        '    { "icon": "fa-moon", "title": "Prioritize Sleep", "text": "Progesterone levels are high. Aim for 8 hours and avoid caffeine after noon." },\n'
        '    { "icon": "fa-wheat-awn", "title": "Complex Carbs", "text": "Cravings are common. Choose whole grains, sweet potatoes, and magnesium-rich foods." }\n'
        '  ],\n'
        '  "personalization_notes": "Based on your logged data, you appear to be in the Luteal phase (day 22). Your next period is predicted around Feb 15-17. I noticed you logged cramps recently—consider gentle stretching and warmth for comfort. This is an estimate; cycles can vary."\n'
        "}\n\n"
        
        "ICON OPTIONS (use Font Awesome solid icons):\n"
        "- fa-mug-hot, fa-bowl-food, fa-droplet, fa-bed, fa-dumbbell, fa-carrot, fa-brain, fa-people-group\n"
        "- fa-fire, fa-apple-whole, fa-heart-pulse, fa-comments, fa-spa, fa-wheat-awn, fa-moon, fa-hand-holding-heart\n\n"
        
        "CRITICAL REQUIREMENTS:\n"
        "1. current_phase must be one of: 'Menstrual', 'Follicular', 'Ovulation', 'Luteal', or null if unknown.\n"
        "2. cycle_day must be an integer 1-28, or null if unknown.\n"
        "3. predicted_period_onset should be a date or short range (e.g. '2025-02-15' or '2025-02-15 to 2025-02-17'), or null.\n"
        "4. recommendations must be an array of objects with icon, title, and text.\n"
        "5. personalization_notes should be a brief, friendly summary mentioning the phase, prediction, and any relevant logged symptoms.\n"
        "6. If there's not enough data to determine phase, set current_phase to null and provide generic wellness advice.\n"
        "Only output JSON. No explanations outside the JSON."
    )
    
    messages = [
        SystemMessage(content="You are a menstrual cycle wellness assistant that outputs only valid JSON. Do not give medical advice, fertility predictions, or diagnoses. Only provide phase tracking, period onset estimates, and general wellness recommendations."),
        HumanMessage(content=prompt)
    ]
    
    try:
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
        
        data = json.loads(raw)
        
        # Validate required fields exist
        if "current_phase" not in data:
            data["current_phase"] = None
        if "cycle_day" not in data:
            data["cycle_day"] = None
        if "predicted_period_onset" not in data:
            data["predicted_period_onset"] = None
        if "recommendations" not in data or not isinstance(data.get("recommendations"), list):
            print("CycleRecommendationsAgentTool: Missing or invalid recommendations")
            return {"_fallback": True}
        if "personalization_notes" not in data:
            data["personalization_notes"] = None
        
        # Validate recommendations structure
        for rec in data["recommendations"]:
            if not isinstance(rec, dict):
                print("CycleRecommendationsAgentTool: recommendation is not a dict")
                return {"_fallback": True}
            if "title" not in rec or "text" not in rec:
                print("CycleRecommendationsAgentTool: recommendation missing title or text")
                return {"_fallback": True}
            # Ensure icon exists (default if missing)
            if "icon" not in rec:
                rec["icon"] = "fa-heart-pulse"
        
        # Validate current_phase if present
        valid_phases = ["Menstrual", "Follicular", "Ovulation", "Luteal", None]
        if data["current_phase"] not in valid_phases:
            # Try to normalize
            phase_lower = str(data["current_phase"]).lower() if data["current_phase"] else None
            phase_map = {"menstrual": "Menstrual", "follicular": "Follicular", "ovulation": "Ovulation", "luteal": "Luteal"}
            data["current_phase"] = phase_map.get(phase_lower, None)
        
        # Validate cycle_day if present
        if data["cycle_day"] is not None:
            try:
                data["cycle_day"] = int(data["cycle_day"])
                if data["cycle_day"] < 1 or data["cycle_day"] > 35:
                    data["cycle_day"] = None
            except (ValueError, TypeError):
                data["cycle_day"] = None
        
        return data
        
    except (json.JSONDecodeError, Exception) as e:
        # Return fallback sentinel on any error
        print(f"CycleRecommendationsAgentTool error: {e}")
        return {"_fallback": True}


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
    "medication_schedule_agent": MedicationScheduleAgentTool,
    "cycle_recommendations_agent": CycleRecommendationsAgentTool,
}
