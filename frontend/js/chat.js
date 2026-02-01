document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("llmInput");
  const btn = document.getElementById("sendBtn");
  const voiceBtn = document.getElementById("voiceBtn");
  const inputWrapper = document.querySelector(".input-wrapper");
  const chatHistoryEl = document.getElementById("chatHistory");
  const chatActionsEl = document.getElementById("chatActions");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const newChatBtn = document.getElementById("newChatBtn");
  const confirmClearHistoryBtn = document.getElementById("confirmClearHistory");
  const cancelClearHistoryBtn = document.getElementById("cancelClearHistory");
  const clearHistoryModal = document.getElementById("clearHistoryModal");

  let conversationHistory = [];
  let hasMessages = false;

  const welcomeMarkup = chatHistoryEl ? chatHistoryEl.innerHTML : "";

  // Voice input setup
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

  // Session and storage
  const session = JSON.parse(
    sessionStorage.getItem("sanctuary_session") ||
      localStorage.getItem("sanctuary_session") ||
      "{}"
  );
  const userId = session.user_id || null;
  const storageKey = `benji_chat_history_${userId || "guest"}`;

  // Load saved conversation if exists
  loadSavedConversation();

  function loadSavedConversation() {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;

      const saved = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length > 0) {
        conversationHistory = saved;
        renderSavedMessages();
      }
    } catch (err) {
      console.warn("Failed to load saved conversation:", err);
    }
  }

  function renderSavedMessages() {
    if (!chatHistoryEl || conversationHistory.length === 0) return;

    chatHistoryEl.innerHTML = "";
    conversationHistory.forEach((msg) => {
      const sender = msg.role === "user" ? "You" : "Benji";
      const withAvatar = msg.role === "assistant";
      appendMessage(sender, msg.content, { withAvatar });
    });

    hasMessages = true;
    showChatActions();
  }

  function saveConversation() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(conversationHistory));
    } catch (err) {
      console.warn("Failed to save conversation:", err);
    }
  }

  function showChatActions() {
    if (chatActionsEl && hasMessages) {
      chatActionsEl.style.display = "flex";
    }
  }

  function hideChatActions() {
    if (chatActionsEl) {
      chatActionsEl.style.display = "none";
    }
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
      avatarImg.alt = "Benji";
      avatarImg.onerror = function() {
        this.remove();
        avatarWrapper.innerHTML = '<i class="fas fa-hippo"></i>';
      };
      avatarWrapper.appendChild(avatarImg);

      const contentWrapper = document.createElement("div");
      contentWrapper.className = "message-body";
      contentWrapper.innerHTML = `<b>${sender}</b>${marked.parse(text)}`;

      messageEl.appendChild(avatarWrapper);
      messageEl.appendChild(contentWrapper);
    } else {
      const avatarWrapper = document.createElement("div");
      avatarWrapper.className = "message-avatar";
      avatarWrapper.innerHTML = '<i class="fas fa-user"></i>';

      const contentWrapper = document.createElement("div");
      contentWrapper.className = "message-body";
      contentWrapper.innerHTML = `<b>${sender}</b>${marked.parse(text)}`;

      messageEl.appendChild(avatarWrapper);
      messageEl.appendChild(contentWrapper);
    }

    chatHistoryEl.appendChild(messageEl);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
  }

  function recordMessage(role, content) {
    const normalized = role === "Benji" ? "assistant" : "user";
    conversationHistory.push({ role: normalized, content });
    saveConversation();
  }

  function restoreWelcome() {
    if (!chatHistoryEl || !welcomeMarkup) return;
    chatHistoryEl.innerHTML = welcomeMarkup;

    // Re-attach event listeners for suggestion chips
    document
      .querySelectorAll(".suggestion-chip")
      .forEach((chip) =>
        chip.addEventListener("click", () => {
          const suggestion = chip.getAttribute("data-suggestion");
          if (suggestion) {
            sendMessage(suggestion);
          }
        })
      );
  }

  function startFreshChat() {
    conversationHistory = [];
    hasMessages = false;
    saveConversation();
    restoreWelcome();
    hideChatActions();
    if (inputEl) inputEl.focus();
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

    // Hide welcome message on first send
    if (!hasMessages) {
      chatHistoryEl.innerHTML = "";
      hasMessages = true;
      showChatActions();
    }

    appendMessage("You", text, { withAvatar: false });
    recordMessage("You", text);
    inputEl.value = "";
    inputEl.style.height = "auto";
    inputEl.focus();

    const thinkingEl = document.createElement("div");
    thinkingEl.classList.add("message", "assistant", "thinking");

    const thinkingAvatar = document.createElement("div");
    thinkingAvatar.className = "message-avatar";
    const thinkingImg = document.createElement("img");
    thinkingImg.src = "../assets/img/benji_hippo.png";
    thinkingImg.alt = "Benji";
    thinkingImg.onerror = function() {
      this.remove();
      thinkingAvatar.innerHTML = '<i class="fas fa-hippo"></i>';
    };
    thinkingAvatar.appendChild(thinkingImg);

    const thinkingBody = document.createElement("div");
    thinkingBody.className = "message-body";
    thinkingBody.innerHTML = "<b>Benji:</b> Thinking";

    thinkingEl.appendChild(thinkingAvatar);
    thinkingEl.appendChild(thinkingBody);

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

      if (!data.response) {
        appendMessage(
          "Benji",
          "I'm sorry, I couldn't generate a response. Please try again."
        );
        return;
      }

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

  // Event listeners
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

  // Suggestion chips
  document
    .querySelectorAll(".suggestion-chip")
    .forEach((chip) =>
      chip.addEventListener("click", () => {
        const suggestion = chip.getAttribute("data-suggestion");
        if (suggestion) {
          sendMessage(suggestion);
        }
      })
    );

  // Auto-focus input
  setTimeout(() => {
    if (inputEl) {
      inputEl.focus();
    }
  }, 500);

  // Clear history modal handlers
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", openClearHistoryModal);
  }

  if (confirmClearHistoryBtn) {
    confirmClearHistoryBtn.addEventListener("click", () => {
      conversationHistory = [];
      hasMessages = false;
      localStorage.removeItem(storageKey);
      restoreWelcome();
      hideChatActions();
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

  // ESC key to close modal
  window.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      clearHistoryModal &&
      clearHistoryModal.classList.contains("active")
    ) {
      closeClearHistoryModal();
    }
  });

  // New chat button
  if (newChatBtn) {
    newChatBtn.addEventListener("click", startFreshChat);
  }
});
