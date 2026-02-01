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

    lines = [f"- {k}: {v}" for k, v in user_facts.items()]
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
    
    def safe_call_tool(self, name, tool, goal_type=None):
        try:
            if name == "fitness_plan":
                return tool(self.user_facts, goal_type)

            elif name == "goal_progress":
                goal = self.user_facts.get("goal_meta", {})
                history = self.user_facts.get("history", [])
                return tool(goal, history)

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
        
        if user_facts.get("goals"):
            goals = user_facts["goals"]
            if isinstance(goals, list) and len(goals) > 0:
                goals_summary = []
                for g in goals[:5]:  # Limit to 5 goals
                    if isinstance(g, dict):
                        label = g.get("label") or g.get("goal") or g.get("specific") or str(g)
                        goals_summary.append(f"- {label}")
                    else:
                        goals_summary.append(f"- {g}")
                context_parts.append("Active Goals:\n" + "\n".join(goals_summary))
        
        context = "\n".join(context_parts) if context_parts else "No profile or goals data available."
        
        # Build the user input
        user_input = f"""Based on the user's profile and goals, generate 3-5 personalized check-in focus areas or prompts for today.

User Context:
{context}"""
        
        if user_message:
            user_input += f"""

The user also said: "{user_message}"
Consider this when suggesting focus areas for their check-in today."""
        
        # System prompt for focused output
        system_prompt = """You are Benji, a supportive wellness companion. Your task is to generate personalized check-in focus areas.

IMPORTANT: Output ONLY a numbered list of 3-5 short, actionable check-in focus areas or prompts. Each should be 1-2 sentences max.

Format example:
1. **[Focus Area]**: Brief actionable prompt
2. **[Focus Area]**: Brief actionable prompt
...

Focus on what matters most for this user today based on their profile, goals, and any context they provided. Be specific and encouraging. No introductions or conclusions - just the list."""

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


    
if __name__ == "__main__":
    benji = BenjiLLM()
    print("Welcome to BenjiLLM - your personal fitness coach!")
    user_input = input("Please enter your fitness goal or question: ")
    advice = benji.run(user_input)
    print("\n--- Your Personalized Fitness Advice ---")
    print(advice)