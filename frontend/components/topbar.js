document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("benji-root");
  if (!root) return;

  // Detect file:// usage (fetch will fail here)
  if (window.location.protocol === "file:") {
    root.innerHTML = `
      <div style="
        padding:12px;
        margin:12px;
        border:1px solid #f99;
        border-radius:12px;
        background:#fff3f3;
        font-family: system-ui, sans-serif;
      ">
        <strong>Header couldn't load.</strong><br><br>
        This page is being opened via <code>file://</code>.<br>
        The shared header uses <code>fetch()</code>, which is blocked in this mode.<br><br>
        Run a local server from <code>frontend/</code>:<br>
        <code>python3 -m http.server 8000</code><br><br>
        Then open:<br>
        <code>http://127.0.0.1:8000/html/check-in.html</code>
      </div>
    `;
    console.error("Benji header blocked: file:// mode");
    return;
  }

  // You are visiting:
  // http://127.0.0.1:5500../html/check-in.html
  // So this MUST be absolute:
  const HEADER_URL = "../components/topbar.html";

  try {
    const res = await fetch(HEADER_URL, { cache: "no-store" });

    console.log("Benji header fetch:", res.status, res.statusText);

    if (!res.ok) {
      throw new Error(`Failed to load ${HEADER_URL}`);
    }

    const html = await res.text();

    console.log("Benji header length:", html.length);
    console.log("Benji header preview:", html.slice(0, 120));

    root.innerHTML = html;

    // Hide Cycle tab for male users
    try {
      const profileJson = localStorage.getItem("userProfile");
      if (profileJson) {
        const profile = JSON.parse(profileJson);
        if (profile.gender === "male") {
          const cycleLink = root.querySelector('.benji-nav a[data-page="cycle"]');
          if (cycleLink) cycleLink.style.display = "none";
        }
      }
    } catch (_) {}

    // Highlight active nav item
    const currentPage = document.body.dataset.page;
    document.querySelectorAll(".benji-nav a[data-page]").forEach((link) => {
      link.classList.toggle("active", link.dataset.page === currentPage);
    });

    // Set date
    const dateEl = document.getElementById("benjiDate");
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    }

  } catch (err) {
    console.error("Benji/Benji header failed:", err);
    root.innerHTML = `
      <div style="
        padding:12px;
        margin:12px;
        border:1px solid #f99;
        border-radius:12px;
        background:#fff3f3;
        font-family: system-ui, sans-serif;
      ">
        <strong>Header failed to load.</strong><br><br>
        Tried loading:<br>
        <code>${HEADER_URL}</code><br><br>
        Open DevTools → Network → look for <code>topbar.html</code>.
      </div>
    `;
  }
});

