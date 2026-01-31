# Wellness Sanctuary with Benji

An AI agentic agent that helps you manage every aspect of your daily life: personal trainer, advocate, and support, no matter your circumstances.

## Overview

Benji is an AI agentic agent that takes your personalized information and acts as a continuous partner for daily life. It delivers recommendations, encouragement, and support so you can reach your goals. Built for everyone, Benji acts as a personal trainer, advocate, and support regardless of your circumstances, whether you are focused on health, fitness, habits, mental wellness, or something else. The experience is inclusive, supportive, and goal-oriented.

## Problem and Motivation

- People often struggle with consistency, accountability, and personalized guidance when working toward their goals.
- Generic apps rarely adapt to each person's context, goals, and constraints.
- Many people lack access to a dedicated coach or advocate who can respond to their unique situation.

Benji exists to address these gaps by putting an adaptive, supportive agent in your corner.

## Solution and How It Works

**Your input.** You provide personal data that matters to you: goals, preferences, constraints, progress, and context.

**The agent.** That information is sent to **Gemini 2.5 Pro**, which serves as the agentic wrapper. It reasons, plans, and generates responses tailored to you.

**Your experience.** The agent returns recommendations, encouragement, and support: next steps, check-ins, and motivation to help you stay on track.

The frontend collects your input; the backend orchestrates calls to Gemini 2.5 Pro and brings the agent's responses back to you.

## Goals

- **Primary:** Help users achieve their personal goals through personalized, AI-driven recommendations and support.
- **Secondary:** Demonstrate an agentic AI pattern: user context flows into the LLM as the brain, which produces actionable, empathetic responses.
- **Impact:** Provide an accessible, 24/7 trainer and advocate for anyone, regardless of circumstance.

## Architecture

The system flows from you to the agent and back: you share personal data through the frontend; the frontend sends it to the backend; the backend calls Gemini 2.5 Pro as the agentic wrapper; Gemini interprets your context and produces a personalized response; the backend returns that response to the frontend so you see recommendations, encouragement, and support. Gemini 2.5 Pro is the core brain that turns your context into responses made for you.

### Backend Setup

1. Create a .env file with this format in the base directory
   ```
   GOOGLE_APPLICATION_CREDENTIALS={Insert Firestore API key}
   GEMINI_API_KEY={Insert Gemini API key}
   GEMINI_MODEL=gemini-2.5-pro
   ```
2. Run ```pip install -r /backend/requirements.txt``` from root
3. Start the service with py -m uvicorn backend.app.main:app --reload
4. Access the backend docs at http://127.0.0.1:8000/docs#/default/run_agent_run_post

## Features

- Personalized recommendations based on your data.
- Encouragement and motivation tailored to your goals and progress.
- Supportive, advocate-style interactions, including check-ins and suggested next steps.
- Designed to work for a wide range of goals and circumstances.
- Medication Manager: track medications (name, strength, frequency) and get an agent-generated schedule that respects contraindications (e.g. drug–drug, with/without meals).

## Technology Stack

- **Frontend:** HTML, CSS, JavaScript (`frontend/index.html`, `frontend/app.js`, `frontend/style.css`).
- **Backend:** Python, e.g. FastAPI (`backend/app/main.py`).
- **LLM / agent:** **Gemini 2.5 Pro** as the agentic wrapper; the backend calls it via `backend/llm/client.py`.

## Product Specification (Detailed)

The following sections describe profile creation, top-level navigation, and feature behavior. User input is text-based so it can be stored in a JSON key and the user key passed to the model for parsing.

### Profile Creation

#### General

- Name
- Gender
- Height
- Weight
- Busyness Levels (1–5)
- Routine Stability (1–5)
- Accountability (how strict of a regimen plan) (1–5)
- Lifestyle Choices (e.g. does/does not drink caffeine, alcohol, etc.)

#### Diet

- Open, Vegetarian, Vegan, Keto

#### Fitness Level

- BMI (auto-calculated from Height/Weight; hidden)
- Cardio/Activity (1–5)
- Cardio training experience
- Muscle mass (1–5)
- Strength training experience
- Workout frequency (1–5)
- Injury history
    - Description
- Optional description box beneath fitness levels so the user can further explain their fitness level

#### Wellness

- Sleep Quality (1–5)
- Average sleep duration
- Emotional Stability (1–5)
- Mental Health Diagnosis (optional; asked for later)

**Mental health flow:** Load questions ahead of time. Ask the user if they are willing to take the mental health questionnaire. If yes, ask about mental health. If no, do not ask mental health questions.

**First prompt when making a profile:** "Would you like to provide details about any mental illness for improvement?"

---

### Top Tabs

#### Home Page

These sections may appear multiple times when the user has multiple ongoing goals.

- **Goal progress ring (timeline)**
- **Today’s / tomorrow’s goal preview** (e.g. "Today is a rest day," "Tomorrow you are walking for fifteen minutes," or similar context from provided goals)
- **Overall view** of wellness/physical timelines
- **Disclaimer** if goals for the day are not completed (e.g. header: "Do daily check-in")
- **Today at a glance** (summary section after check-in):
    - Rest day or not
    - Today’s rating (overall)
    - Goal ratings (averages of everything you did, displayed)
