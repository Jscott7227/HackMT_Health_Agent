document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("llmInput");
  const btn = document.getElementById("sendBtn");
  const voiceBtn = document.getElementById("voiceBtn");
  const inputWrapper = document.querySelector(".input-wrapper");
  const chatHistoryEl = document.getElementById("chatHistory");
  const historyListEl = document.getElementById("chatHistorySaved");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const newChatBtn = document.getElementById("newChatBtn");
  const confirmClearHistoryBtn = document.getElementById("confirmClearHistory");
  const cancelClearHistoryBtn = document.getElementById("cancelClearHistory");
  const clearHistoryModal = document.getElementById("clearHistoryModal");

  let conversationHistory = [];
  let sessions = [];
  let currentSession = createSession();

  let welcomeMarkup = "";
  if (chatHistoryEl) {
    const welcomeEl = chatHistoryEl.querySelector(".chat-welcome");
    welcomeMarkup = welcomeEl ? welcomeEl.outerHTML : "";
  }

  // ─────────────────────────────────────────────────────────────
  // Voice input
  // ─────────────────────────────────────────────────────────────
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;
  let textBeforeRecording = "";

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      isListening = true;
      textBeforeRecording = inputEl.value.trim();
      if (voiceBtn) voiceBtn.classList.add("listening");
      if (inputWrapper) inputWrapper.classList.add("listening");
    };

    recognition.onresult = (event) => {
      let fullTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      inputEl.value = textBeforeRecording ? `${textBeforeRecording} ${fullTranscript}` : fullTranscript;
      inputEl.style.height = "auto";
      inputEl.style.height = `${Math.min(inputEl.scrollHeight, 150)}px`;
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };
  } else if (voiceBtn) {
    voiceBtn.style.display = "none";
  }

  function startListening() {
    if (!recognition) return;
    try {
      recognition.start();
    } catch (err) {
      console.warn("Could not start speech recognition:", err);
    }
  }

  function stopListening() {
    isListening = false;
      if (voiceBtn) voiceBtn.classList.remove("listening");
      if (inputWrapper) inputWrapper.classList.remove("listening");
    if (recognition) {
      try {
        recognition.stop();
      } catch (err) {
        // ignore
      }
    }
  }

  if (voiceBtn) {
    voiceBtn.addEventListener("click", () => {
      if (isListening) {
        stopListening();
      } else {
        startListening();
      }
    });
  }
  // ─────────────────────────────────────────────────────────────

  const session = JSON.parse(
    sessionStorage.getItem("sanctuary_session") ||
      localStorage.getItem("sanctuary_session") ||
      "{}"
  );
  const userId = session.user_id || null;
  const storageKey = `benji_chat_history_${userId || "guest"}`;

  sessions = loadSavedHistory();
  renderHistoryList();

  function createSession() {
    return {
      id: `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      summary: "",
      messages: [],
      ts: new Date().toISOString(),
      stored: false,
    };
  }

  function loadSavedHistory() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.length) return [];

      if (parsed.every((entry) => entry && Array.isArray(entry.messages))) {
        return parsed.map((entry) => ({
          ...entry,
          stored: true,
          ts: entry.ts || new Date().toISOString(),
        }));
      }

      return [
        {
          id: `legacy-${Date.now()}`,
          summary: (() => {
            const userMsg = parsed.find((msg) => msg.role === "user");
            return userMsg ? userMsg.content : "Past chat";
          })(),
          messages: parsed.map((item) => ({
            role: item.role,
            content: item.content,
            ts: item.ts || new Date().toISOString(),
          })),
          ts:
            (() => {
              const last = parsed[parsed.length - 1];
              return last && last.ts ? last.ts : null;
            })() ||
            new Date().toISOString(),
          stored: true,
        },
      ];
    } catch (_) {
      return [];
    }
  }

  function renderHistoryList() {
    if (!historyListEl) return;
    historyListEl.innerHTML = "";

    if (!sessions.length) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "history-empty";
      emptyEl.textContent = "No saved chats yet.";
      historyListEl.appendChild(emptyEl);
      return;
    }

    const sorted = [...sessions].sort(
      (a, b) => new Date(b.ts) - new Date(a.ts)
    );

    sorted.forEach((session) => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.dataset.sessionId = session.id;

      const text = document.createElement("div");
      text.className = "history-text";
      let summary =
        session.summary ||
        (() => {
          const firstUser = session.messages.find((msg) => msg.role === "user");
          return firstUser ? firstUser.content : "";
        })();
      if (!summary) summary = "Quick summary";
      text.textContent =
        summary.length > 50 ? `${summary.slice(0, 47)}…` : summary;

      const meta = document.createElement("div");
      meta.className = "history-meta";
      const timestamp = session.ts ? new Date(session.ts) : null;
      meta.textContent = timestamp
        ? timestamp.toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "Unknown time";

      item.appendChild(text);
      item.appendChild(meta);
      historyListEl.appendChild(item);
    });
  }

  function saveHistory() {
    localStorage.setItem(storageKey, JSON.stringify(sessions));
    renderHistoryList();
  }

  function appendMessage(sender, text, options = {}) {
    const { withAvatar = sender === "Benji" } = options;
    const messageEl = document.createElement("div");
    messageEl.classList.add("message", sender === "You" ? "user" : "assistant");

    if (withAvatar) {
      const avatarWrapper = document.createElement("div");
      avatarWrapper.className = "message-avatar";
      const avatarImg = document.createElement("img");
      avatarImg.src = "../assets/img/benji_hippo.png";
      avatarImg.alt = "Benji hippo";
      avatarWrapper.appendChild(avatarImg);
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "message-body";
      contentWrapper.innerHTML = `<b>${sender}:</b> ${marked.parse(text)}`;
      messageEl.appendChild(avatarWrapper);
      messageEl.appendChild(contentWrapper);
    } else {
      messageEl.innerHTML = `<b>${sender}:</b> ${marked.parse(text)}`;
    }

    chatHistoryEl.appendChild(messageEl);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
  }

  function recordMessage(role, content) {
    const normalized = role === "Benji" ? "assistant" : "user";
    const entry = {
      role: normalized,
      content,
      ts: new Date().toISOString(),
    };
    conversationHistory.push({ role: normalized, content });
    currentSession.messages.push(entry);
    currentSession.ts = entry.ts;
    if (!currentSession.summary && normalized === "user") {
      currentSession.summary = content;
    }
    if (!currentSession.stored) {
      currentSession.stored = true;
      sessions.unshift(currentSession);
    }
    saveHistory();
  }

  function restoreWelcome() {
    if (!chatHistoryEl || !welcomeMarkup) return;
    chatHistoryEl.innerHTML = welcomeMarkup;
  }

  function startFreshChat() {
    conversationHistory = [];
    currentSession = createSession();
    restoreWelcome();
    const welcomeEl = chatHistoryEl.querySelector(".chat-welcome");
    if (welcomeEl) welcomeEl.style.display = "";
  }

  function renderChatFromHistory(sessionId) {
    if (!chatHistoryEl || !sessionId) return;
    const session = sessions.find((entry) => entry.id === sessionId);
    if (!session) return;

    chatHistoryEl.innerHTML = "";
    session.messages.forEach((msg) => {
      const sender = msg.role === "user" ? "You" : "Benji";
      appendMessage(sender, msg.content);
    });

    conversationHistory = session.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    currentSession = session;
  }

  function openClearHistoryModal() {
    if (clearHistoryModal) {
      clearHistoryModal.classList.add("active");
    }
  }

  function closeClearHistoryModal() {
    if (clearHistoryModal) {
      clearHistoryModal.classList.remove("active");
    }
  }

  async function sendMessage(customText = null) {
    const text = customText || inputEl.value.trim();
    if (!text) return;

    appendMessage("You", text, { withAvatar: false });
    recordMessage("You", text);
    inputEl.value = "";
    inputEl.style.height = "auto";
    inputEl.focus();

    const thinkingEl = document.createElement("div");
    thinkingEl.classList.add("message", "assistant", "thinking");
    thinkingEl.innerHTML = "<b>Benji:</b> Thinking";
    chatHistoryEl.appendChild(thinkingEl);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_input: text,
          user_id: userId,
          history: conversationHistory,
        }),
      });

      const data = await res.json();
      thinkingEl.remove();

      if (!data.response) return;

      appendMessage("Benji", data.response);
      recordMessage("Benji", data.response);
    } catch (err) {
      thinkingEl.remove();
      appendMessage(
        "Benji",
        "I'm having trouble connecting right now. Please check if the server is running and try again."
      );
      console.error(err);
    }
  }

  if (btn) {
    btn.addEventListener("click", () => sendMessage());
  }

  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    inputEl.addEventListener("input", () => {
      inputEl.style.height = "auto";
      inputEl.style.height = `${Math.min(inputEl.scrollHeight, 150)}px`;
    });
  }

  // Use event delegation for suggestion chips so they work even after DOM updates
  if (chatHistoryEl) {
    chatHistoryEl.addEventListener("click", (e) => {
      const chip = e.target.closest(".suggestion-chip");
      if (chip) {
        const suggestion = chip.getAttribute("data-suggestion");
        if (suggestion) {
          sendMessage(suggestion);
        }
      }
    });
  }

  setTimeout(() => {
    if (inputEl) {
      inputEl.focus();
    }
  }, 500);

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", openClearHistoryModal);
  }
  if (confirmClearHistoryBtn) {
    confirmClearHistoryBtn.addEventListener("click", () => {
    sessions = [];
    conversationHistory = [];
    localStorage.removeItem(storageKey);
    currentSession = createSession();
    renderHistoryList();
    restoreWelcome();
    const welcomeEl = chatHistoryEl.querySelector(".chat-welcome");
    if (welcomeEl) welcomeEl.style.display = "";
    closeClearHistoryModal();
  });
  }

  if (cancelClearHistoryBtn) {
    cancelClearHistoryBtn.addEventListener("click", closeClearHistoryModal);
  }

  if (clearHistoryModal) {
    clearHistoryModal.addEventListener("click", (event) => {
      if (event.target === clearHistoryModal) {
        closeClearHistoryModal();
      }
    });
  }

  window.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      clearHistoryModal &&
      clearHistoryModal.classList.contains("active")
    ) {
      closeClearHistoryModal();
    }
  });

  if (newChatBtn) {
    newChatBtn.addEventListener("click", startFreshChat);
  }

  if (historyListEl) {
    historyListEl.addEventListener("click", (event) => {
      const item = event.target.closest(".history-item");
      if (!item || !historyListEl.contains(item)) return;
      const sessionId = item.dataset.sessionId;
      if (!sessionId) return;
      renderChatFromHistory(sessionId);
      if (inputEl) {
        inputEl.focus();
      }
    });
  }
});
