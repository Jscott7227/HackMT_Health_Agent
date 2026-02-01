(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---- Configuration ----
  const STORAGE_KEY = "Benji_medications";
  const SCHEDULE_MODE_KEY = "Benji_medication_schedule_mode"; // 'standard' or 'ai'
  const BACKEND_URL = "http://127.0.0.1:8000";

  // ---- State ----
  let medications = [];
  let editingId = null;
  let complianceData = {};
  let currentComplianceDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // ---- DOM Elements ----
  const medicationList = $("#medicationList");
  const emptyState = $("#emptyState");
  const medicationModal = $("#medicationModal");
  const formTitle = $("#formTitle");
  const addMedBtn = $("#addMedBtn");
  const saveMedBtn = $("#saveMedBtn");
  const cancelMedBtn = $("#cancelMedBtn");
  const saveBtnText = $("#saveBtnText");
  const medicationModalClose = $("#medicationModalClose");
  const generateScheduleBtn = $("#generateScheduleBtn"); // Legacy (kept for backward compatibility)
  const standardScheduleBtn = $("#standardScheduleBtn");
  const benjiScheduleBtn = $("#benjiScheduleBtn");
  const scheduleDisplay = $("#scheduleDisplay");
  const personalizationNotes = $("#personalizationNotes");
  const personalizationNotesText = $("#personalizationNotesText");
  const loadingOverlay = $("#loadingOverlay");

  // Form inputs
  const medName = $("#medName");
  const medStrength = $("#medStrength");
  const medFrequency = $("#medFrequency");
  const medFoodInstruction = $("#medFoodInstruction");
  const medNotes = $("#medNotes");

  // Compliance elements
  const complianceList = $("#complianceList");
  const complianceEmptyState = $("#complianceEmptyState");
  const complianceLoadingState = $("#complianceLoadingState");
  const complianceDateInput = $("#complianceDate");

  // ---- Helper Functions ----
  function generateId() {
    return `med_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function getUserId() {
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
    console.log(`[${type.toUpperCase()}]`, text);
  }

  function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function getFoodInstructionLabel(value) {
    const labels = {
      "with_food": "Take with food",
      "empty_stomach": "Take on empty stomach",
      "no_preference": "No preference"
    };
    return labels[value] || "No preference";
  }

  // ---- API Operations ----
  async function loadMedicationsFromAPI() {
    const userId = getUserId();
    if (!userId) {
      // Not logged in, load from localStorage
      loadMedicationsFromStorage();
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/medications/${userId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.list && data.list.length > 0) {
          medications = data.list;
          // Update localStorage as backup
          localStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
        } else {
          // No data in API, check localStorage for migration
          const stored = localStorage.getItem(STORAGE_KEY);
          if (stored) {
            medications = JSON.parse(stored);
            if (medications.length > 0) {
              // Migrate to API
              await saveMedicationsToAPI();
            }
          } else {
            medications = [];
          }
        }
      } else if (response.status === 404) {
        // User exists but no medications doc - load from localStorage for migration
        loadMedicationsFromStorage();
        if (medications.length > 0) {
          await saveMedicationsToAPI();
        }
      } else {
        throw new Error(`API error: ${response.statusText}`);
      }
    } catch (e) {
      console.error("Error loading from API, falling back to localStorage:", e);
      loadMedicationsFromStorage();
    }

    renderMedications();
    renderComplianceList();
  }

  function loadMedicationsFromStorage() {
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
  }

  async function saveMedicationsToAPI() {
    const userId = getUserId();
    if (!userId) {
      // Not logged in, save to localStorage only
      localStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/medications/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ list: medications })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      // Also update localStorage as backup
      localStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
      console.log("Medications saved to API");
    } catch (e) {
      console.error("Error saving to API:", e);
      // Still save to localStorage
      localStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
    }
  }

  // ---- CRUD Operations ----
  async function addMedication(med) {
    const newMed = {
      id: generateId(),
      name: med.name.trim(),
      strength: med.strength.trim(),
      frequency: med.frequency.trim(),
      foodInstruction: med.foodInstruction || "no_preference",
      notes: med.notes ? med.notes.trim() : ""
    };
    medications.push(newMed);
    await saveMedicationsToAPI();
    renderMedications();
    renderComplianceList();
    showMessage("Medication added successfully", "success");
  }

  async function editMedication(id, med) {
    const index = medications.findIndex(m => m.id === id);
    if (index !== -1) {
      medications[index] = {
        id: id,
        name: med.name.trim(),
        strength: med.strength.trim(),
        frequency: med.frequency.trim(),
        foodInstruction: med.foodInstruction || "no_preference",
        notes: med.notes ? med.notes.trim() : ""
      };
      await saveMedicationsToAPI();
      renderMedications();
      renderComplianceList();
      showMessage("Medication updated successfully", "success");
    }
  }

  async function deleteMedication(id) {
    const med = medications.find(m => m.id === id);
    if (!med) return;

    if (confirm(`Delete ${med.name}?`)) {
      medications = medications.filter(m => m.id !== id);
      await saveMedicationsToAPI();
      renderMedications();
      renderComplianceList();
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

    medicationList.innerHTML = medications.map(med => {
      const foodLabel = getFoodInstructionLabel(med.foodInstruction);
      const notesHtml = med.notes ? `<br><strong>Notes:</strong> ${escapeHtml(med.notes)}` : "";
      const foodHtml = med.foodInstruction && med.foodInstruction !== "no_preference" 
        ? `<br><strong>Food:</strong> ${foodLabel}` 
        : "";

      return `
        <div class="medication-card" data-id="${med.id}">
          <div class="medication-info">
            <h4 class="medication-name">${escapeHtml(med.name)}</h4>
            <p class="medication-details">
              <strong>Strength:</strong> ${escapeHtml(med.strength)}<br>
              <strong>Frequency:</strong> ${escapeHtml(med.frequency)}${foodHtml}${notesHtml}
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
      `;
    }).join("");

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

  // ---- Form Management (Modal Popup) ----
  function showForm() {
    if (!medicationModal) return;
    medicationModal.classList.add("active");
    medicationModal.setAttribute("aria-hidden", "false");
    setTimeout(() => medName?.focus(), 100);
  }

  function hideForm() {
    if (!medicationModal) return;
    medicationModal.classList.remove("active");
    medicationModal.setAttribute("aria-hidden", "true");
    clearForm();
  }

  function clearForm() {
    medName.value = "";
    medStrength.value = "";
    medFrequency.value = "";
    if (medFoodInstruction) medFoodInstruction.value = "no_preference";
    if (medNotes) medNotes.value = "";
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
    if (medFoodInstruction) medFoodInstruction.value = med.foodInstruction || "no_preference";
    if (medNotes) medNotes.value = med.notes || "";
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

  // ---- Schedule Generation (Structured API) ----
  // Track which schedule mode is active
  let currentScheduleMode = 'standard'; // 'standard' or 'ai'

  async function fetchSchedule(showLoadingIndicator = true, useAi = false) {
    const userId = getUserId();
    if (!userId) {
      // Not logged in - show empty state
      if (scheduleDisplay) {
        scheduleDisplay.innerHTML = `
          <p style="text-align: center; color: var(--text-secondary); padding: var(--space-lg);">
            Please log in to view your medication schedule.
          </p>
        `;
      }
      // Hide personalization notes when not logged in
      if (personalizationNotes) personalizationNotes.style.display = "none";
      return;
    }

    if (showLoadingIndicator) showLoading(true);

    // Update button states
    currentScheduleMode = useAi ? 'ai' : 'standard';
    updateScheduleButtonStates();

    try {
      // Build URL with optional use_ai parameter
      let url = `${BACKEND_URL}/medication-schedule/${userId}`;
      if (useAi) {
        url += "?use_ai=true";
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch schedule: ${response.statusText}`);
      }

      const data = await response.json();
      displayStructuredSchedule(data, useAi);
      if (showLoadingIndicator) {
        showMessage(useAi ? "Benji's schedule loaded" : "Standard schedule loaded", "success");
      }
    } catch (e) {
      console.error("Error fetching schedule:", e);
      if (scheduleDisplay) {
        scheduleDisplay.innerHTML = `
          <div class="warning-banner">
            <p><strong>Error:</strong> Unable to load schedule. Please make sure the backend is running.</p>
            <p style="font-size: 0.9em; margin-top: 8px;">${e.message}</p>
          </div>
        `;
      }
      // Hide personalization notes on error
      if (personalizationNotes) personalizationNotes.style.display = "none";
    } finally {
      if (showLoadingIndicator) showLoading(false);
    }
  }

  function updateScheduleButtonStates() {
    // Update button styles to show which is active
    if (standardScheduleBtn) {
      if (currentScheduleMode === 'standard') {
        standardScheduleBtn.classList.add('btn-primary');
      } else {
        standardScheduleBtn.classList.remove('btn-primary');
      }
    }
    if (benjiScheduleBtn) {
      if (currentScheduleMode === 'ai') {
        benjiScheduleBtn.classList.add('btn-primary');
      } else {
        benjiScheduleBtn.classList.remove('btn-primary');
      }
    }
  }

  function displayStructuredSchedule(schedule, isAiSchedule = false) {
    const { timeSlotsDetailed, warnings, personalizationNotes: notes } = schedule;

    // Show or hide personalization notes based on AI mode and content
    if (personalizationNotes && personalizationNotesText) {
      if (isAiSchedule && notes) {
        personalizationNotesText.textContent = notes;
        personalizationNotes.style.display = "block";
      } else {
        personalizationNotes.style.display = "none";
      }
    }

    // Use calendar-style view from timeSlotsDetailed (option A: only show detailed, not generalized)
    if (!timeSlotsDetailed || timeSlotsDetailed.length === 0) {
      scheduleDisplay.innerHTML = `
        <p style="text-align: center; color: var(--text-secondary); padding: var(--space-lg);">
          No medications scheduled. Add medications to see your daily schedule.
        </p>
      `;
      return;
    }

    // Time slot icons by slot name
    const timeSlotIcons = {
      morning: '<i class="fas fa-sun" style="color: #f59e0b;"></i>',
      afternoon: '<i class="fas fa-cloud-sun" style="color: #3b82f6;"></i>',
      evening: '<i class="fas fa-moon" style="color: #8b5cf6;"></i>',
      night: '<i class="fas fa-star" style="color: #6366f1;"></i>'
    };

    // Build calendar-style schedule HTML
    let calendarHtml = '<div class="schedule-calendar">';
    for (const entry of timeSlotsDetailed) {
      const icon = timeSlotIcons[entry.slot] || '<i class="fas fa-clock"></i>';
      const medsHtml = entry.medications.map(med => `<li>${escapeHtml(med)}</li>`).join("");
      const foodNoteHtml = entry.foodNote 
        ? `<div class="schedule-calendar-food"><i class="fas fa-utensils"></i> ${escapeHtml(entry.foodNote)}</div>` 
        : '';

      calendarHtml += `
        <div class="schedule-calendar-entry">
          <div class="schedule-calendar-time">
            ${icon}
            <span class="time-label">${escapeHtml(entry.label)}</span>
          </div>
          <div class="schedule-calendar-meds">
            <ul>${medsHtml}</ul>
            ${foodNoteHtml}
          </div>
        </div>
      `;
    }
    calendarHtml += '</div>';

    // Build warnings HTML (keep warnings visible)
    let warningsHtml = '';
    if (warnings && warnings.length > 0) {
      const hasWarning = warnings.some(w => w.includes("CAUTION") || w.includes("WARNING"));
      const warningClass = hasWarning ? "schedule-warnings" : "schedule-tips";
      const warningIcon = hasWarning ? "fa-exclamation-triangle" : "fa-info-circle";
      warningsHtml = `
        <div class="schedule-section ${warningClass}">
          <h4 class="schedule-section-title"><i class="fas ${warningIcon}"></i> ${hasWarning ? "Warnings" : "Tips"}</h4>
          <ul class="schedule-list">
            ${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    scheduleDisplay.innerHTML = `
      <div class="schedule-content">
        ${calendarHtml}
        ${warningsHtml}
      </div>
    `;
  }

  // ---- Compliance ----
  async function loadCompliance(date) {
    const userId = getUserId();
    if (!userId) {
      renderComplianceList();
      return;
    }

    if (complianceLoadingState) complianceLoadingState.style.display = "block";
    if (complianceList) complianceList.style.display = "none";
    if (complianceEmptyState) complianceEmptyState.style.display = "none";

    try {
      const response = await fetch(`${BACKEND_URL}/compliance/${userId}?date=${date}`);
      if (response.ok) {
        const data = await response.json();
        // Build map of medication_id -> compliance entry
        complianceData = {};
        (data.entries || []).forEach(entry => {
          complianceData[entry.medication_id] = entry;
        });
      } else {
        complianceData = {};
      }
    } catch (e) {
      console.error("Error loading compliance:", e);
      complianceData = {};
    }

    if (complianceLoadingState) complianceLoadingState.style.display = "none";
    renderComplianceList();
  }

  async function saveCompliance() {
    const userId = getUserId();
    if (!userId) {
      alert("Please log in to save compliance");
      return;
    }

    const entries = medications.map(med => ({
      medication_id: med.id,
      medication_name: med.name,
      taken: complianceData[med.id]?.taken || false,
      time_taken: complianceData[med.id]?.time_taken || null
    }));

    try {
      const response = await fetch(`${BACKEND_URL}/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          date: currentComplianceDate,
          entries: entries
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save compliance: ${response.statusText}`);
      }

      showMessage("Compliance saved", "success");
    } catch (e) {
      console.error("Error saving compliance:", e);
      showMessage("Failed to save compliance", "error");
    }
  }

  function renderComplianceList() {
    if (medications.length === 0) {
      if (complianceList) complianceList.style.display = "none";
      if (complianceEmptyState) complianceEmptyState.style.display = "block";
      return;
    }

    if (complianceEmptyState) complianceEmptyState.style.display = "none";
    if (complianceList) complianceList.style.display = "block";

    if (!complianceList) return;

    complianceList.innerHTML = medications.map(med => {
      const entry = complianceData[med.id] || {};
      const isTaken = entry.taken || false;
      const takenClass = isTaken ? "taken" : "not-taken";
      const takenIcon = isTaken ? "fa-check-circle" : "fa-circle";
      const takenText = isTaken ? "Taken" : "Not taken";

      return `
        <div class="compliance-item ${takenClass}" data-med-id="${med.id}">
          <div class="compliance-info">
            <span class="compliance-med-name">${escapeHtml(med.name)}</span>
            <span class="compliance-med-strength">${escapeHtml(med.strength)}</span>
          </div>
          <div class="compliance-actions">
            <button class="compliance-toggle ${takenClass}" data-med-id="${med.id}" title="${takenText}">
              <i class="fas ${takenIcon}"></i>
              <span>${takenText}</span>
            </button>
          </div>
        </div>
      `;
    }).join("");

    // Attach toggle event listeners
    $$(".compliance-toggle").forEach(btn => {
      btn.addEventListener("click", async () => {
        const medId = btn.dataset.medId;
        const currentEntry = complianceData[medId] || {};
        const newTaken = !currentEntry.taken;

        complianceData[medId] = {
          medication_id: medId,
          taken: newTaken,
          time_taken: newTaken ? new Date().toTimeString().slice(0, 5) : null
        };

        renderComplianceList();
        await saveCompliance();
      });
    });
  }

  // ---- Event Listeners ----
  addMedBtn?.addEventListener("click", () => {
    clearForm();
    showForm();
  });

  cancelMedBtn?.addEventListener("click", () => {
    hideForm();
  });

  medicationModalClose?.addEventListener("click", () => {
    hideForm();
  });

  // Close modal when clicking the overlay backdrop (not the dialog)
  medicationModal?.addEventListener("click", (e) => {
    if (e.target === medicationModal) {
      hideForm();
    }
  });

  // Close modal on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && medicationModal?.classList.contains("active")) {
      hideForm();
    }
  });

  saveMedBtn?.addEventListener("click", async () => {
    if (!validateForm()) return;

    const med = {
      name: medName.value,
      strength: medStrength.value,
      frequency: medFrequency.value,
      foodInstruction: medFoodInstruction?.value || "no_preference",
      notes: medNotes?.value || ""
    };

    if (editingId) {
      await editMedication(editingId, med);
    } else {
      await addMedication(med);
    }

    hideForm();
  });

  // Legacy button (kept for backward compatibility)
  generateScheduleBtn?.addEventListener("click", () => {
    fetchSchedule(true, false); // Standard schedule
  });

  // Standard Schedule button
  standardScheduleBtn?.addEventListener("click", () => {
    localStorage.setItem(SCHEDULE_MODE_KEY, 'standard');
    fetchSchedule(true, false); // useAi = false
  });

  // Benji's Suggested Schedule button (AI-powered)
  benjiScheduleBtn?.addEventListener("click", () => {
    localStorage.setItem(SCHEDULE_MODE_KEY, 'ai');
    fetchSchedule(true, true); // useAi = true
  });

  // Compliance date picker
  if (complianceDateInput) {
    complianceDateInput.value = currentComplianceDate;
    complianceDateInput.addEventListener("change", (e) => {
      currentComplianceDate = e.target.value;
      loadCompliance(currentComplianceDate);
    });
  }

  // ---- Initialization ----
  async function init() {
    await loadMedicationsFromAPI();
    
    // Auto-load schedule on page load with persisted mode
    const savedMode = localStorage.getItem(SCHEDULE_MODE_KEY);
    const useAi = savedMode === 'ai';
    
    // Set initial button states based on saved mode
    currentScheduleMode = useAi ? 'ai' : 'standard';
    updateScheduleButtonStates();
    
    // Load the schedule with the saved mode (no loading indicator on init)
    await fetchSchedule(false, useAi);
    await loadCompliance(currentComplianceDate);
  }

  init();
})();
