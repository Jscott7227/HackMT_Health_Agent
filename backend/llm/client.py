import os
import json
from dotenv import load_dotenv
from typing import Optional, Dict
import time
load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage


from backend.llm.tools import MANDATORY_TOOLS, OPTIONAL_TOOLS, BenjiGoalsTool, UpcomingPlanTool
from backend.llm.instructions import format_agent_instructions, get_system_prompt_base

# Base prompt; full personality/scope/constraints come from instructions.py (MCP-style)
SYSTEM_PROMPT = get_system_prompt_base()

def format_user_facts(user_facts: dict) -> str:
    if not user_facts:
        return "No background facts provided."

    lines = []
    
    # Basic profile facts
    if user_facts.get("benji_facts"):
        lines.append(f"- Profile: {user_facts['benji_facts']}")
    if user_facts.get("height"):
        lines.append(f"- Height: {user_facts['height']}")
    if user_facts.get("weight"):
        lines.append(f"- Weight: {user_facts['weight']}")
    
    # Goals (if present)
    goals = user_facts.get("goals")
    if goals and isinstance(goals, list) and len(goals) > 0:
        lines.append("\nUser's Goals:")
        for g in goals[:5]:
            if isinstance(g, dict):
                label = g.get("Specific") or g.get("label") or g.get("goal") or g.get("specific") or str(g)
                goal_type = g.get("type", "wellness")
                lines.append(f"  - [{goal_type}] {label}")
            else:
                lines.append(f"  - {g}")
    
    # Recent check-ins summary (if present)
    latest = user_facts.get("latest_checkin")
    if latest:
        lines.append("\nLatest Check-in:")
        day_score = latest.get("dayScore")
        sleep = latest.get("sleepScore")
        fitness = latest.get("fitnessScore")
        if day_score:
            lines.append(f"  - Day Score: {day_score}/10")
        if sleep:
            lines.append(f"  - Sleep: {sleep}/5")
        if fitness:
            lines.append(f"  - Fitness: {fitness}/5")
        if latest.get("recoveryDay"):
            lines.append("  - Recovery Day: Yes")
        if latest.get("fitnessNotes"):
            lines.append(f"  - Fitness Notes: {latest['fitnessNotes']}")
    
    # Note about check-in awareness
    if latest or goals:
        lines.append("\nNote: Reference the user's goals and recent check-in data when relevant (e.g., 'your sleep score', 'your Run 5K goal').")
    
    return "User background facts:\n" + "\n".join(lines)


