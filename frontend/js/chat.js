document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("llmInput");
  const btn = document.getElementById("sendBtn");
  const chatHistoryEl = document.getElementById("chatHistory");
  const historyListEl = document.getElementById("chatHistorySaved");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  let conversationHistory = [];
  let savedMessages = [];

  const welcomeMarkup = chatHistoryEl
    ? chatHistoryEl.querySelector(".chat-welcome")?.outerHTML || ""
    : "";

  // Load user session
  const session = JSON.parse(
    sessionStorage.getItem("sanctuary_session") ||
    localStorage.getItem("sanctuary_session") ||
    "{}"
  );
  const userId = session.user_id || null;
  const storageKey = `benji_chat_history_${userId || "guest"}`;

  function renderHistoryList() {
    if (!historyListEl) return;
    historyListEl.innerHTML = "";

    const newChatItem = document.createElement("div");
    newChatItem.className = "history-item history-item-new";
    newChatItem.dataset.index = "-1";
    const newChatText = document.createElement("div");
    newChatText.className = "history-text";
    newChatText.textContent = "New chat";
    const newChatMeta = document.createElement("div");
    newChatMeta.className = "history-meta";
    newChatMeta.textContent = "Empty chat";
    newChatItem.appendChild(newChatText);
    newChatItem.appendChild(newChatMeta);
    historyListEl.appendChild(newChatItem);

    if (!savedMessages.length) {
      const emptyEl = document.createElement("div");
      emptyEl.className = "history-empty";
      emptyEl.textContent = "No saved messages yet.";
      historyListEl.appendChild(emptyEl);
      return;
    }

    savedMessages.forEach((msg, index) => {
      const item = document.createElement("div");
      item.className = "history-item";
      item.dataset.index = String(index);
      const timestamp = msg.ts ? new Date(msg.ts).toLocaleDateString() : "";
      const text = document.createElement("div");
      text.className = "history-text";
      text.textContent = `${msg.role}: ${msg.content}`;
      const meta = document.createElement("div");
      meta.className = "history-meta";
      meta.textContent = timestamp;
      item.appendChild(text);
      item.appendChild(meta);
      historyListEl.appendChild(item);
    });
  }

  function saveHistory() {
    localStorage.setItem(storageKey, JSON.stringify(savedMessages));
    renderHistoryList();
  }

  function appendMessage(sender, text, options = {}) {
    const { persist = true } = options;
    // Hide welcome screen when first message is sent
    const welcomeEl = chatHistoryEl.querySelector('.chat-welcome');
    if (welcomeEl) {
      welcomeEl.style.display = 'none';
    }

    const messageEl = document.createElement("div");
    messageEl.classList.add("message", sender === "You" ? "user" : "assistant");
    messageEl.innerHTML = `<b>${sender}:</b> ${marked.parse(text)}`;
    chatHistoryEl.appendChild(messageEl);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;

    if (persist) {
      const role = sender === "You" ? "user" : "assistant";
      savedMessages.push({ role, content: text, ts: new Date().toISOString() });
      saveHistory();
    }
  }

  function restoreWelcome() {
    if (!chatHistoryEl || !welcomeMarkup) return;
    chatHistoryEl.innerHTML = welcomeMarkup;
  }

  function loadSavedHistory() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }


  async function sendMessage(customText = null) {
    const text = customText || inputEl.value.trim();
    if (!text) return;

    appendMessage("You", text);
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
          history: conversationHistory
        })
      });

      const data = await res.json();
      thinkingEl.remove();

      if (!data.response) return;

      appendMessage("Benji", data.response);

      conversationHistory.push({ role: "user", content: text });
      conversationHistory.push({ role: "assistant", content: data.response });
    } catch (err) {
      thinkingEl.remove();
      appendMessage("Benji", "I'm having trouble connecting right now. Please check if the server is running and try again.");
      console.error(err);
    }
  }

  btn.addEventListener("click", () => sendMessage());

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + "px";
  });

  // Handle suggestion chip clicks
  const suggestionChips = document.querySelectorAll('.suggestion-chip');
  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const suggestion = chip.getAttribute('data-suggestion');
      if (suggestion) {
        sendMessage(suggestion);
      }
    });
  });

  // Focus input on page load
  setTimeout(() => {
    inputEl.focus();
  }, 500);

  // Clear history
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      savedMessages = [];
      conversationHistory = [];
      localStorage.removeItem(storageKey);
      renderHistoryList();
      restoreWelcome();
      const welcomeEl = chatHistoryEl.querySelector(".chat-welcome");
      if (welcomeEl) welcomeEl.style.display = "";
    });
  }

  function renderChatFromHistory(index) {
    if (!chatHistoryEl) return;
    if (index < 0) {
      restoreWelcome();
      const welcomeEl = chatHistoryEl.querySelector(".chat-welcome");
      if (welcomeEl) welcomeEl.style.display = "";
      conversationHistory = [];
      return;
    }
    const clipped = savedMessages.slice(0, index + 1);
    if (!clipped.length) {
      restoreWelcome();
      const welcomeEl = chatHistoryEl.querySelector(".chat-welcome");
      if (welcomeEl) welcomeEl.style.display = "";
      conversationHistory = [];
      return;
    }

    chatHistoryEl.innerHTML = "";
    clipped.forEach((msg) => {
      const sender = msg.role === "user" ? "You" : "Benji";
      appendMessage(sender, msg.content, { persist: false });
    });

    conversationHistory = clipped.map((msg) => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // Click a history item to open that chat point
  if (historyListEl) {
    historyListEl.addEventListener("click", (event) => {
      const item = event.target.closest(".history-item");
      if (!item || !historyListEl.contains(item)) return;
      const index = Number(item.dataset.index);
      if (Number.isNaN(index)) return;
      renderChatFromHistory(index);
      inputEl.focus();
    });
  }

  // Load saved history into UI + conversation context
  savedMessages = loadSavedHistory();
  renderHistoryList();
});
