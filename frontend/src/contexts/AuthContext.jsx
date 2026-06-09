import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api, { tokenStore } from "@/utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading

  const checkAuth = useCallback(async () => {
    // If this tab has no token, user is not logged in for this tab
    if (!tokenStore.getAccess()) {
      setUser(null);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    // Save tokens to THIS tab's sessionStorage only
    tokenStore.set(data.access_token, data.refresh_token);
    const { access_token, refresh_token, ...userData } = data;
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
