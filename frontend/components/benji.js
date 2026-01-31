document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("benji-root");

  if (!root) {
    console.error("❌ benji-root not found");
    return;
  }

  fetch("./components/benji.html")
    .then(res => {
      if (!res.ok) {
        throw new Error("Failed to load benji.html");
      }
      return res.text();
    })
    .then(html => {
      root.innerHTML = html;
      console.log("✅ Benji loaded");
    })
    .catch(err => {
      console.error("❌ Benji failed:", err);
    });
});
