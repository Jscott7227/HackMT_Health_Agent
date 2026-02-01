/**
 * Journal Page - Manage wellness and fitness goals, conversations, and health history
 */
(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:8000";

  // Modal copy for wellness vs fitness differentiation
  const WELLNESS_MODAL_COPY = {
    title: "Create Wellness Goal",
    subtitle: "Set a goal for sleep, mood, stress, or recovery. Benji can tie it to check-ins and support.",
    focusAreas: "Focus areas: Sleep, Mood, Stress, Recovery.",
    specificHint: "Think sleep, mood, stress, recovery.",
    placeholders: {
      specific: "e.g. Sleep 7+ hours most nights",
      measurable: "e.g. Track in check-ins or journal",
      attainable: "e.g. Wind-down routine, limit screens",
      relevant: "e.g. Better energy and mood",
      timeBound: "e.g. For the next 4 weeks"
    }
  };

  const FITNESS_MODAL_COPY = {
    title: "Create Fitness Goal",
    subtitle: "Set a goal for exercise, nutrition, or performance. Make it measurable so you can track progress.",
    focusAreas: "Focus areas: Cardio, Strength, Nutrition, Steps.",
    specificHint: "Think cardio, strength, steps, nutrition.",
    placeholders: {
      specific: "e.g. Run 3 times per week",
      measurable: "e.g. Distance or duration per session",
      attainable: "e.g. Couch-to-5K or current plan",
      relevant: "e.g. Heart health, energy",
      timeBound: "e.g. 8 weeks to 5K"
    }
  };

  var goalGenerated = false;

  function setGoalLoading(isLoading) {
    var loading = document.getElementById("goalLoadingState");
    var btn = document.getElementById("goalPrimaryBtn");
    var cancel = document.getElementById("cancelGoalBtn");

    if (loading) loading.style.display = isLoading ? "block" : "none";
    if (btn) btn.disabled = !!isLoading;
    if (cancel) cancel.disabled = !!isLoading;
  }

  function showSmartPhase(show) {
    var phaseGeneral = document.getElementById("goalPhaseGeneral");
    var phaseSmart = document.getElementById("goalPhaseSmart");

    if (phaseGeneral) phaseGeneral.style.display = show ? "none" : "block";
    if (phaseSmart) phaseSmart.style.display = show ? "block" : "none";
  }


  // DOM Elements - Tabs
  const journalTabs = document.getElementById("journalTabs");
  const wellnessTab = document.getElementById("wellnessTab");
  const fitnessTab = document.getElementById("fitnessTab");
  const conversationsTab = document.getElementById("conversationsTab");
  const healthHistoryTab = document.getElementById("healthHistoryTab");

  // DOM Elements - Wellness Tab
  const wellnessGoalsList = document.getElementById("wellnessGoalsList");
  const wellnessEmptyState = document.getElementById("wellnessEmptyState");
  const wellnessLoadingState = document.getElementById("wellnessLoadingState");
  const createWellnessTaskBtn = document.getElementById("createWellnessTaskBtn");

  // DOM Elements - Fitness Tab
  const fitnessGoalsList = document.getElementById("fitnessGoalsList");
  const fitnessEmptyState = document.getElementById("fitnessEmptyState");
  const fitnessLoadingState = document.getElementById("fitnessLoadingState");
  const createFitnessTaskBtn = document.getElementById("createFitnessTaskBtn");

  // DOM Elements - Conversations Tab
  const chatHistoryContainer = document.getElementById("chatHistoryContainer");
  const conversationsEmptyState = document.getElementById("conversationsEmptyState");
  const conversationsLoadingState = document.getElementById("conversationsLoadingState");

  // DOM Elements - Health History Tab
  const healthHistoryContainer = document.getElementById("healthHistoryContainer");
  const healthHistoryEmptyState = document.getElementById("healthHistoryEmptyState");
  const healthHistoryLoadingState = document.getElementById("healthHistoryLoadingState");

  // DOM Elements - Shared
  const notLoggedInState = document.getElementById("notLoggedInState");

  // DOM Elements - Modal
  const createGoalModal = document.getElementById("createGoalModal");
  const createGoalForm = document.getElementById("createGoalForm");
  const modalTitle = document.getElementById("modalTitle");
  const modalSubtitle = document.getElementById("modalSubtitle");
  const modalFocusAreas = document.getElementById("modalFocusAreas");
  const goalSpecificHint = document.getElementById("goalSpecificHint");
  const cancelGoalBtn = document.getElementById("cancelGoalBtn");

  // State
  let currentTab = "wellness";
  let currentGoalType = "wellness"; // wellness or fitness
  let wellnessGoalsLoaded = false;
  let fitnessGoalsLoaded = false;
  let conversationsLoaded = false;
  let healthHistoryLoaded = false;
  let cachedWellnessGoals = [];
  let cachedFitnessGoals = [];
  let cachedChatHistory = null;
  let cachedHealthHistory = null;

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
   * Show a specific state for wellness goals tab, hide others
   */
  function showWellnessState(state) {
    if (wellnessGoalsList) wellnessGoalsList.style.display = state === "goals" ? "flex" : "none";
    if (wellnessEmptyState) wellnessEmptyState.style.display = state === "empty" ? "block" : "none";
    if (wellnessLoadingState) wellnessLoadingState.style.display = state === "loading" ? "block" : "none";
  }

  /**
   * Show a specific state for fitness goals tab, hide others
   */
  function showFitnessState(state) {
    if (fitnessGoalsList) fitnessGoalsList.style.display = state === "goals" ? "flex" : "none";
    if (fitnessEmptyState) fitnessEmptyState.style.display = state === "empty" ? "block" : "none";
    if (fitnessLoadingState) fitnessLoadingState.style.display = state === "loading" ? "block" : "none";
  }

  /**
   * Show a specific state for conversations tab, hide others
   */
  function showConversationsState(state) {
    if (chatHistoryContainer) chatHistoryContainer.style.display = state === "messages" ? "block" : "none";
    if (conversationsEmptyState) conversationsEmptyState.style.display = state === "empty" ? "block" : "none";
    if (conversationsLoadingState) conversationsLoadingState.style.display = state === "loading" ? "block" : "none";
  }

  /**
   * Show a specific state for health history tab, hide others
   */
  function showHealthHistoryState(state) {
    if (healthHistoryContainer) healthHistoryContainer.style.display = state === "entries" ? "block" : "none";
    if (healthHistoryEmptyState) healthHistoryEmptyState.style.display = state === "empty" ? "block" : "none";
    if (healthHistoryLoadingState) healthHistoryLoadingState.style.display = state === "loading" ? "block" : "none";
  }

  /**
   * Switch between tabs
   */
  function switchTab(tabName) {
    currentTab = tabName;

    // Update tab button active states
    const tabButtons = journalTabs.querySelectorAll(".journal-tab");
    tabButtons.forEach(btn => {
      if (btn.dataset.tab === tabName) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });

    // Show/hide tab content
    if (tabName === "wellness") {
      if (wellnessTab) wellnessTab.style.display = "block";
      if (fitnessTab) fitnessTab.style.display = "none";
      if (conversationsTab) conversationsTab.style.display = "none";
      if (healthHistoryTab) healthHistoryTab.style.display = "none";

      // Load wellness goals if not already loaded
      if (!wellnessGoalsLoaded) {
        loadWellnessGoals();
      }
    } else if (tabName === "fitness") {
      if (wellnessTab) wellnessTab.style.display = "none";
      if (fitnessTab) fitnessTab.style.display = "block";
      if (conversationsTab) conversationsTab.style.display = "none";
      if (healthHistoryTab) healthHistoryTab.style.display = "none";

      // Load fitness goals if not already loaded
      if (!fitnessGoalsLoaded) {
        loadFitnessGoals();
      }
    } else if (tabName === "conversations") {
      if (wellnessTab) wellnessTab.style.display = "none";
      if (fitnessTab) fitnessTab.style.display = "none";
      if (conversationsTab) conversationsTab.style.display = "block";
      if (healthHistoryTab) healthHistoryTab.style.display = "none";

      // Load conversations if not already loaded
      if (!conversationsLoaded) {
        loadConversations();
      }
    } else if (tabName === "healthHistory") {
      if (wellnessTab) wellnessTab.style.display = "none";
      if (fitnessTab) fitnessTab.style.display = "none";
      if (conversationsTab) conversationsTab.style.display = "none";
      if (healthHistoryTab) healthHistoryTab.style.display = "block";

      // Load health history if not already loaded
      if (!healthHistoryLoaded) {
        loadHealthHistory();
      }
    }
  }

  /**
   * Fetch goals from API
   */
  async function fetchGoals(userId, goalType = null) {
    let url = `${API_BASE}/goals/${userId}`;
    if (goalType) {
      url += `?goal_type=${goalType}`;
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch goals: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Save a new goal via API
   */
  async function saveGoal(userId, goalData) {
    const response = await fetch(`${API_BASE}/goals/${userId}/accepted`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        goals: [goalData]
      })
    });
    if (!response.ok) {
      throw new Error(`Failed to save goal: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Fetch chat history from API
   */
  async function fetchChatHistory(userId) {
    const response = await fetch(`${API_BASE}/chat-history/${userId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch chat history: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Fetch health history (medication compliance) from API
   */
  async function fetchHealthHistory(userId, limit = 30) {
    const response = await fetch(`${API_BASE}/health-history/${userId}?limit=${limit}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch health history: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Format date for display
   */
  function formatDate(dateStr) {
    if (!dateStr) return "Unknown date";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }

  /**
   * Format timestamp for chat messages
   */
  function formatTimestamp(tsStr) {
    if (!tsStr) return "";
    const date = new Date(tsStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
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
   * Create a goal card element
   */
  function createGoalCard(goal) {
    const card = document.createElement("div");
    const goalType = goal.type || "wellness";
    card.className = `goal-card ${goalType}`;
    card.dataset.type = goalType;

     card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      // Store the goal in sessionStorage and navigate to targeted goal page
      sessionStorage.setItem("selected_goal", JSON.stringify(goal));
      window.location.href = "../html/targetedgoal.html";
    });

    const title = goal.Specific || goal.Description || "Untitled Goal";
    const icon = getIconForGoal(title);

    // Build SMART details
    let smartDetails = "";
    if (goal.Measurable) {
      smartDetails += `<div class="smart-detail"><strong>Measurable:</strong> ${escapeHtml(goal.Measurable)}</div>`;
    }
    if (goal.Attainable) {
      smartDetails += `<div class="smart-detail"><strong>Attainable:</strong> ${escapeHtml(goal.Attainable)}</div>`;
    }
    if (goal.Relevant) {
      smartDetails += `<div class="smart-detail"><strong>Relevant:</strong> ${escapeHtml(goal.Relevant)}</div>`;
    }
    if (goal.Time_Bound) {
      smartDetails += `<div class="smart-detail"><strong>Time-bound:</strong> ${escapeHtml(goal.Time_Bound)}</div>`;
    }

    card.innerHTML = `
      <div class="goal-header">
        <div class="goal-icon">
          <i class="fas ${icon}"></i>
        </div>
        <div class="goal-content">
          <h3 class="goal-title">${escapeHtml(title)}</h3>
          <span class="goal-type-badge ${goalType}">${goalType}</span>
        </div>
      </div>
      ${smartDetails ? `<div class="goal-smart-details">${smartDetails}</div>` : ""}
    `;

    return card;
  }

  /**
   * Render wellness goals
   */
  function renderWellnessGoals(goals) {
    if (!wellnessGoalsList) return;

    wellnessGoalsList.innerHTML = "";

    if (!goals || goals.length === 0) {
      showWellnessState("empty");
      return;
    }

    goals.forEach(goal => {
      const card = createGoalCard(goal);
      wellnessGoalsList.appendChild(card);
    });

    showWellnessState("goals");
  }

  /**
   * Render fitness goals
   */
  function renderFitnessGoals(goals) {
    if (!fitnessGoalsList) return;

    fitnessGoalsList.innerHTML = "";

    if (!goals || goals.length === 0) {
      showFitnessState("empty");
      return;
    }

    goals.forEach(goal => {
      const card = createGoalCard(goal);
      fitnessGoalsList.appendChild(card);
    });

    showFitnessState("goals");
  }

  /**
   * Load and render wellness goals
   */
  async function loadWellnessGoals() {
    const session = getSession();
    if (!session || !session.user_id) {
      return;
    }

    showWellnessState("loading");

    try {
      const data = await fetchGoals(session.user_id, "wellness");
      // Filter goals by type (in case API doesn't filter)
      cachedWellnessGoals = (data.goals || []).filter(g => g.type === "wellness" || !g.type);
      renderWellnessGoals(cachedWellnessGoals);
      wellnessGoalsLoaded = true;
    } catch (error) {
      console.error("Error loading wellness goals:", error);
      showWellnessState("empty");
    }
  }

  /**
   * Load and render fitness goals
   */
  async function loadFitnessGoals() {
    const session = getSession();
    if (!session || !session.user_id) {
      return;
    }

    showFitnessState("loading");

    try {
      const data = await fetchGoals(session.user_id, "fitness");
      // Filter goals by type
      cachedFitnessGoals = (data.goals || []).filter(g => g.type === "fitness");
      renderFitnessGoals(cachedFitnessGoals);
      fitnessGoalsLoaded = true;
    } catch (error) {
      console.error("Error loading fitness goals:", error);
      showFitnessState("empty");
    }
  }

  async function loadGoalsData() {
    const session = getSession();
    if (!session || !session.user_id) {
      return;
    }

    // Determine which tab is active and reload its data
    if (currentTab === "wellness") {
      // Reset the loaded flag to force a refresh
      wellnessGoalsLoaded = false;
      await loadWellnessGoals();
    } else if (currentTab === "fitness") {
      // Reset the loaded flag to force a refresh
      fitnessGoalsLoaded = false;
      await loadFitnessGoals();
    }
  }

  /**
   * Create a chat message element
   */
  function createChatMessage(msg) {
    const messageEl = document.createElement("div");
    const isUser = msg.role === "user";
    messageEl.className = `journal-message ${isUser ? "user" : "assistant"}`;

    const sender = isUser ? "You" : "Benji";
    const timestamp = formatTimestamp(msg.ts);

    // Parse markdown for assistant messages, escape for user messages
    let content;
    if (isUser) {
      content = escapeHtml(msg.content);
    } else {
      // Use marked if available, otherwise escape
      if (typeof marked !== "undefined") {
        content = marked.parse(msg.content);
      } else {
        content = escapeHtml(msg.content);
      }
    }

    messageEl.innerHTML = `
      <div class="message-header">
        <span class="message-sender">${sender}</span>
        <span class="message-time">${timestamp}</span>
      </div>
      <div class="message-content">${content}</div>
    `;

    return messageEl;
  }

  /**
   * Group messages by date for better readability
   */
  function groupMessagesByDate(messages) {
    const groups = {};
    messages.forEach(msg => {
      const date = msg.ts ? new Date(msg.ts).toDateString() : "Unknown";
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(msg);
    });
    return groups;
  }

  /**
   * Render conversation history
   */
  function renderConversationHistory(messages) {
    if (!chatHistoryContainer) return;

    chatHistoryContainer.innerHTML = "";

    if (!messages || messages.length === 0) {
      showConversationsState("empty");
      return;
    }

    // Group messages by date
    const groupedMessages = groupMessagesByDate(messages);
    const dates = Object.keys(groupedMessages).sort((a, b) => new Date(b) - new Date(a));

    dates.forEach(dateStr => {
      // Create date separator
      const dateSeparator = document.createElement("div");
      dateSeparator.className = "chat-date-separator";
      const formattedDate = new Date(dateStr).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });
      dateSeparator.innerHTML = `<span>${formattedDate}</span>`;
      chatHistoryContainer.appendChild(dateSeparator);

      // Render messages for this date (in chronological order within each day)
      const dayMessages = groupedMessages[dateStr];
      dayMessages.forEach(msg => {
        const messageEl = createChatMessage(msg);
        chatHistoryContainer.appendChild(messageEl);
      });
    });

    showConversationsState("messages");
  }

  /**
   * Load and render conversations
   */
  async function loadConversations() {
    const session = getSession();
    if (!session || !session.user_id) {
      return;
    }

    showConversationsState("loading");

    try {
      const data = await fetchChatHistory(session.user_id);
      cachedChatHistory = data.messages || [];
      renderConversationHistory(cachedChatHistory);
      conversationsLoaded = true;
    } catch (error) {
      console.error("Error loading conversations:", error);
      if (chatHistoryContainer) {
        chatHistoryContainer.innerHTML = `
          <div class="form-domain">
            <div class="empty-state">
              <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
              <p>Unable to load conversation history.</p>
              <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(error.message)}</p>
              <button class="ob-cta" style="max-width: 180px; margin-top: var(--space-md);" onclick="location.reload()">
                Try Again
              </button>
            </div>
          </div>
        `;
      }
      showConversationsState("messages");
    }
  }

  /**
   * Load and render health history
   */
  async function loadHealthHistory() {
    const session = getSession();
    if (!session || !session.user_id) {
      return;
    }

    showHealthHistoryState("loading");

    try {
      const data = await fetchHealthHistory(session.user_id);
      cachedHealthHistory = data.days || [];
      renderHealthHistory(cachedHealthHistory);
      healthHistoryLoaded = true;
    } catch (error) {
      console.error("Error loading health history:", error);
      if (healthHistoryContainer) {
        healthHistoryContainer.innerHTML = `
          <div class="form-domain">
            <div class="empty-state">
              <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
              <p>Unable to load health history.</p>
              <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(error.message)}</p>
              <button class="ob-cta" style="max-width: 180px; margin-top: var(--space-md);" onclick="location.reload()">
                Try Again
              </button>
            </div>
          </div>
        `;
      }
      showHealthHistoryState("entries");
    }
  }

  /**
   * Render health history (medication compliance by date)
   */
  function renderHealthHistory(days) {
    if (!healthHistoryContainer) return;

    healthHistoryContainer.innerHTML = "";

    if (!days || days.length === 0) {
      showHealthHistoryState("empty");
      return;
    }

    days.forEach(day => {
      const dateStr = day.date;
      const entries = day.entries || [];

      // Create date card
      const dayCard = document.createElement("div");
      dayCard.className = "health-history-day";

      // Format the date
      const formattedDate = formatDate(dateStr);

      // Calculate summary
      const totalMeds = entries.length;
      const takenCount = entries.filter(e => e.taken).length;
      const compliancePercent = totalMeds > 0 ? Math.round((takenCount / totalMeds) * 100) : 0;

      // Build entries HTML
      let entriesHtml = "";
      if (entries.length > 0) {
        entriesHtml = entries.map(entry => {
          const takenClass = entry.taken ? "taken" : "not-taken";
          const takenIcon = entry.taken ? "fa-check-circle" : "fa-times-circle";
          const takenText = entry.taken ? "Taken" : "Not taken";
          const timeText = entry.time_taken ? ` at ${entry.time_taken}` : "";

          return `
            <div class="health-history-entry ${takenClass}">
              <i class="fas ${takenIcon}"></i>
              <span class="entry-med-name">${escapeHtml(entry.medication_name || entry.medication_id)}</span>
              <span class="entry-status">${takenText}${timeText}</span>
            </div>
          `;
        }).join("");
      } else {
        entriesHtml = '<p class="text-muted">No medications recorded</p>';
      }

      dayCard.innerHTML = `
        <div class="health-history-header">
          <div class="health-history-date">${formattedDate}</div>
          <div class="health-history-summary">
            <span class="compliance-badge ${compliancePercent === 100 ? 'complete' : compliancePercent >= 50 ? 'partial' : 'low'}">
              ${takenCount}/${totalMeds} taken (${compliancePercent}%)
            </span>
          </div>
        </div>
        <div class="health-history-entries">
          ${entriesHtml}
        </div>
      `;

      healthHistoryContainer.appendChild(dayCard);
    });

    showHealthHistoryState("entries");
  }

  /**
   * Open the create goal modal
   */
  function openCreateGoalModal(goalType) {
    goalGenerated = false;
    showSmartPhase(false);
    setGoalLoading(false);

    var generalInput = document.getElementById("goalGeneral");
    if (generalInput) generalInput.value = "";

    ["goalSpecific","goalMeasurable","goalAttainable","goalRelevant","goalTimeBound"].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.value = "";
    });

    var btn = document.getElementById("goalPrimaryBtn");
    if (btn) btn.textContent = "Generate Goal";
        currentGoalType = goalType;

    // Get the appropriate copy for this goal type
    const copy = goalType === "fitness" ? FITNESS_MODAL_COPY : WELLNESS_MODAL_COPY;

    // Update modal title
    if (modalTitle) {
      modalTitle.textContent = copy.title;
    }

    // Update modal subtitle
    if (modalSubtitle) {
      modalSubtitle.textContent = copy.subtitle;
    }

    // Update focus areas
    if (modalFocusAreas) {
      modalFocusAreas.textContent = copy.focusAreas;
    }

    // Update specific field hint
    if (goalSpecificHint) {
      goalSpecificHint.textContent = copy.specificHint;
    }

    // Update placeholders
    const specificInput = document.getElementById("goalSpecific");
    const measurableInput = document.getElementById("goalMeasurable");
    const attainableInput = document.getElementById("goalAttainable");
    const relevantInput = document.getElementById("goalRelevant");
    const timeBoundInput = document.getElementById("goalTimeBound");

    if (specificInput) specificInput.placeholder = copy.placeholders.specific;
    if (measurableInput) measurableInput.placeholder = copy.placeholders.measurable;
    if (attainableInput) attainableInput.placeholder = copy.placeholders.attainable;
    if (relevantInput) relevantInput.placeholder = copy.placeholders.relevant;
    if (timeBoundInput) timeBoundInput.placeholder = copy.placeholders.timeBound;

    // Clear form
    if (createGoalForm) {
      createGoalForm.reset();
    }

    // Add/remove fitness class for styling
    if (createGoalModal) {
      if (goalType === "fitness") {
        createGoalModal.classList.add("fitness");
      } else {
        createGoalModal.classList.remove("fitness");
      }
      createGoalModal.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  /**
   * Close the create goal modal
   */
  /**
 * Close the create goal modal
 */
function closeCreateGoalModal() {
  if (createGoalModal) {
    createGoalModal.classList.remove("active");
    document.body.style.overflow = "";
  }
  
  // Reset the goal generation state
  goalGenerated = false;
  showSmartPhase(false);
  
  // Reset button text
  const btn = document.getElementById("goalPrimaryBtn");
  if (btn) btn.textContent = "Generate Smart Goal";
  
  // Clear form
  if (createGoalForm) {
    createGoalForm.reset();
  }
}

  /**
   * Handle form submission for creating a goal
   */
  async function handleCreateGoal(e) {
  e.preventDefault();
  const session = getSession();

  if (!session || !session.user_id) {
    alert("Please sign in first.");
    return;
  }

  // Phase 1: Generate SMART goal from backend
  if (!goalGenerated) {
    var general = (document.getElementById("goalGeneral") || {}).value;
    general = (general || "").trim();

    if (!general) {
      alert("Please enter a general goal first.");
      return;
    }

    try {
      setGoalLoading(true);

      // Calls FastAPI: POST /goals  (run_goals_endpoint) :contentReference[oaicite:2]{index=2}
      var resp = await BenjiAPI.postGoalsGenerate({
        user_goal: general,
        user_id: session.user_id
      });

      var smartGoals = (resp && resp.smart_goals) ? resp.smart_goals : [];
      if (!smartGoals.length) throw new Error("No SMART goal returned.");

      // Pick the first generated goal
      var g = smartGoals[0];

      // Fill form (keys should match what save endpoint expects)
      document.getElementById("goalSpecific").value = (g.Specific || "").trim();
      document.getElementById("goalMeasurable").value = (g.Measurable || "").trim();
      document.getElementById("goalAttainable").value = (g.Attainable || "").trim();
      document.getElementById("goalRelevant").value = (g.Relevant || "").trim();
      document.getElementById("goalTimeBound").value = (g.Time_Bound || "").trim();

      goalGenerated = true;
      showSmartPhase(true);

      var btn = document.getElementById("goalPrimaryBtn");
      if (btn) btn.textContent = "Save Goal";
    } catch (err) {
      console.error(err);
      alert("Goal generation failed: " + (err.message || err));
    } finally {
      setGoalLoading(false);
    }

    // IMPORTANT: stop here (don’t save yet)
    return;
  }

  // Phase 2: Save the (editable) SMART goal
  var specific = document.getElementById("goalSpecific").value.trim();
  var measurable = document.getElementById("goalMeasurable").value.trim();
  var attainable = document.getElementById("goalAttainable").value.trim();
  var relevant = document.getElementById("goalRelevant").value.trim();
  var timeBound = document.getElementById("goalTimeBound").value.trim();

  if (!specific || !measurable || !attainable || !relevant || !timeBound) {
    alert("Please fill out all SMART fields.");
    return;
  }

  var goalData = {
    Specific: specific,
    Measurable: measurable,
    Attainable: attainable,
    Relevant: relevant,
    Time_Bound: timeBound,
    type: currentGoalType
  };

  try {
    setGoalLoading(true);

    // Your backend save endpoint stores these fields :contentReference[oaicite:3]{index=3}
    await BenjiAPI.postGoalsAccepted(session.user_id, [goalData]);

    closeCreateGoalModal();
    await loadGoalsData();
  } catch (err) {
    console.error(err);
    alert("Error saving goal: " + (err.message || err));
  } finally {
    setGoalLoading(false);
  }
}


  /**
   * Initialize journal page
   */
  async function init() {
    const session = getSession();

    // Set up tab click handlers
    if (journalTabs) {
      journalTabs.addEventListener("click", (e) => {
        const tabButton = e.target.closest(".journal-tab");
        if (tabButton && tabButton.dataset.tab) {
          switchTab(tabButton.dataset.tab);
        }
      });
    }

    // Set up create task button handlers
    if (createWellnessTaskBtn) {
      createWellnessTaskBtn.addEventListener("click", () => {
        openCreateGoalModal("wellness");
      });
    }

    if (createFitnessTaskBtn) {
      createFitnessTaskBtn.addEventListener("click", () => {
        openCreateGoalModal("fitness");
      });
    }

    // Set up modal handlers
    if (cancelGoalBtn) {
      cancelGoalBtn.addEventListener("click", closeCreateGoalModal);
    }

    if (createGoalModal) {
      createGoalModal.addEventListener("click", (e) => {
        if (e.target === createGoalModal) {
          closeCreateGoalModal();
        }
      });
    }

    if (createGoalForm) {
      createGoalForm.addEventListener("submit", handleCreateGoal);
    }

    if (!session || !session.user_id) {
      // Hide all tab contents and show not logged in state
      if (wellnessTab) wellnessTab.style.display = "none";
      if (fitnessTab) fitnessTab.style.display = "none";
      if (conversationsTab) conversationsTab.style.display = "none";
      if (healthHistoryTab) healthHistoryTab.style.display = "none";
      if (notLoggedInState) notLoggedInState.style.display = "block";
      return;
    }

    // User is logged in - show wellness tab by default
    if (notLoggedInState) notLoggedInState.style.display = "none";
    switchTab("wellness");
  }

  // Run on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
