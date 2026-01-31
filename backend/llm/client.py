import os
import json
from google import genai
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from tools import MANDATORY_TOOLS, OPTIONAL_TOOLS

class BenjiLLM:
    def __init__(self):
        load_dotenv()
        self.model = ChatGoogleGenerativeAI(
            model="gemini-2.5-pro",
            api_key=os.getenv("GEMINI_API_KEY"),
        )

        self.user_facts = {}
        self.mandatory_tools = MANDATORY_TOOLS
        self.optional_tools = OPTIONAL_TOOLS
    
    def select_optional_tools(self, user_input: str) -> list:
        """
        Ask the LLM which tools are relevant for this user input.
        Returns a list of tool names to call.
        """
        if not self.optional_tools:
            print("?")
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
            print(raw_content)
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
    
    def ask_for_missing_facts(self):
        """
        Ask the user for any facts that are missing.
        Users can skip a fact by pressing Enter.
        """
        required = ["age", "weight", "height", "fitness_level", "goal"]
        for fact in required:
            if fact not in self.user_facts or not self.user_facts[fact]:
                value = input(f"Please enter your {fact} (press Enter to skip): ")
                if value.strip() == "":
                    self.user_facts[fact] = "unknown"
                else:
                    self.user_facts[fact] = value

    def run(self, user_input: str) -> str:
        """
        Main agent loop: collect facts, call tools, respond.
        """
        extracted_facts = self.extract_facts_from_input(user_input)
        for key, value in extracted_facts.items():
            if value:
                self.user_facts[key] = value
        print(self.user_facts)
        self.ask_for_missing_facts()
        tool_outputs = {}
        for name, tool in self.mandatory_tools.items():
            tool_outputs[name] = tool(self.user_facts)
        optional_to_run = self.select_optional_tools(user_input)
        for name in optional_to_run:
            tool_outputs[name] = self.optional_tools[name](self.user_facts)
        combined_content = f"User input: {user_input}\n"
        for name, output in tool_outputs.items():
            combined_content += f"{name} output: {output}\n"

        messages = [
            SystemMessage(content="You are a smart fitness coach. Use the tools outputs to provide personalized advice."),
            HumanMessage(content=combined_content)
        ]

        response = self.model.invoke(messages)
        return response.content
    
    
if __name__ == "__main__":
    benji = BenjiLLM()
    print("Welcome to BenjiLLM - your personal fitness coach!")
    user_input = input("Please enter your fitness goal or question: ")
    advice = benji.run(user_input)
    print("\n--- Your Personalized Fitness Advice ---")
    print(advice)