class BenjiLLM:
    def __init__(self):
        self.model = ChatGoogleGenerativeAI(
            model="gemini-2.5-pro",
            api_key=os.getenv("GEMINI_API_KEY"),
        )

        self.user_facts = {}
        self.mandatory_tools = MANDATORY_TOOLS
        self.optional_tools = OPTIONAL_TOOLS
        self.history = []
    
    def select_optional_tools(self, user_input: str) -> list:
        """
        Ask the LLM which tools are relevant for this user input.
        Returns a list of tool names to call.
        """
        if not self.optional_tools:
            return []
        prompt = (
            "Given the user's input and available facts, decide which optional tools "
            "should be used. Return a JSON array with the tool names. Available optional tools: "
            + ", ".join(self.optional_tools.keys()) + ".\n"
            f"User input: {user_input}"
        )
        messages = [
            SystemMessage(content="You are a smart fitness agent."),
            HumanMessage(content=prompt)
        ]
        response = self.model.invoke(messages)
        raw_content = response.content.strip()

        # Strip backticks if present
        if raw_content.startswith("```") and raw_content.endswith("```"):
            lines = raw_content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            raw_content = "\n".join(lines)

        try:
            selected_tools = json.loads(raw_content)
            if not isinstance(selected_tools, list):
                selected_tools = []
        except json.JSONDecodeError:
            selected_tools = []

        # Filter to only valid optional tools
        return [t for t in selected_tools if t in self.optional_tools]

    def extract_facts_from_input(self, user_input: str) -> dict:
        """Automatically extract structured facts from first user message."""
        prompt = (
            "Extract the following information from the user's message if available: "
            "age, weight, height, fitness_level, goal. "
            "Return the output strictly as a JSON object with these keys. "
            "If a field is missing, set it to null.\n\n"
            f"User message: {user_input}"
        )
        messages = [
            SystemMessage(content="You are a helpful fitness assistant."),
            HumanMessage(content=prompt)
        ]
        response = self.model.invoke(messages)
        raw_content = response.content.strip()

        if raw_content.startswith("```") and raw_content.endswith("```"):
            # Remove first line if it contains language specifier (like ```json)
            lines = raw_content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            raw_content = "\n".join(lines)
            try:
                facts = json.loads(raw_content)
            except json.JSONDecodeError:
                facts = {"age": None, "weight": None, "height": None,
                        "fitness_level": None, "goal": None}
            return facts
    
    def _map_checkin_to_tool_format(self, checkin: dict) -> dict:
        """Map frontend check-in fields to the format expected by tools."""
        if not checkin:
            return {}
        return {
            "sleep": checkin.get("sleepScore") or checkin.get("sleep", 3),
            "stress": checkin.get("stress", 3),
            "mood": checkin.get("mood", 3),
            "fitness": checkin.get("fitnessScore") or checkin.get("fitness", 3),
            "recovery_day": checkin.get("recoveryDay") or checkin.get("recovery_day", False),
            "day_score": checkin.get("dayScore"),
            "eat_score": checkin.get("eatScore"),
            "drink_score": checkin.get("drinkScore"),
            "wellness_score": checkin.get("wellnessScore"),
            "fitness_notes": checkin.get("fitnessNotes"),
            "day_notes": checkin.get("dayNotes"),
            "tags": checkin.get("tags", []),
        }
    
    def safe_call_tool(self, name, tool, goal_type=None):
        try:
            if name == "fitness_plan":
                return tool(self.user_facts, goal_type)

            elif name == "goal_progress":
                goal = self.user_facts.get("goal_meta", {})
                history = self.user_facts.get("history", [])
                return tool(goal, history)

            elif name == "daily_checkin":
                # Use latest_checkin from user_facts if available
                latest = self.user_facts.get("latest_checkin")
                if latest:
                    mapped = self._map_checkin_to_tool_format(latest)
                    return tool(mapped)
                # Fallback: pass user_facts (tool will use defaults)
                return tool(self.user_facts)

            elif name == "trend_analysis":
                # Use checkin_history from user_facts if available
                history = self.user_facts.get("checkin_history") or self.user_facts.get("recent_checkins")
                if history and isinstance(history, list):
                    mapped_history = [self._map_checkin_to_tool_format(c) for c in history]
                    return tool(mapped_history)
                # Fallback: pass empty list
                return tool([])

            else:
                return tool(self.user_facts)

        except TypeError:
            return {"skipped": True}  

    def run(self, user_input: str, user_facts: Optional[Dict] = None) -> str:

        """
        Main agent loop: collect facts, call tools, respond.
        """

        if user_facts:
            for key, value in user_facts.items():
                if value is not None:
                    self.user_facts[key] = value
                    
                    
        extracted_facts = self.extract_facts_from_input(user_input)
        for key, value in extracted_facts.items():
            if key not in self.user_facts and value:
                self.user_facts[key] = value
        
        tool_outputs = {}
        
        goal_type = None
        if "goal_type" in self.mandatory_tools:
            goal_result = self.mandatory_tools["goal_type"](self.user_facts)
            tool_outputs["goal_type"] = goal_result
            goal_type = goal_result.get("goal_type")
        
        
        for name, tool in self.mandatory_tools.items():
            if name == "goal_type":
                continue

            tool_outputs[name] = self.safe_call_tool(name, tool, goal_type)

        # ---- Optional tools ----
        optional_to_run = self.select_optional_tools(user_input)
        for name in optional_to_run:
            tool_outputs[name] = self.safe_call_tool(
                name, self.optional_tools[name], goal_type
            )
            
        combined = f"User input: {user_input}\n"
        for name, out in tool_outputs.items():
            combined += f"{name}: {out}\n"
            
        # Same Agent Protocol Instructions (scope + constraints) so agent run stays on-topic and safe
        agent_instructions = format_agent_instructions()
        medication_notes = (
            "When generating medication schedules: check contraindications, "
            "consider time-of-day and food instructions, space medications appropriately, "
            "recommend consulting healthcare providers, format with time slots and safety warnings."
        )
        system_content = agent_instructions + "\n\n" + medication_notes + "\n\nUse tool outputs for advice. Be clear and actionable."

        messages = [
            SystemMessage(content=system_content),
            HumanMessage(content=combined)
        ]

        response = self.model.invoke(messages)
        return response.content
    
    def run_goals(
        self,
        user_goal: str,
        user_facts: Optional[dict] = None,
        user_id: Optional[str] = None
    ) -> dict:
        """
        Generate SMART goals for a user's input goal using LLM and update user facts.

        Args:
            user_goal: The general user goal (e.g., "lose some weight")
            user_facts: Optional dictionary of existing facts
            user_id: Optional user ID to persist facts in backend

        Returns:
            dict containing "smart_goals" (list of SMART goal dicts)
        """

        facts = user_facts.copy()

        print(user_facts)
        # Generate SMART goals via LLM
        goals = BenjiGoalsTool(facts=facts, user_goal=user_goal, model=self.model)

        # Persist generated goals in user_facts
        facts["smart_goals"] = goals.get("smart_goals", [])

        # Update local session
        self.user_facts = facts
        
        print(goals)

        return goals
    
    def run_upcoming_plan(
            self,
            user_facts: Optional[dict] = None,
            user_id: Optional[str] = None
        ) -> dict:
        """
        Generate a 2-day upcoming plan from stored SMART goals.

        Args:
            user_facts: Optional dictionary of updated user facts
            user_id: Optional user ID to persist plan in backend

        Returns:
            dict containing "upcoming" schedule
        """

        facts = self.user_facts.copy()

        if user_id:
            try:
                from backend.app.main import get_user_by_id
                user = get_user_by_id(user_id)

                if user:
                    stored = user.get("user_facts", {})
                    facts.update(stored)
            except Exception as e:
                print(f"Warning: failed to load user facts for {user_id}: {e}")
        
        if user_facts:
            facts.update(user_facts)

        smart_goals = facts.pop("smart_goals", [])
        
        # Generate plan via LLM
        plan = UpcomingPlanTool(
            facts=facts,
            smart_goals=smart_goals,
            model=self.model
        )

        if user_id:
            try:
                from backend.app.main import update_user_facts
                update_user_facts(
                    user_id=user_id,
                    user_facts={"upcoming_plan": facts["upcoming_plan"]}
                )
            except Exception as e:
                print(f"Warning: failed to save upcoming plan for user {user_id}: {e}")

        # Update local session
        self.user_facts = facts

        return plan
    
    def chat(self, user_input: str, history: list = None, user_facts: dict = None):
        history = history or []

        # Structured Agent Protocols: personality, scope, and constraints from instructions.py
        agent_instructions = format_agent_instructions()
        facts_context = format_user_facts(user_facts=user_facts)

        messages = [
            SystemMessage(content=agent_instructions),
            SystemMessage(content=SYSTEM_PROMPT + "\n\n" + facts_context),
            *history,
            HumanMessage(content=user_input),
        ]

        response = self.model.invoke(messages)

        # Save to internal memory if needed
        self.history.append(HumanMessage(content=user_input))
        self.history.append(AIMessage(content=response.content))

        return response.content

    def checkin_recommendations(self, user_facts: dict, user_message: str = None) -> str:
        """
        Generate personalized check-in focus areas based on user profile, goals, and optional message.
        Uses format_agent_instructions() for theme consistency with the rest of the app.
        
        Args:
            user_facts: Dictionary containing benji_facts, height, weight, goals, etc.
            user_message: Optional message from user about what they want Benji to consider.
            
        Returns:
            String with 3-5 short, actionable check-in focus areas or prompts.
        """
        # Build context from user facts
        context_parts = []
        
        if user_facts.get("benji_facts"):
            benji_facts = user_facts["benji_facts"]
            if isinstance(benji_facts, str):
                context_parts.append(f"User Profile: {benji_facts}")
            else:
                context_parts.append(f"User Profile: {benji_facts}")
        
        if user_facts.get("height"):
            context_parts.append(f"Height: {user_facts['height']}")
        
        if user_facts.get("weight"):
            context_parts.append(f"Weight: {user_facts['weight']}")
        
        # Enhanced goal formatting with type for better correlation
        fitness_goals = []
        wellness_goals = []
        if user_facts.get("goals"):
            goals = user_facts["goals"]
            if isinstance(goals, list) and len(goals) > 0:
                for g in goals[:5]:  # Limit to 5 goals
                    if isinstance(g, dict):
                        # Get goal label/description
                        label = g.get("Specific") or g.get("label") or g.get("goal") or g.get("specific") or g.get("Description") or str(g)
                        measurable = g.get("Measurable") or g.get("measurable") or ""
                        goal_type = g.get("type", "wellness").lower()
                        
                        goal_text = f"- {label}"
                        if measurable:
                            goal_text += f" (Target: {measurable})"
                        
                        if goal_type == "fitness":
                            fitness_goals.append(goal_text)
                        else:
                            wellness_goals.append(goal_text)
                    else:
                        wellness_goals.append(f"- {g}")
                
                if fitness_goals:
                    context_parts.append("Fitness Goals:\n" + "\n".join(fitness_goals))
                if wellness_goals:
                    context_parts.append("Wellness Goals:\n" + "\n".join(wellness_goals))
        
        context = "\n".join(context_parts) if context_parts else "No profile or goals data available."
        
        # Build the user input
        user_input = f"""Based on the user's profile and goals, generate 3-5 personalized check-in focus areas or prompts for today.

User Context:
{context}"""
        
        if user_message:
            user_input += f"""

The user also said: "{user_message}"
Consider this when suggesting focus areas for their check-in today."""
        
        # Use format_agent_instructions() for theme consistency, then add task-specific instructions
        agent_instructions = format_agent_instructions(
            include_personality=True,
            include_scope=True,
            include_constraints=True
        )
        
        task_instructions = """
## Your Task: Generate Check-in Focus Areas

Generate 3-5 personalized check-in focus areas or prompts for today.

IMPORTANT RULES:
- Output ONLY a numbered list of 3-5 short, actionable focus areas. Each should be 1-2 sentences max.
- Prioritize focus areas that directly support the user's stated goals (fitness goals vs wellness goals).
- If the user has fitness goals, include at least one fitness-related focus area.
- If the user has wellness goals, include at least one wellness-related focus area.
- Be specific and encouraging, referencing their actual goals when possible.
- No introductions or conclusions - just the numbered list.

Format example:
1. **[Focus Area]**: Brief actionable prompt related to their goals
2. **[Focus Area]**: Brief actionable prompt
..."""

        system_prompt = agent_instructions + "\n\n" + task_instructions

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_input),
        ]

        response = self.model.invoke(messages)
        return response.content

    def categorize_questions(self) -> Dict[str, list[str]]:
        """
        Define all possible questions mapped to categories/goals.
        This mirrors the JS payload structure.
        """
        return {
            "overall_day": [
                "How would you rate your day from 1-10?",
                "Any notes about your day?",
                "What tags describe your day?",
                "Rate your eating, drinking, and sleep today."
            ],
            "fitness": [
                "Rate your overall fitness today.",
                "Any notes on your fitness?",
                "Rate your fitness goal performance."
            ],
            "wellness": [
                "Rate your wellness today.",
                "Any notes on wellness?",
                "Rate your stress level.",
                "How is your mood today?"
            ],
            "menstrual": [
                "When did your last period start?",
                "What is your current flow?",
                "Which symptoms are present?",
                "Rate your cramp pain.",
                "Do you have any unusual discharge?",
                "Are you taking oral contraceptives?",
                "Which type of OCP?"
            ],
            # Goal-specific questions
            "weight-loss": ["Calories consumed?", "Training type?", "Current weight?"],
            "weight-gain": ["Calories consumed?", "Current weight?"],
            "body-recomp": ["Calories?", "Protein?", "Hydration?", "Carbs?", "Fats?", "Fiber?", "Weight?"],
            "strength": ["Calories?", "Protein?", "Carbs?", "Fat?", "Hydration?", "Weight?"],
            "cardio": ["Activity type?", "Volume?", "Distance?", "Pace?", "Intensity?"],
            "general": ["Activity?", "Method?", "Weight?"],
            "mobility": ["Sessions?", "Tightness?", "Stiffness?", "Soreness?", "Looseness?", "Pain level?", "Pain location?", "ROM notes?"],
            "injury": ["Pain intensity?", "Pain location?", "Pain type?", "Pain frequency?", "Stiffness?", "Function score?", "Activity tolerance?"],
            "rehab": ["Training minutes?", "Sessions?", "After effects?", "Any flare-ups?", "Flare-up triggers?", "Flare-up description?"],
            "performance": ["Minutes trained?", "Intensity?", "Difficulty?", "Soreness?", "Fatigue?"]
        }

    def select_relevant_questions(
            self,
            active_goals: list[str],
            user_facts: Optional[Dict] = None
        ) -> Dict[str, list[str]]:
        """
            Generate relevant check-in questions for a user based on their active goals and context.

            Args:
                facts: Existing user facts/context (optional)
                active_goals: List of user's active goals
                model: LLM object with `invoke(messages)` method

            Returns:
                Dict mapping category -> list of questions (JSON)
            """
        questions = self.categorize_questions()
        relevant_questions = {}
        
        facts_str = json.dumps(user_facts, indent=2)
        if len(facts_str) > 2000:
            facts_str = facts_str[:2000] + " … truncated …"

        questions_str = json.dumps(questions, indent=2)
        if len(questions_str) > 2000:
            questions_str = questions_str[:2000] + " … truncated …"
            # Build the prompt
        prompt = (
            "You are a professional fitness and wellness coach.\n\n"
            "Your task is to generate relevant check-in questions for a user.\n"
            "Consider their active goals and any known user facts/context.\n\n"
            "Rules:\n"
            "- Include at least the core categories: overall_day, fitness, wellness, menstrual.\n"
            "- Include goal-specific questions only for the user's active goals.\n"
            "- Return STRICT JSON ONLY, in the same format as the example below.\n\n"
            f"EXAMPLE FORMAT:\n{json.dumps({k: [] for k in questions.keys()}, indent=2)}\n\n"
            "Only output valid JSON, nothing else.\n\n"
            f"USER ACTIVE GOALS:\n{json.dumps(active_goals, indent=2)}\n\n"
            f"USER FACTS (if any):\n{facts_str}\n\n"
            f"POSSIBLE QUESTIONS TO CHOOSE FROM:\n{questions_str}"
        )
        # Build the message structure
        messages = [
            SystemMessage(content="Output only valid JSON."),
            HumanMessage(content=prompt)
        ]

        
        # Invoke the model
        response = self.model.invoke(messages)
        raw = response.content.strip()

        print(raw)
        # Remove markdown fences if present
        if raw.startswith("```"):
            lines = raw.split("\n")[1:-1]
            raw = "\n".join(lines)

        # Parse JSON
        try:
            questions_json = json.loads(raw)
        except json.JSONDecodeError:
            # fallback: return empty lists for each category
            questions_json = {
                "overall_day": [],
                "fitness": [],
                "wellness": [],
                "menstrual": [],
                **{goal: [] for goal in active_goals}
            }

        return questions_json

    def checkin_sense(self, checkin_data: dict, user_facts: dict, recent_checkins: list = None) -> list:
        """
        Generate "Benji's Notes" - actionable insights based on a submitted check-in,
        correlated with the user's goals and theme from instructions.py.
        
        Args:
            checkin_data: The check-in payload just submitted (scores, notes, recovery day, etc.)
            user_facts: Dictionary containing benji_facts, height, weight, goals, etc.
            recent_checkins: Optional list of recent check-ins (last 3-5) for trend context.
            
        Returns:
            List of 2-4 short "Benji's Notes" strings (insights/encouragement).
        """
        # Build check-in summary
        checkin_summary_parts = []
        
        # Day score
        if checkin_data.get("dayScore"):
            checkin_summary_parts.append(f"Overall Day Score: {checkin_data['dayScore']}/10")
        
        # Sleep, nutrition, hydration
        if checkin_data.get("sleepScore"):
            checkin_summary_parts.append(f"Sleep Quality: {checkin_data['sleepScore']}/5")
        if checkin_data.get("eatScore"):
            checkin_summary_parts.append(f"Nutrition: {checkin_data['eatScore']}/5")
        if checkin_data.get("drinkScore"):
            checkin_summary_parts.append(f"Hydration: {checkin_data['drinkScore']}/5")
        
        # Fitness
        if checkin_data.get("fitnessScore"):
            checkin_summary_parts.append(f"Fitness Check-in: {checkin_data['fitnessScore']}/5")
        if checkin_data.get("fitnessNotes"):
            checkin_summary_parts.append(f"Fitness Notes: {checkin_data['fitnessNotes']}")
        if checkin_data.get("recoveryDay"):
            checkin_summary_parts.append("Recovery Day: Yes")
        
        # Wellness
        if checkin_data.get("wellnessScore"):
            checkin_summary_parts.append(f"Wellness Check-in: {checkin_data['wellnessScore']}/5")
        if checkin_data.get("stress"):
            checkin_summary_parts.append(f"Stress Level: {checkin_data['stress']}/5")
        if checkin_data.get("mood"):
            checkin_summary_parts.append(f"Mood: {checkin_data['mood']}/5")
        
        # Tags and notes
        if checkin_data.get("tags") and len(checkin_data["tags"]) > 0:
            checkin_summary_parts.append(f"Tags: {', '.join(checkin_data['tags'])}")
        if checkin_data.get("dayNotes"):
            checkin_summary_parts.append(f"Day Notes: {checkin_data['dayNotes']}")
        
        checkin_summary = "\n".join(checkin_summary_parts) if checkin_summary_parts else "No check-in data available."
        
        # Build goals context (same as checkin_recommendations)
        goals_context = ""
        if user_facts.get("goals"):
            goals = user_facts["goals"]
            if isinstance(goals, list) and len(goals) > 0:
                fitness_goals = []
                wellness_goals = []
                for g in goals[:5]:
                    if isinstance(g, dict):
                        label = g.get("Specific") or g.get("label") or g.get("goal") or g.get("specific") or str(g)
                        goal_type = g.get("type", "wellness").lower()
                        if goal_type == "fitness":
                            fitness_goals.append(f"- {label}")
                        else:
                            wellness_goals.append(f"- {label}")
                    else:
                        wellness_goals.append(f"- {g}")
                
                if fitness_goals:
                    goals_context += "Fitness Goals:\n" + "\n".join(fitness_goals) + "\n"
                if wellness_goals:
                    goals_context += "Wellness Goals:\n" + "\n".join(wellness_goals)
        
        # Build trend context if recent check-ins provided
        trend_context = ""
        if recent_checkins and len(recent_checkins) > 0:
            trend_parts = []
            for i, c in enumerate(recent_checkins[:3]):
                day_label = f"{i+1} day(s) ago"
                day_score = c.get("dayScore", "?")
                sleep = c.get("sleepScore", "?")
                trend_parts.append(f"{day_label}: Day {day_score}/10, Sleep {sleep}/5")
            if trend_parts:
                trend_context = "Recent Check-ins:\n" + "\n".join(trend_parts)
        
        # Build user input
        user_input = f"""Based on this check-in and the user's goals, generate 2-4 short "Benji's Notes" - actionable insights or encouragement.

Today's Check-in:
{checkin_summary}

{goals_context}

{trend_context}"""
        
        # Use format_agent_instructions() for theme consistency
        agent_instructions = format_agent_instructions(
            include_personality=True,
            include_scope=True,
            include_constraints=True
        )
        
        task_instructions = """
## Your Task: Generate Benji's Notes (Post Check-in Insights)

Based on the user's check-in data and goals, produce 2-4 short "Benji's Notes": actionable insights or encouragement.

IMPORTANT RULES:
- Output ONLY a JSON array of 2-4 short strings, each being one note/insight.
- Each note should be 1-2 sentences max.
- Correlate insights with the user's stated goals (e.g., "Your sleep score may affect your Run 5K training—rest well tonight!").
- Be supportive and actionable, not just observational.
- No medical advice. If something concerning (low scores, high stress), encourage self-care or professional support.
- No introductions or conclusions - just the JSON array.

Format example:
["Great consistency with your fitness check-in! Keep building that habit.", "Your sleep was a bit low—consider winding down earlier to support your strength goals.", "Hydration looks good today. Stay on track!"]"""

        system_prompt = agent_instructions + "\n\n" + task_instructions

        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=user_input),
        ]

        response = self.model.invoke(messages)
        raw = response.content.strip()
        
        # Parse JSON array from response
        # Strip markdown backticks if present
        if raw.startswith("```"):
            lines = raw.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            raw = "\n".join(lines)
        
        try:
            notes = json.loads(raw)
            if isinstance(notes, list):
                return notes[:4]  # Limit to 4 notes
        except json.JSONDecodeError:
            pass
        
        # Fallback: return the raw response as a single note
        return [raw] if raw else ["Keep up the great work with your daily check-ins!"]

    
if __name__ == "__main__":
    benji = BenjiLLM()
    print("Welcome to BenjiLLM - your personal fitness coach!")
    user_input = input("Please enter your fitness goal or question: ")
    advice = benji.run(user_input)
    print("\n--- Your Personalized Fitness Advice ---")
    print(advice)