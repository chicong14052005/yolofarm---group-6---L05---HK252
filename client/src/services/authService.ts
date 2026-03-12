import api from "./api";

const TOKEN_KEY = "yolofarm_token";
const USER_KEY = "yolofarm_user";

const authService = {
  async login(credentials: { username: string; password: string }) {
    const { data } = await api.post("/auth/login", credentials);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },
  async register(userData: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }) {
    const { data } = await api.post("/auth/register", userData);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },
  async googleLogin(credential: string) {
    const { data } = await api.post("/auth/google", { credential });
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    return data;
  },
  async getProfile() {
    const { data } = await api.get("/auth/profile");
    return data;
  },
  getStoredUser() {
    try {
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

export default authService;
