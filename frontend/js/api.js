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
  };

  global.BenjiAPI = BenjiAPI;
})(typeof window !== "undefined" ? window : this);
