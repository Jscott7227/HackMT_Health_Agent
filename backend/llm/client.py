import os
from google import genai
from dotenv import load_dotenv

load_dotenv()

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY")
)

def gemini_generate(prompt: str) -> str:
    
    response = client.models.generate_content(
        model="gemini-3-flash-preview",
        contents=prompt,
    )
    return response.text

print(gemini_generate("Explain how AI works in a few words"))

