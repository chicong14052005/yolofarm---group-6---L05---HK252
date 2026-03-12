import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor — gắn JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("yolofarm_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — xử lý lỗi 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("yolofarm_token");
      localStorage.removeItem("yolofarm_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export default api;
