const inputEl = document.getElementById("llmInput");
const btn = document.getElementById("sendBtn");
const outputEl = document.getElementById("llmResponse");

btn.addEventListener("click", async () => {
  const text = inputEl.value.trim();
  if (!text) return;

  // Show thinking state
  outputEl.style.display = "block";
  outputEl.classList.add("active");
  outputEl.innerHTML = "Thinking...";

  const session = JSON.parse(
    sessionStorage.getItem("sanctuary_session") ||
    localStorage.getItem("sanctuary_session") ||
    "{}"
  );

  const userId = session.user_id || null;

  try {
    const res = await fetch("http://localhost:8000/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_input: text,
        user_id: userId
      })
    });

    const data = await res.json();

    if (!data.response) {
      outputEl.style.display = "none";
      outputEl.classList.remove("active");
      return;
    }

    const markdown = data.response || "";
    const parsed = marked.parse(markdown);

    outputEl.innerHTML = `<b>Benji:</b><br>${parsed}`;
    outputEl.style.display = "block";
    outputEl.classList.add("active");

  } catch (err) {
    outputEl.innerHTML = "Error talking to server.";
    outputEl.style.display = "block";
    console.error(err);
  }
});


inputEl?.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    btn.click();
  }
});
