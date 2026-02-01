/**
 * Journal Page - Display check-in history and conversation history as journal entries
 */
(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:8000";

  // DOM Elements - Tabs
  const journalTabs = document.getElementById("journalTabs");
  const wellnessTab = document.getElementById("wellnessTab");
  const conversationsTab = document.getElementById("conversationsTab");

  // DOM Elements - Wellness Tab
  const journalContainer = document.getElementById("journalContainer");
  const emptyState = document.getElementById("emptyState");
  const loadingState = document.getElementById("loadingState");

  // DOM Elements - Conversations Tab
  const chatHistoryContainer = document.getElementById("chatHistoryContainer");
  const conversationsEmptyState = document.getElementById("conversationsEmptyState");
  const conversationsLoadingState = document.getElementById("conversationsLoadingState");

  // DOM Elements - Shared
  const notLoggedInState = document.getElementById("notLoggedInState");

  // State
  let currentTab = "wellness";
  let conversationsLoaded = false;
  let cachedChatHistory = null;

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
   * Show a specific state for wellness tab, hide others
   */
  function showWellnessState(state) {
    journalContainer.style.display = state === "entries" ? "block" : "none";
    emptyState.style.display = state === "empty" ? "block" : "none";
    loadingState.style.display = state === "loading" ? "block" : "none";
  }

  /**
   * Show a specific state for conversations tab, hide others
   */
  function showConversationsState(state) {
    chatHistoryContainer.style.display = state === "messages" ? "block" : "none";
    conversationsEmptyState.style.display = state === "empty" ? "block" : "none";
    conversationsLoadingState.style.display = state === "loading" ? "block" : "none";
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
      wellnessTab.style.display = "block";
      conversationsTab.style.display = "none";
    } else if (tabName === "conversations") {
      wellnessTab.style.display = "none";
      conversationsTab.style.display = "block";

      // Load conversations if not already loaded
      if (!conversationsLoaded) {
        loadConversations();
      }
    }
  }

  /**
   * Fetch check-ins from API
   */
  async function fetchCheckIns(userId) {
    const response = await fetch(`${API_BASE}/checkins/${userId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch check-ins: ${response.statusText}`);
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
   * Get mood emoji
   */
  function getMoodEmoji(mood) {
    const emojis = ["😞", "😕", "😐", "🙂", "😊"];
    if (mood >= 1 && mood <= 5) return emojis[mood - 1];
    return "";
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
   * Create a journal entry card from check-in data
   */
  function createJournalEntry(checkIn) {
    const entry = document.createElement("div");
    entry.className = "journal-entry";

    // Date
    const dateStr = formatDate(checkIn.createdAt || checkIn.timestamp);

    // Build summary sections
    const sections = [];

    // Day score (1-10)
    if (checkIn.dayScore) {
      sections.push(`<div class="journal-metric">
        <span class="metric-icon">📊</span>
        <span class="metric-label">Day Rating:</span>
        <span class="metric-value">${checkIn.dayScore}/10</span>
      </div>`);
    }

    // Recovery day
    if (checkIn.recoveryDay) {
      sections.push(`<div class="journal-metric recovery-badge">
        <span class="metric-icon">🛌</span>
        <span class="metric-value">Recovery Day</span>
      </div>`);
    }

    // Day notes
    if (checkIn.dayNotes) {
      sections.push(`<div class="journal-note">
        <span class="note-icon">📝</span>
        <span class="note-text">${escapeHtml(checkIn.dayNotes)}</span>
      </div>`);
    }

    // Tags
    if (checkIn.tags && checkIn.tags.length > 0) {
      const tagHtml = checkIn.tags.map(t => `<span class="journal-tag">${escapeHtml(t)}</span>`).join("");
      sections.push(`<div class="journal-tags">${tagHtml}</div>`);
    }

    // Basic metrics grid (eat, drink, sleep)
    const basicMetrics = [];
    if (checkIn.eatScore) {
      basicMetrics.push(`<div class="mini-metric"><span>🍽️</span> Eat: ${checkIn.eatScore}/5</div>`);
    }
    if (checkIn.drinkScore) {
      basicMetrics.push(`<div class="mini-metric"><span>💧</span> Hydration: ${checkIn.drinkScore}/5</div>`);
    }
    if (checkIn.sleepScore) {
      basicMetrics.push(`<div class="mini-metric"><span>😴</span> Sleep: ${checkIn.sleepScore}/5</div>`);
    }
    if (basicMetrics.length > 0) {
      sections.push(`<div class="journal-metrics-grid">${basicMetrics.join("")}</div>`);
    }

    // Fitness
    if (checkIn.fitnessScore) {
      sections.push(`<div class="journal-metric">
        <span class="metric-icon">💪</span>
        <span class="metric-label">Fitness:</span>
        <span class="metric-value">${checkIn.fitnessScore}/5</span>
      </div>`);
    }

    // Wellness & Mood
    const wellnessItems = [];
    if (checkIn.wellnessScore) {
      wellnessItems.push(`<span>Wellness: ${checkIn.wellnessScore}/5</span>`);
    }
    if (checkIn.stress) {
      wellnessItems.push(`<span>Stress: ${checkIn.stress}/5</span>`);
    }
    if (checkIn.mood) {
      wellnessItems.push(`<span>Mood: ${getMoodEmoji(checkIn.mood)}</span>`);
    }
    if (wellnessItems.length > 0) {
      sections.push(`<div class="journal-metric">
        <span class="metric-icon">🧘</span>
        <span class="metric-value">${wellnessItems.join(" · ")}</span>
      </div>`);
    }

    // Wellness notes
    if (checkIn.wellnessNotes) {
      sections.push(`<div class="journal-note">
        <span class="note-icon">💭</span>
        <span class="note-text">${escapeHtml(checkIn.wellnessNotes)}</span>
      </div>`);
    }

    // Fitness notes
    if (checkIn.fitnessNotes) {
      sections.push(`<div class="journal-note">
        <span class="note-icon">🏋️</span>
        <span class="note-text">${escapeHtml(checkIn.fitnessNotes)}</span>
      </div>`);
    }

    // Goal-specific summaries
    if (checkIn.cardio && checkIn.cardio.activityType) {
      const c = checkIn.cardio;
      let cardioSummary = `${c.activityType}`;
      if (c.distance) cardioSummary += ` - ${c.distance} km`;
      if (c.volume) cardioSummary += ` (${c.volume} min)`;
      sections.push(`<div class="journal-metric">
        <span class="metric-icon">🏃</span>
        <span class="metric-label">Cardio:</span>
        <span class="metric-value">${cardioSummary}</span>
      </div>`);
    }

    if (checkIn.strength && (checkIn.strength.calories || checkIn.strength.protein)) {
      const s = checkIn.strength;
      let strengthSummary = [];
      if (s.calories) strengthSummary.push(`${s.calories} cal`);
      if (s.protein) strengthSummary.push(`${s.protein}g protein`);
      sections.push(`<div class="journal-metric">
        <span class="metric-icon">🏋️</span>
        <span class="metric-label">Strength:</span>
        <span class="metric-value">${strengthSummary.join(", ")}</span>
      </div>`);
    }

    entry.innerHTML = `
      <div class="entry-header">
        <div class="entry-date">${dateStr}</div>
      </div>
      <div class="entry-content">
        ${sections.length > 0 ? sections.join("") : "<p class=\"text-muted\">Check-in recorded</p>"}
      </div>
    `;

    return entry;
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
   * Render journal entries
   */
  function renderEntries(checkIns) {
    journalContainer.innerHTML = "";

    if (!checkIns || checkIns.length === 0) {
      showWellnessState("empty");
      return;
    }

    // Sort by date descending (backend should do this, but ensure)
    checkIns.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.timestamp || 0);
      const dateB = new Date(b.createdAt || b.timestamp || 0);
      return dateB - dateA;
    });

    checkIns.forEach(checkIn => {
      const entryEl = createJournalEntry(checkIn);
      journalContainer.appendChild(entryEl);
    });

    showWellnessState("entries");
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
      showConversationsState("messages");
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

    if (!session || !session.user_id) {
      // Hide both tab contents and show not logged in state
      wellnessTab.style.display = "none";
      conversationsTab.style.display = "none";
      notLoggedInState.style.display = "block";
      return;
    }

    // User is logged in - show wellness tab by default
    notLoggedInState.style.display = "none";
    switchTab("wellness");
    showWellnessState("loading");

    try {
      const checkIns = await fetchCheckIns(session.user_id);
      renderEntries(checkIns);
    } catch (error) {
      console.error("Error loading journal:", error);
      // Show empty state with error message
      journalContainer.innerHTML = `
        <div class="form-domain">
          <div class="empty-state">
            <div class="empty-icon"><i class="fas fa-exclamation-triangle"></i></div>
            <p>Unable to load journal entries.</p>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${escapeHtml(error.message)}</p>
            <button class="ob-cta" style="max-width: 180px; margin-top: var(--space-md);" onclick="location.reload()">
              Try Again
            </button>
          </div>
        </div>
      `;
      showWellnessState("entries");
    }
  }

  // Run on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
