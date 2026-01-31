(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---- Configuration ----
  const STORAGE_KEY = "Benji_medications";
  const BACKEND_URL = "http://127.0.0.1:8000";

  // ---- State ----
  let medications = [];
  let editingId = null;

  // ---- DOM Elements ----
  const medicationList = $("#medicationList");
  const emptyState = $("#emptyState");
  const medicationForm = $("#medicationForm");
  const formTitle = $("#formTitle");
  const addMedBtn = $("#addMedBtn");
  const saveMedBtn = $("#saveMedBtn");
  const cancelMedBtn = $("#cancelMedBtn");
  const saveBtnText = $("#saveBtnText");
  const generateScheduleBtn = $("#generateScheduleBtn");
  const scheduleDisplay = $("#scheduleDisplay");
  const loadingOverlay = $("#loadingOverlay");

  // Form inputs
  const medName = $("#medName");
  const medStrength = $("#medStrength");
  const medFrequency = $("#medFrequency");

  // ---- Helper Functions ----
  function generateId() {
    return `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function getUserId() {
    // Get user_id from localStorage session
    try {
      const session = localStorage.getItem("sanctuary_session");
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.user_id || null;
      }
    } catch (e) {
      console.error("Error getting user_id:", e);
    }
    return null;
  }

  function showLoading(show = true) {
    if (loadingOverlay) {
      loadingOverlay.style.display = show ? "flex" : "none";
    }
  }

  function showMessage(text, type = "info") {
    // Simple console log for now; could enhance with toast notifications
    console.log(`[${type.toUpperCase()}]`, text);
  }

  // ---- CRUD Operations ----
  function loadMedications() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        medications = JSON.parse(stored);
      } else {
        medications = [];
      }
    } catch (e) {
      console.error("Error loading medications:", e);
      medications = [];
    }
    renderMedications();
  }

  function saveMedications() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
      syncWithBackend();
    } catch (e) {
      console.error("Error saving medications:", e);
      showMessage("Failed to save medications", "error");
    }
  }

  async function syncWithBackend() {
    const userId = getUserId();
    if (!userId) {
      console.log("No user_id found, skipping backend sync");
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/update_facts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          user_facts: {
            medications: medications
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Backend sync failed: ${response.statusText}`);
      }

      console.log("Medications synced with backend");
    } catch (e) {
      console.error("Error syncing with backend:", e);
      // Don't show error to user - localStorage is primary storage
    }
  }

  function addMedication(med) {
    const newMed = {
      id: generateId(),
      name: med.name.trim(),
      strength: med.strength.trim(),
      frequency: med.frequency.trim()
    };
    medications.push(newMed);
    saveMedications();
    renderMedications();
    showMessage("Medication added successfully", "success");
  }

  function editMedication(id, med) {
    const index = medications.findIndex(m => m.id === id);
    if (index !== -1) {
      medications[index] = {
        id: id,
        name: med.name.trim(),
        strength: med.strength.trim(),
        frequency: med.frequency.trim()
      };
      saveMedications();
      renderMedications();
      showMessage("Medication updated successfully", "success");
    }
  }

  function deleteMedication(id) {
    const med = medications.find(m => m.id === id);
    if (!med) return;

    if (confirm(`Delete ${med.name}?`)) {
      medications = medications.filter(m => m.id !== id);
      saveMedications();
      renderMedications();
      showMessage("Medication deleted", "info");
    }
  }

  // ---- Rendering ----
  function renderMedications() {
    if (medications.length === 0) {
      medicationList.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";
    
    medicationList.innerHTML = medications.map(med => `
      <div class="medication-card" data-id="${med.id}">
        <div class="medication-info">
          <h4 class="medication-name">${escapeHtml(med.name)}</h4>
          <p class="medication-details">
            <strong>Strength:</strong> ${escapeHtml(med.strength)}<br>
            <strong>Frequency:</strong> ${escapeHtml(med.frequency)}
          </p>
        </div>
        <div class="medication-actions">
          <button class="btn-icon edit-btn" data-id="${med.id}" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-icon delete-btn" data-id="${med.id}" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `).join("");

    // Attach event listeners
    $$(".edit-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        startEdit(id);
      });
    });

    $$(".delete-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        deleteMedication(id);
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // ---- Form Management ----
  function showForm() {
    medicationForm.style.display = "block";
    medicationForm.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function hideForm() {
    medicationForm.style.display = "none";
    clearForm();
  }

  function clearForm() {
    medName.value = "";
    medStrength.value = "";
    medFrequency.value = "";
    editingId = null;
    formTitle.textContent = "Add Medication";
    saveBtnText.textContent = "Save Medication";
  }

  function startEdit(id) {
    const med = medications.find(m => m.id === id);
    if (!med) return;

    editingId = id;
    medName.value = med.name;
    medStrength.value = med.strength;
    medFrequency.value = med.frequency;
    formTitle.textContent = "Edit Medication";
    saveBtnText.textContent = "Update Medication";
    showForm();
  }

  function validateForm() {
    if (!medName.value.trim()) {
      alert("Please enter medication name");
      medName.focus();
      return false;
    }
    if (!medStrength.value.trim()) {
      alert("Please enter medication strength");
      medStrength.focus();
      return false;
    }
    if (!medFrequency.value.trim()) {
      alert("Please enter frequency");
      medFrequency.focus();
      return false;
    }
    return true;
  }

  // ---- Schedule Generation ----
  async function fetchSchedule() {
    if (medications.length === 0) {
      alert("Please add at least one medication first");
      return;
    }

    const userId = getUserId();
    if (!userId) {
      alert("Please log in to generate schedule");
      return;
    }

    showLoading(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          user_input: "Generate my medication schedule with contraindication checks and timing recommendations",
          user_facts: {
            medications: medications
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate schedule: ${response.statusText}`);
      }

      const data = await response.json();
      displaySchedule(data.response);
      showMessage("Schedule generated successfully", "success");
    } catch (e) {
      console.error("Error generating schedule:", e);
      scheduleDisplay.innerHTML = `
        <div class="warning-banner">
          <p><strong>Error:</strong> Unable to generate schedule. Please make sure the backend is running.</p>
          <p style="font-size: 0.9em; margin-top: 8px;">${e.message}</p>
        </div>
      `;
    } finally {
      showLoading(false);
    }
  }

  function displaySchedule(scheduleText) {
    // Format the schedule response from the LLM
    scheduleDisplay.innerHTML = `
      <div class="schedule-content">
        <div class="schedule-text">
          ${formatScheduleText(scheduleText)}
        </div>
      </div>
    `;
  }

  function formatScheduleText(text) {
    // Convert newlines to <br> and wrap in paragraphs
    const lines = text.split('\n').filter(line => line.trim());
    
    let html = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      
      // Detect headers (lines that end with : or are all caps)
      if (trimmed.endsWith(':') || (trimmed === trimmed.toUpperCase() && trimmed.length < 50)) {
        html += `<h4 style="margin-top: 1em; margin-bottom: 0.5em; color: var(--primary);">${escapeHtml(trimmed)}</h4>`;
      }
      // Detect warnings (lines with WARNING, CAUTION, etc.)
      else if (trimmed.match(/warning|caution|contraindication|avoid|do not/i)) {
        html += `<p class="warning-text" style="color: var(--terracotta); margin: 0.5em 0;">${escapeHtml(trimmed)}</p>`;
      }
      // Regular lines
      else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
        html += `<p style="margin: 0.5em 0; padding-left: 1em;">${escapeHtml(trimmed)}</p>`;
      }
      else {
        html += `<p style="margin: 0.5em 0;">${escapeHtml(trimmed)}</p>`;
      }
    });
    
    return html || '<p>No schedule information available.</p>';
  }

  // ---- Event Listeners ----
  addMedBtn?.addEventListener("click", () => {
    clearForm();
    showForm();
  });

  cancelMedBtn?.addEventListener("click", () => {
    hideForm();
  });

  saveMedBtn?.addEventListener("click", () => {
    if (!validateForm()) return;

    const med = {
      name: medName.value,
      strength: medStrength.value,
      frequency: medFrequency.value
    };

    if (editingId) {
      editMedication(editingId, med);
    } else {
      addMedication(med);
    }

    hideForm();
  });

  generateScheduleBtn?.addEventListener("click", () => {
    fetchSchedule();
  });

  // ---- Initialization ----
  loadMedications();
})();
