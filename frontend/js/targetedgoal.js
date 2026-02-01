/**
 * Targeted Goal Page - Display detailed goal overview with AI insights
 */
(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:8000";

  // DOM Elements
  const goalOverviewHeader = document.getElementById("goalOverviewHeader");
  const smartGrid = document.getElementById("smartGrid");
  const aiInsightsContent = document.getElementById("aiInsightsContent");
  const upcomingPlanContent = document.getElementById("upcomingPlanContent");

  /**
   * Get user session from storage
   */
  function getSession() {
    try {
      const s1 = localStorage.getItem("sanctuary_session");
      if (s1) return JSON.parse(s1);
      const s2 = sessionStorage.getItem("sanctuary_session");
      if (s2) return JSON.parse(s2);
    } catch (e) {
      console.error("Error reading session:", e);
    }
    return null;
  }

  /**
   * Get selected goal from sessionStorage
   */
  function getSelectedGoal() {
    try {
      const goalStr = sessionStorage.getItem("selected_goal");
      if (!goalStr) return null;
      return JSON.parse(goalStr);
    } catch (e) {
      console.error("Error reading selected goal:", e);
      return null;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get appropriate icon based on goal keywords
   */
  function getIconForGoal(goalText) {
    const text = (goalText || "").toLowerCase();

    // Exercise & Fitness
    if (text.includes("walk") || text.includes("step")) return "fa-walking";
    if (text.includes("run") || text.includes("jog")) return "fa-running";
    if (text.includes("exercise") || text.includes("workout") || text.includes("gym")) return "fa-dumbbell";
    if (text.includes("bike") || text.includes("cycle")) return "fa-bicycle";
    if (text.includes("weight") || text.includes("lift")) return "fa-weight";

    // Nutrition & Diet
    if (text.includes("eat") || text.includes("meal") || text.includes("diet") || text.includes("food")) return "fa-apple-alt";
    if (text.includes("water") || text.includes("hydrat")) return "fa-tint";
    if (text.includes("vegetable") || text.includes("fruit")) return "fa-carrot";

    // Sleep & Rest
    if (text.includes("sleep") || text.includes("rest") || text.includes("bed")) return "fa-bed";
    if (text.includes("night")) return "fa-moon";

    // Mental Health & Mindfulness
    if (text.includes("meditat") || text.includes("mindful") || text.includes("relax")) return "fa-spa";
    if (text.includes("stress") || text.includes("anxiety") || text.includes("mental")) return "fa-brain";
    if (text.includes("happy") || text.includes("mood") || text.includes("joy")) return "fa-smile";

    // Health Metrics
    if (text.includes("heart") || text.includes("cardio") || text.includes("pulse")) return "fa-heartbeat";
    if (text.includes("track") || text.includes("monitor") || text.includes("measure")) return "fa-chart-line";
    if (text.includes("calori") || text.includes("burn")) return "fa-fire";

    // Achievement
    if (text.includes("goal") || text.includes("achieve") || text.includes("success")) return "fa-trophy";

    // Default based on type
    return "fa-bullseye";
  }

  /**
   * Render the goal header
   */
  function renderGoalHeader(goal) {
    if (!goalOverviewHeader) return;

    const title = goal.Specific || goal.Description || "Untitled Goal";
    const icon = getIconForGoal(title);
    const goalType = goal.type || "wellness";

    goalOverviewHeader.innerHTML = `
      <div class="goal-overview-title">
        <i class="fas ${icon}" style="color: var(--sage); font-size: 2rem;"></i>
        <div style="flex: 1;">
          ${escapeHtml(title)}
        </div>
        <span class="goal-type-indicator ${goalType}">${goalType}</span>
      </div>
    `;
  }

  /**
   * Render SMART goal details
   */
  function renderSmartDetails(goal) {
    if (!smartGrid) return;

    const smartFields = [
      { key: "Specific", label: "Specific", icon: "fa-crosshairs" },
      { key: "Measurable", label: "Measurable", icon: "fa-ruler" },
      { key: "Attainable", label: "Attainable", icon: "fa-check-circle" },
      { key: "Relevant", label: "Relevant", icon: "fa-link" },
      { key: "Time_Bound", label: "Time-Bound", icon: "fa-clock" }
    ];

    smartGrid.innerHTML = smartFields
      .filter(field => goal[field.key])
      .map(field => `
        <div class="smart-card">
          <div class="smart-card-label">
            <i class="fas ${field.icon}"></i> ${field.label}
          </div>
          <div class="smart-card-content">
            ${escapeHtml(goal[field.key])}
          </div>
        </div>
      `)
      .join("");
  }

  /**
   * Generate and render AI insights based on the goal
   */
  async function loadAiInsights(goal, userId, profileInfo) {
    if (!aiInsightsContent) return;

    try {
      // Generate insights based on goal type and SMART components
      const goalType = goal.type || "wellness";
      const isWellness = goalType === "wellness";
      
      let insights = `
        <div class="ai-content">
          <h3><i class="fas fa-bullseye"></i> Goal Overview</h3>
          <p>You've set a <strong>${goalType}</strong> goal focused on: <em>${escapeHtml(goal.Specific)}</em></p>
          
          <h3><i class="fas fa-chart-line"></i> Success Strategies</h3>
          <ul>
            <li><strong>Track Progress:</strong> ${escapeHtml(goal.Measurable)}</li>
            <li><strong>Stay Realistic:</strong> ${escapeHtml(goal.Attainable)}</li>
            <li><strong>Remember Why:</strong> ${escapeHtml(goal.Relevant)}</li>
            <li><strong>Timeline:</strong> ${escapeHtml(goal.Time_Bound)}</li>
          </ul>
          
          <h3><i class="fas fa-lightbulb"></i> Tips for Success</h3>
      `;

      // Add type-specific tips
      if (isWellness) {
        insights += `
          <ul>
            <li><strong>Consistency is key:</strong> Small daily habits compound into major improvements in wellness.</li>
            <li><strong>Listen to your body:</strong> Adjust your approach based on how you feel day-to-day.</li>
            <li><strong>Create rituals:</strong> Build routines around your wellness practices to make them automatic.</li>
            <li><strong>Track mood & energy:</strong> Notice patterns between your wellness activities and how you feel.</li>
          </ul>
        `;
      } else {
        insights += `
          <ul>
            <li><strong>Progressive overload:</strong> Gradually increase intensity, duration, or frequency to see continued progress.</li>
            <li><strong>Recovery matters:</strong> Rest days are when your body adapts and gets stronger.</li>
            <li><strong>Nutrition supports fitness:</strong> Fuel your workouts with proper nutrition and hydration.</li>
            <li><strong>Track your metrics:</strong> Record your workouts to see progress and stay motivated.</li>
          </ul>
        `;
      }

      insights += `
          <h3><i class="fas fa-shield-alt"></i> Common Challenges</h3>
          <ul>
            <li><strong>Motivation dips:</strong> It's normal. Focus on showing up even when you don't feel like it.</li>
            <li><strong>Plateaus:</strong> If progress stalls, try varying your approach or adjusting intensity.</li>
            <li><strong>Time constraints:</strong> Even 10-15 minutes counts. Consistency beats perfection.</li>
            <li><strong>Setbacks:</strong> One missed day doesn't ruin your progress. Just get back on track tomorrow.</li>
          </ul>
          
          <h3><i class="fas fa-star"></i> Stay Motivated</h3>
          <p>Review your goal regularly, celebrate small wins, and remember your "why" — that's what will keep you going when things get tough!</p>
        </div>
      `;

      aiInsightsContent.innerHTML = insights;
    } catch (error) {
      console.error("Error loading AI insights:", error);
      aiInsightsContent.innerHTML = `
        <div style="color: var(--text-muted); text-align: center; padding: 2rem;">
          <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem; color: #f59e0b;"></i>
          <p>Unable to load insights. Please refresh the page.</p>
        </div>
      `;
    }
  }

  /**
   * Fetch and render upcoming plan
   * @param {string} userId - The user's ID
   * @param {object} selectedGoal - Optional: the currently selected goal for a targeted plan
   */
  async function loadUpcomingPlan(userId, selectedGoal = null) {
    if (!upcomingPlanContent) return;

    try {
      const requestBody = {
        user_id: userId
      };
      
      // Pass the selected goal for a fitness/wellness-specific plan
      if (selectedGoal) {
        requestBody.selected_goal = selectedGoal;
      }
      
      const response = await fetch(`${API_BASE}/upcoming`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        // Handle the error gracefully - show a friendly message
        upcomingPlanContent.innerHTML = `
          <div class="ai-content">
            <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
              <i class="fas fa-info-circle" style="color: var(--sage);"></i>
              Your personalized 2-day action plan will be generated once you complete a few check-ins and build more goal history!
            </p>
            <h3><i class="fas fa-calendar-check"></i> Getting Started</h3>
            <ul>
              <li><strong>Day 1:</strong> Focus on establishing your baseline. Start with your goal's specific action and track how it feels.</li>
              <li><strong>Day 2:</strong> Build on yesterday's momentum. Adjust based on what worked and what didn't.</li>
            </ul>
            <p style="margin-top: 1.5rem; color: var(--text-secondary);">
              💡 <strong>Tip:</strong> Complete daily check-ins to help Benji learn your patterns and create more personalized recommendations!
            </p>
          </div>
        `;
        return;
      }

      const data = await response.json();
      const upcoming = data.upcoming || {};

      // Format the upcoming plan
      let planHtml = '<div class="ai-content">';
      
      if (upcoming.day1) {
        planHtml += `
          <h3><i class="fas fa-calendar-day"></i> Day 1</h3>
          <p>${escapeHtml(upcoming.day1)}</p>
        `;
      }

      if (upcoming.day2) {
        planHtml += `
          <h3><i class="fas fa-calendar-day"></i> Day 2</h3>
          <p>${escapeHtml(upcoming.day2)}</p>
        `;
      }

      if (!upcoming.day1 && !upcoming.day2) {
        planHtml += `
          <p style="color: var(--text-muted); margin-bottom: 1.5rem;">
            Your personalized plan will appear here once you've completed a few check-ins!
          </p>
          <h3><i class="fas fa-calendar-check"></i> Getting Started</h3>
          <ul>
            <li><strong>Day 1:</strong> Focus on establishing your baseline. Start with your goal's specific action and track how it feels.</li>
            <li><strong>Day 2:</strong> Build on yesterday's momentum. Adjust based on what worked and what didn't.</li>
          </ul>
        `;
      }

      planHtml += '</div>';
      upcomingPlanContent.innerHTML = planHtml;
    } catch (error) {
      console.error("Error loading upcoming plan:", error);
      upcomingPlanContent.innerHTML = `
        <div class="ai-content">
          <p style="color: var(--text-muted);">
            <i class="fas fa-info-circle" style="color: var(--sage);"></i>
            Your action plan will be available once you start tracking your progress with check-ins!
          </p>
        </div>
      `;
    }
  }

  /**
   * Fetch profile info for the user
   */
  async function fetchProfileInfo(userId) {
    try {
      const response = await fetch(`${API_BASE}/profileinfo/${userId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Error fetching profile:", error);
      return {
        benji_facts: {},
        height: null,
        weight: null
      };
    }
  }

  /**
   * Initialize the page
   */
  async function init() {
    const session = getSession();
    const goal = getSelectedGoal();

    // Check if user is logged in
    if (!session || !session.user_id) {
      window.location.href = "journal.html";
      return;
    }

    // Check if goal exists
    if (!goal) {
      window.location.href = "journal.html";
      return;
    }

    // Render goal header and SMART details
    renderGoalHeader(goal);
    renderSmartDetails(goal);

    // Fetch profile info
    const profileInfo = await fetchProfileInfo(session.user_id);

    // Load AI insights and upcoming plan in parallel
    // Pass the selected goal to loadUpcomingPlan for a goal-specific 2-day plan
    await Promise.all([
      loadAiInsights(goal, session.user_id, profileInfo),
      loadUpcomingPlan(session.user_id, goal)
    ]);
  }

  // Run on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
