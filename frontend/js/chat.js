document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("llmInput");
  const btn = document.getElementById("sendBtn");
  const voiceBtn = document.getElementById("voiceBtn");
  const inputWrapper = document.querySelector(".input-wrapper");
  const chatHistoryEl = document.getElementById("chatHistory");

  let conversationHistory = [];

  // ─────────────────────────────────────────────────────────────
  // Web Speech API for voice input
  // ─────────────────────────────────────────────────────────────
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;
  let textBeforeRecording = "";  // Store text that existed before recording

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;       // Stop after one phrase
    recognition.interimResults = true;    // Show partial results for live feedback
    recognition.lang = "en-US";

    recognition.onstart = () => {
      isListening = true;
      // Capture any text already in the input before we start recording
      textBeforeRecording = inputEl.value.trim();
      voiceBtn.classList.add("listening");
      inputWrapper.classList.add("listening");
    };

    recognition.onresult = (event) => {
      // Build the FULL transcript from all results (not just new ones)
      let fullTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }
      // Replace input with: original text + space + full transcript
      inputEl.value = textBeforeRecording 
        ? textBeforeRecording + " " + fullTranscript 
        : fullTranscript;
      // Auto-resize textarea
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + "px";
    };

    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };
  } else {
    // Browser doesn't support speech recognition – hide the button
    if (voiceBtn) {
      voiceBtn.style.display = "none";
    }
    console.warn("Web Speech API not supported in this browser.");
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
    voiceBtn.classList.remove("listening");
    inputWrapper.classList.remove("listening");
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

  // Load user session
  const session = JSON.parse(
    sessionStorage.getItem("sanctuary_session") ||
    localStorage.getItem("sanctuary_session") ||
    "{}"
  );
  const userId = session.user_id || null;

  function appendMessage(sender, text) {
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
});
