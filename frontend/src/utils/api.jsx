import axios from "axios";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== "undefined" && !window.location.hostname.includes("localhost")
    ? "https://saas-3j28.onrender.com"
    : "http://localhost:8001");

const getApiBase = () => `${BACKEND_URL}/api`;

// Per-tab token storage — sessionStorage is isolated per tab so multiple
// users can be logged in simultaneously in different tabs.
export const tokenStore = {
  getAccess: () => sessionStorage.getItem("access_token"),
  getRefresh: () => sessionStorage.getItem("refresh_token"),
  set: (access, refresh) => {
    sessionStorage.setItem("access_token", access);
    if (refresh) sessionStorage.setItem("refresh_token", refresh);
  },
  clear: () => {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
  },
};

export const api = axios.create({
  baseURL: getApiBase(),
  withCredentials: false,
});

// Inject Authorization header on every request
api.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) config.headers["Authorization"] = `Bearer ${token}`;
  return config;
});

// On 401 — try refresh, then retry original request
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      try {
        const refreshToken = tokenStore.getRefresh();
        if (!refreshToken) throw new Error("No refresh token");
        const { data } = await api.post("/auth/refresh", { refresh_token: refreshToken });
        tokenStore.set(data.access_token, null);
        original.headers["Authorization"] = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        tokenStore.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export function formatError(e) {
  const detail = e?.response?.data?.detail;
  if (!detail) return e?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((x) => x?.msg || String(x)).join(" ");
  return String(detail);
}

export default api;
