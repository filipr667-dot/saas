import axios from "axios";

// Use current window origin to avoid cross-origin CORS issues with Emergent's ingress layer.
// Both preview domains route /api/* to the same backend via Kubernetes ingress.
const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL ||
  (typeof window !== "undefined" && !window.location.hostname.includes("localhost")
    ? "https://saas-3j28.onrender.com"
    : "http://localhost:8001");

const getApiBase = () => `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: getApiBase(),
  withCredentials: true,
});

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      try {
        await api.post("/auth/refresh", {}, { withCredentials: true });
        return api(original);
      } catch {
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
