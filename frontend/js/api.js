/**
 * Shared API layer for Benji frontend.
 * Use this so all pages use the same base URL and session when calling the backend.
 */
(function (global) {
  "use strict";

  var API_BASE = "http://127.0.0.1:8000";

  function getSession() {
    var s1 = localStorage.getItem("sanctuary_session");
    if (s1) return JSON.parse(s1);
    var s2 = sessionStorage.getItem("sanctuary_session");
    if (s2) return JSON.parse(s2);
    return null;
  }

  function request(path, options) {
    options = options || {};
    var url = path.indexOf("http") === 0 ? path : API_BASE + path;
    var opts = {
      method: options.method || "GET",
      headers: Object.assign({ "Content-Type": "application/json" }, options.headers),
    };
    if (options.body && typeof options.body === "object" && !(options.body instanceof FormData)) {
      opts.body = JSON.stringify(options.body);
    } else if (options.body) {
      opts.body = options.body;
    }
    return fetch(url, opts);
  }

  var BenjiAPI = {
    API_BASE: API_BASE,
    getSession: getSession,

    getProfileInfo: function (userId) {
      return request("/profileinfo/" + userId).then(function (r) {
        if (!r.ok) throw new Error("ProfileInfo not found");
        return r.json();
      });
    },
    updateProfileInfo: function (userId, payload) {
      return request("/profileinfo/" + userId, {
        method: "PATCH",
        body: payload,
      }).then(function (r) {
        if (r.status === 404) {
          return request("/profileinfo/" + userId, { method: "POST", body: payload });
        }
        if (!r.ok) throw new Error("Update failed");
        return r.json();
      });
    },

    getGoals: function (userId) {
      return request("/goals/" + userId).then(function (r) {
        if (r.status === 404) return { accepted: [], generated: [] };
        if (!r.ok) throw new Error("Goals fetch failed");
        return r.json();
      });
    },
    postGoalsAccepted: function (userId, goals) {
      return request("/goals/" + userId + "/accepted", {
        method: "POST",
        body: { goals: goals },
      }).then(function (r) {
        if (!r.ok) throw new Error("Save goals failed");
        return r.json();
      });
    },
    postGoalsGenerate: function (body) {
      return request("/goals", { method: "POST", body: body }).then(function (r) {
        if (!r.ok) throw new Error("Generate goals failed");
        return r.json();
      });
    },

    postRun: function (body) {
      return request("/run", { method: "POST", body: body }).then(function (r) {
        if (!r.ok) throw new Error("Run failed");
        return r.json();
      });
    },
    postUpcoming: function (body) {
      return request("/upcoming", { method: "POST", body: body }).then(function (r) {
        if (!r.ok) throw new Error("Upcoming failed");
        return r.json();
      });
    },

    getCheckins: function (userId) {
      return request("/checkins/" + userId).then(function (r) {
        if (r.status === 404) return [];
        if (!r.ok) throw new Error("Checkins fetch failed");
        return r.json();
      });
    },
    postCheckin: function (body) {
      return request("/checkins", { method: "POST", body: body }).then(function (r) {
        if (!r.ok) throw new Error("Save check-in failed");
        return r.json();
      });
    },

    postCheckinRecommendations: function (body) {
      return request("/checkin-recommendations", { method: "POST", body: body }).then(function (r) {
        if (!r.ok) throw new Error("Failed to get check-in recommendations");
        return r.json();
      });
    },

    postCheckinSense: function (body) {
      // Generate "Benji's Notes" post check-in insights
      return request("/checkin-sense", { method: "POST", body: body }).then(function (r) {
        if (!r.ok) throw new Error("Failed to get check-in insights");
        return r.json();
      });
    },

    getMedicationSchedule: function (userId, useAi) {
      // Build URL with optional use_ai query parameter
      var url = "/medication-schedule/" + userId;
      if (useAi === true) {
        url += "?use_ai=true";
      }
      return request(url).then(function (r) {
        if (r.status === 404) {
          return {
            timeSlots: { morning: [], afternoon: [], evening: [], night: [] },
            foodInstructions: [],
            warnings: [],
            spacingNotes: [],
            timeSlotsDetailed: [],
            personalizationNotes: null
          };
        }
        if (!r.ok) throw new Error("Medication schedule fetch failed");
        return r.json();
      });
    },

    // AI schedule cache (localStorage) – agent runs only on "Benji's suggested schedule" click
    AI_SCHEDULE_CACHE_KEY_PREFIX: "Benji_medication_schedule_ai_cache_",

    getCachedAiSchedule: function (userId) {
      if (!userId || typeof localStorage === "undefined") return null;
      try {
        var raw = localStorage.getItem(this.AI_SCHEDULE_CACHE_KEY_PREFIX + userId);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    setCachedAiSchedule: function (userId, data) {
      if (!userId || typeof localStorage === "undefined" || !data) return;
      try {
        localStorage.setItem(this.AI_SCHEDULE_CACHE_KEY_PREFIX + userId, JSON.stringify(data));
      } catch (e) {
        // ignore quota or parse errors
      }
    },

    clearCachedAiSchedule: function (userId) {
      if (!userId || typeof localStorage === "undefined") return;
      try {
        localStorage.removeItem(this.AI_SCHEDULE_CACHE_KEY_PREFIX + userId);
      } catch (e) {
        // ignore
      }
    },

    // Cycle recommendations API method
    getCycleRecommendations: function (userId) {
      return request("/menstrual-recommendations/" + userId).then(function (r) {
        if (r.status === 404) {
          return {
            user_id: userId,
            current_phase: null,
            cycle_day: null,
            predicted_period_onset: null,
            recommendations: [],
            personalization_notes: null
          };
        }
        if (!r.ok) throw new Error("Cycle recommendations fetch failed");
        return r.json();
      });
    },

    // Cycle recommendations cache (localStorage) – agent runs only on "Get Benji's recommendations" click
    CYCLE_RECOMMENDATIONS_CACHE_KEY_PREFIX: "Benji_cycle_recommendations_cache_",

    getCachedCycleRecommendations: function (userId) {
      if (!userId || typeof localStorage === "undefined") return null;
      try {
        var raw = localStorage.getItem(this.CYCLE_RECOMMENDATIONS_CACHE_KEY_PREFIX + userId);
        if (!raw) return null;
        return JSON.parse(raw);
      } catch (e) {
        return null;
      }
    },

    setCachedCycleRecommendations: function (userId, data) {
      if (!userId || typeof localStorage === "undefined" || !data) return;
      try {
        localStorage.setItem(this.CYCLE_RECOMMENDATIONS_CACHE_KEY_PREFIX + userId, JSON.stringify(data));
      } catch (e) {
        // ignore quota or parse errors
      }
    },

    clearCachedCycleRecommendations: function (userId) {
      if (!userId || typeof localStorage === "undefined") return;
      try {
        localStorage.removeItem(this.CYCLE_RECOMMENDATIONS_CACHE_KEY_PREFIX + userId);
      } catch (e) {
        // ignore
      }
    },
  };

  global.BenjiAPI = BenjiAPI;
})(typeof window !== "undefined" ? window : this);
