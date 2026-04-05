const API_URL = import.meta.env.VITE_API_URL || "";

const getAuthHeaders = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const apiFetch = async (url, options = {}) => {
  return fetch(url, { ...options, credentials: "include" });
};

const handleResponse = async (res, errorMsg) => {
  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    let data = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      data = {};
    }

    const backendMessage = typeof data.error === "string" ? data.error.trim() : "";
    const message = backendMessage || errorMsg;
    throw new Error(message);
  }
  return res.json();
};

export const fetchDomains = async () => {
  const res = await apiFetch(`${API_URL}/api/roadmaps/domains`);
  return handleResponse(res, "Failed to load domains");
};

export const startAssessment = async (payload, token) => {
  const res = await apiFetch(`${API_URL}/api/assessment/start`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, "Failed to start assessment");
};

export const submitAssessment = async (payload, token) => {
  const res = await apiFetch(`${API_URL}/api/assessment/submit`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify(payload),
  });
  return handleResponse(res, "Failed to submit assessment");
};

export const skipAssessment = async (domainId, token) => {
  const res = await apiFetch(`${API_URL}/api/assessment/skip/${domainId}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res, "Failed to fetch roadmap");
};

export const fetchHistory = async (token) => {
  const res = await apiFetch(`${API_URL}/api/assessment/history`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res, "Failed to load history");
};

export const fetchGeneratedRoadmap = async (id, token) => {
  const res = await apiFetch(`${API_URL}/api/assessment/roadmap/${id}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res, "Failed to load roadmap");
};

export const fetchResources = async (query, topic, token) => {
  const params = new URLSearchParams({ q: query, topic });
  const res = await apiFetch(`${API_URL}/api/resources?${params}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res, "Failed to fetch resources");
};

export const fetchCompletedTopics = async (domain, token) => {
  const params = new URLSearchParams({ domain });
  const res = await apiFetch(`${API_URL}/api/progress/completed?${params}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res, "Failed to fetch completed topics");
};

export const toggleTopicCompletion = async (topic, domain, complete, token) => {
  const endpoint = complete ? "/api/progress/complete" : "/api/progress/uncomplete";
  const res = await apiFetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers: getAuthHeaders(token),
    body: JSON.stringify({ topic, domain }),
  });
  return handleResponse(res, "Failed to update progress");
};

export const fetchHeatmapData = async (token) => {
  const res = await apiFetch(`${API_URL}/api/progress/heatmap`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res, "Failed to fetch heatmap data");
};

export const fetchLearningForecast = async (domain, token) => {
  const params = new URLSearchParams({ domain });
  const res = await apiFetch(`${API_URL}/api/progress/forecast?${params}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res, "Failed to fetch learning forecast");
};

export const fetchLearningForecastV2 = async (domain, token) => {
  const params = new URLSearchParams({ domain });
  const res = await apiFetch(`${API_URL}/api/progress/forecast-v2?${params}`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res, "Failed to fetch advanced learning forecast");
};

export const loginUser = async (email, password) => {
  const res = await apiFetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res, "Login failed");
};

export const registerUser = async (name, email, password) => {
  const res = await apiFetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return handleResponse(res, "Registration failed");
};

export const fetchCurrentUser = async (token) => {
  const res = await apiFetch(`${API_URL}/api/auth/me`, {
    headers: getAuthHeaders(token),
  });
  return handleResponse(res, "Failed to fetch user");
};

export const logoutUser = async () => {
  const res = await apiFetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
  });
  return handleResponse(res, "Logout failed");
};
