document.addEventListener("DOMContentLoaded", () => {
  const inputEl = document.getElementById("llmInput");
  const btn = document.getElementById("sendBtn");
  const chatHistoryEl = document.getElementById("chatHistory");

  let conversationHistory = [];

  // Load user session
  const session = JSON.parse(
    sessionStorage.getItem("sanctuary_session") ||
    localStorage.getItem("sanctuary_session") ||
    "{}"
  );
  const userId = session.user_id || null;

  function appendMessage(sender, text) {
    const messageEl = document.createElement("div");
    messageEl.classList.add("message", sender === "You" ? "user" : "assistant");
    messageEl.innerHTML = `<b>${sender}:</b> ${marked.parse(text)}`;
    chatHistoryEl.appendChild(messageEl);
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text) return;

    appendMessage("You", text);
    inputEl.value = "";
    inputEl.focus();

    const thinkingEl = document.createElement("div");
    thinkingEl.classList.add("message", "assistant", "thinking");
    thinkingEl.innerHTML = "<b>Benji:</b>";
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
      appendMessage("Benji", "Error talking to server.");
      console.error(err);
    }
  }

  btn.addEventListener("click", sendMessage);

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = inputEl.scrollHeight + "px";
  });
});
