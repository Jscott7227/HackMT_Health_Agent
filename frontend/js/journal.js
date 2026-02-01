/**
 * Journal Page - Display check-in history as journal entries
 */
(() => {
  "use strict";

  const API_BASE = "http://127.0.0.1:8000";

  // DOM Elements
  const journalContainer = document.getElementById("journalContainer");
  const notLoggedInState = document.getElementById("notLoggedInState");
  const emptyState = document.getElementById("emptyState");
  const loadingState = document.getElementById("loadingState");

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
   * Show a specific state, hide others
   */
  function showState(state) {
    journalContainer.style.display = state === "entries" ? "block" : "none";
    notLoggedInState.style.display = state === "notLoggedIn" ? "block" : "none";
    emptyState.style.display = state === "empty" ? "block" : "none";
    loadingState.style.display = state === "loading" ? "block" : "none";
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
   * Get mood emoji
   */
  function getMoodEmoji(mood) {
    const emojis = ["😞", "😕", "😐", "🙂", "😊"];
    if (mood >= 1 && mood <= 5) return emojis[mood - 1];
    return "";
  }

  /**
   * Get score label
   */
  function getScoreLabel(score, labels) {
    if (score >= 1 && score <= labels.length) {
      return labels[score - 1];
    }
    return score || "—";
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
   * Render journal entries
   */
  function renderEntries(checkIns) {
    journalContainer.innerHTML = "";

    if (!checkIns || checkIns.length === 0) {
      showState("empty");
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

    showState("entries");
  }

  /**
   * Initialize journal page
   */
  async function init() {
    const session = getSession();

    if (!session || !session.user_id) {
      showState("notLoggedIn");
      return;
    }

    showState("loading");

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
      showState("entries");
    }
  }

  // Run on DOM ready
  document.addEventListener("DOMContentLoaded", init);
})();
