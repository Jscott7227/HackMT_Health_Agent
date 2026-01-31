# Benji - Your Wellness Companion 🌿

A gentle, AI-powered wellness companion that helps you live more intentionally through mindful check-ins and supportive guidance.

## Features

### 🌅 Daily Check-ins
Comprehensive but non-judgmental tracking across eight key domains:
- **Physical Well-being**: Energy, sleep, pain, soreness
- **Mental & Emotional**: Mood, stress, anxiety, reflections
- **Spirit & Purpose**: Intentions, gratitude, values alignment
- **Nourishment**: Meals, satisfaction, eating patterns
- **Time & Capacity**: Energy forecasting, priorities, planning
- **Mental Load**: Cognitive load, focus, deadlines
- **Environment**: Location, noise, space condition, digital overwhelm
- **Progress & Growth**: Goals, habits, what you're optimizing for

### ✨ AI-Powered Support
- Empathetic, personalized responses to each check-in
- Pattern recognition across your journey
- Gentle, actionable suggestions that respect your capacity
- Weekly insights that help you understand yourself better

### 📖 Journal & Insights
- Automatic journaling of your check-ins
- AI-generated weekly insights
- Pattern detection and trend analysis
- Non-judgmental reflection on your progress

### 🎨 Design Philosophy
- **Cozy & Organic**: Warm earthy tones inspired by nature
- **Breathing Animations**: Subtle, calming movement throughout
- **Tactile Textures**: Grain and gradient overlays for depth
- **Minimal Friction**: Intuitive forms that don't overwhelm

## Setup

### Prerequisites
- A modern web browser
- An Anthropic API key (get one at https://console.anthropic.com)

### Backend Setup

1. Create a .env file with this format in the base directory
   ```
   GEMINI_API_KEY={Insert Gemini API key}
   GEMINI_MODEL=gemini-2.5-pro
   ```
2. Run ```pip install -r requirements.txt```
3. Start the service with python -m uvicorn backend.app.main:app --reload
4. Access the backend docs at http://127.0.0.1:8000/docs#/default/run_agent_run_post

### Installation

1. **Clone or download** this repository

2. **Open in browser**: Simply open `index.html` in your web browser
   - You can double-click the file
   - Or serve it locally with any web server

3. **Add your API key**:
   - Click on the Settings tab (⚙️)
   - Enter your Anthropic API key
   - Click "Save API Key"
   - Your key is stored locally in your browser

4. **Start your first check-in**!
   - Go to the Check-in tab
   - Fill out whichever sections feel relevant
   - Submit to receive personalized guidance

## File Structure

```
wellness-agent/
├── index.html      # Main HTML structure
├── styles.css      # Cozy, organic styling
├── app.js          # UI interactions & orchestration
├── storage.js      # Data persistence with window.storage
├── agent.js        # AI integration with Claude API
└── README.md       # This file
```

## How It Works

### Data Storage
- **Local-First**: All your check-ins are stored in your browser using the persistent storage API
- **Privacy**: Your data never leaves your device except when sent to Claude for AI responses
- **Export**: You can export all your data as JSON anytime

### AI Integration
- Uses Claude Sonnet 4 for empathetic, context-aware responses
- Each check-in includes context from recent history
- Weekly insights analyze patterns across multiple check-ins
- All AI responses are supportive, not prescriptive

### No Tracking or Metrics
This isn't a fitness tracker or productivity optimizer. There are:
- No streaks to maintain
- No scores or ratings
- No guilt-inducing metrics
- Just gentle observation and support

## Usage Tips

### Your First Week
- Don't feel pressured to fill out every field
- Start with sections that resonate most
- Be honest - the AI won't judge
- Check-ins take 3-5 minutes once you're familiar

### Making It Yours
- Adjust the habit tracker to your actual habits
- Skip sections that don't apply to you
- Use the "What's weighing on you" field liberally
- Set intentions that feel meaningful, not prescriptive

### Getting Good Insights
- Check in at least 3 times per week
- Be consistent with timing (morning or evening)
- Include reflections and context
- Generate weekly insights to see patterns

## Privacy & Security

- **API Key**: Stored locally in browser storage, never transmitted
- **Check-ins**: Stored in persistent browser storage using window.storage
- **AI Requests**: Sent directly to Anthropic's API with your key
- **No Server**: This is a fully client-side application
- **No Tracking**: No analytics, no telemetry, no data collection

## Customization

### Changing Colors
Edit the CSS variables in `styles.css`:
```css
:root {
    --sage: #8b9d83;        /* Primary accent */
    --terracotta: #c77e5d;  /* Secondary accent */
    --cream: #fff9f0;       /* Background */
    /* ... etc */
}
```

### Adding Custom Habits
Edit the habit tracker section in `index.html` to add your own habits.

### Modifying Prompts
Edit the prompt-building functions in `agent.js` to customize how the AI responds.

## Troubleshooting

### "Please set your API key" message
- Go to Settings and add your Anthropic API key
- Make sure you've saved it

### AI responses not working
- Check that your API key is valid
- Check browser console for error messages
- Ensure you have API credits available

### Data not persisting
- Check that your browser supports persistent storage
- Try a different browser if issues persist
- Export your data regularly as backup

## Philosophy

Benji is built on these principles:

1. **Kindness First**: The AI never judges, criticizes, or pressures
2. **Capacity-Aware**: Suggestions respect your current energy and state
3. **Human-Centered**: You're a person, not a productivity machine
4. **Pattern Recognition**: Help you see yourself more clearly
5. **No Gamification**: No streaks, points, or artificial motivation

## Technical Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **AI**: Claude Sonnet 4 via Anthropic API
- **Storage**: Browser Persistent Storage API
- **Design**: Custom from scratch, inspired by nature
- **Fonts**: Crimson Pro (serif) + DM Sans (sans-serif)

## Credits

Built with care for people who want to live more intentionally.

Design inspired by:
- Nature's textures and colors
- Cozy reading nooks
- Handwritten journals
- Quiet morning coffee

## License

This is a personal project. Feel free to use, modify, and adapt for your own needs.

## Support

This is a client-side application, so there's no support infrastructure. However:
- Check the browser console for errors
- Ensure your API key is valid
- Export your data regularly
- Modify the code to suit your needs

---

Take care of yourself. You deserve gentle support on your journey. 🌿✨
