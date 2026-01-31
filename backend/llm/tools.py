def BodyStatsTool(facts: dict) -> str:
    """Summarize user body stats."""
    return (
        f"Age: {facts.get('age', 'unknown')}, "
        f"Weight: {facts.get('weight', 'unknown')}, "
        f"Height: {facts.get('height', 'unknown')}, "
        f"Fitness Level: {facts.get('fitness_level', 'unknown')}"
    )

def WorkoutPlannerTool(facts: dict) -> str:
    """Generate a workout plan based on facts."""
    level = facts.get("fitness_level", "beginner")
    goal = facts.get("goal", "general fitness")
    return f"Recommended {level} plan for goal '{goal}': 30 min strength + 10 min cardio, 5x/week."

def NutritionTool(facts: dict) -> str:
    return f"Nutrition advice based on weight {facts.get('weight','unknown')} and goal {facts.get('goal','general fitness')}"

OPTIONAL_TOOLS = {
    "nutrition": NutritionTool,
}

MANDATORY_TOOLS = {
    "body_stats": BodyStatsTool,
    "workout_plan": WorkoutPlannerTool,
}