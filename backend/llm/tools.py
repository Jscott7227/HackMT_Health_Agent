from typing import Dict, List
from datetime import datetime


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
}