- **Trend section** (past three days): agent provides quick notes for issues (e.g. if the user is not sleeping, inform them to modify sleeping habits)
- **Recovery day behavior:** If it’s a recovery day, the home page suggests helpful messages and encourages the user to stay properly hydrated and eat nutritious meals.
- **Injury / soreness notice (only when relevant):** If the user has a preset for injury history or has logged prior stiffness/soreness, show: "Avoid heavy lifting, use proper form."

#### Daily Check-in (pop-up window)

- Day rating overall (1–10)
- Optional user description
- Relevant tags (Relationship, Academics, etc.)
- Eat (how balanced was their meal)? Drink? Sleep? (1–5)
- Overall fitness check-in (1–5)
- Optional user description
- Daily fitness goal target reached (1–5)
- **Recovery Day:** If yes, do not ask for other information.

**Goal-type–specific check-in fields:**

| Goal Type | Fields |
|-----------|--------|
| **Weight Loss** | Caloric intake (Muscle training / body recomp / Cardio / General Training) |
| **Weight Gain** | Caloric intake (above maintenance) |
| **Body Recomposition** | Caloric intake (deficit while maintaining protein goal of at least 90–100 g protein); Hydration, calories, protein, carbs, fats, fiber |
| **Muscle / Strength Training** | Calories, protein, carbs, fat, hydration |
| **Cardio / Endurance** | Volume, distance, pace/speed, Intensity (1–5); Walking / running / biking as options |
| **General Body Maintenance** | Activity methods; Training method (strength or cardio?); Weight measuring every day (updates profile weights) |
| **Mobility / Flexibility** | Mobility sessions; Tightness, stiffness, soreness, looseness afterwards (1–5); Pain level, pain location; Range of motion progress (agent asks generalized questions based on fitness task goals) |
| **Injury / Recovery** | Pain symptoms (intensity 1–10, location, type e.g. sharp/burning/aching/stiff, frequency e.g. irregular/constant); Stiffness; Daily function score; Activity tolerance (how long before pain occurs); Rehab adherence; Training minutes; Rehab sessions; After effects (did rehab make worse or better, 1–5); Flare-up events (long sitting, heavy lifting, fast movements, yes/no and describe event). If yes to flare-up, do not recommend the offending task for a set time. |
| **Performance / Sport-Specific** | Minutes trained today, intensity, difficulty (1–5); Soreness (1–5), fatigue (1–5); Overall wellness check-in (1–5); Optional user description; How much stress? (1–5); Good mood? (1–5); Wellness goal overview |

#### Plan Overview Section (Wellness Goals)

- Goes into detail of what the entire timeline plan will be; documents important milestones that are measurable within each timeframe; imports today’s and tomorrow’s plan.

**Create wellness goal**

- Description of goal
- Length of goal
- Goal selection (what to look at)
- Overall goal rating
- Do they need to pick it up? Are they good? (AI suggestion)
- Overall suggestion (AI: e.g. great, good, needs improvement with specifics)
- **Weekly recap:** Summary of past 7 days’ scores; graph for scores of the week; AI recommendations/suggestions
- Timeline: hover shows "quick preview"; click on a day opens pop-up with that day’s contents
- Progress "ring" (how close to goal end date)
- Human "necessity" summary: Do we need to improve this? (AI suggestion)
- Emotional summary: Are they overall "down"? Do we need to improve this? (AI suggestion)
- **Chatbot helper:** Any specific questions for the goal

#### Fitness Goal Overview / Plan Overview Section

- Same idea as wellness: detail of entire timeline plan, measurable milestones, today’s and tomorrow’s plan.
- The agent determines which category of fitness goal the user is pursuing and uses a **preset** of data specialized for that goal:
    - Weight loss
    - Weight gain
    - Body recomposition
    - Muscle / strength training
    - Cardio / endurance
    - General body maintenance
    - Mobility / flexibility
    - Injury recovery / pain reduction
    - Performance / sport-specific

**Create fitness goal**

- Description of goal
- Length of goal
- Goal selection (what to look at)
- Overall goal rating
- Do they need to pick it up? Are they good? (AI suggestion)
- Overall support (AI suggestion)
- **Weekly recap:** Summary of past 7 days’ scores; graph; AI recommendations/suggestions
- Timeline: hover shows quick preview; click opens pop-up with day’s contents
- Progress "ring" (how close to goal end date)
- **Diet summary:** Contents of what they ate
- **Chatbot helper:** Any specific questions for the goal

#### Profile Tab

- Displays basic user information as provided at registration.
- All information fields are editable by the user.

#### Medication Manager

- Keeps track of the user’s medications and lets the agent build a safe, practical taking schedule.

**Input (per medication)**

- **Name** (e.g., drug name)
- **Strength** (e.g., 10 mg, 500 mg)
- **How often** (e.g., twice daily, every 8 hours, with breakfast)

**Agent behavior**

- Build a **schedule** for when to take each medication.
- Respect **contraindications**, e.g.:
  - Drug–drug: this medication cannot be taken with that one (spacing or avoidance).
  - Food: take with meals / on an empty stomach.
- Consider time-of-day and spacing between doses where relevant.

## Hackathon Context

Built for **MTSU 2026 Hackathon** for presentation to supervisory and student judges. We aim to show how agentic AI can make personalized health and life support accessible to everyone.

## Getting Started

1. Clone the repository.
2. Configure your API key for Gemini (e.g. via environment variables).
3. Run the backend server (e.g. from `backend/`).
4. Open the frontend (e.g. serve `frontend/` or open `index.html`).

Specific run commands will be added as the project is finalized.

## Contributors