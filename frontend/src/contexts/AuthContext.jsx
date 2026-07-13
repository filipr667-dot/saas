import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import api, { tokenStore } from "@/utils/api";
import { getMsalInstance, loginRequest } from "@/utils/msalConfig";

const AuthContext = createContext(null);

// In-memory store for the super-admin's own token (used to restore after impersonation)
let _savedSuperAdminToken = null;

const IDLE_MS = 30 * 60 * 1000;   // 30 min idle before warning
const WARN_MS = 2 * 60 * 1000;    // 2 min warning before auto-logout
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still loading
  const [impersonating, setImpersonating] = useState(null); // { name, id } of impersonated user
  const [sessionWarning, setSessionWarning] = useState(false);
  const idleTimer = useRef(null);
  const warnTimer = useRef(null);

  const checkAuth = useCallback(async () => {
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

  // Idle session timeout
  const doLogout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch {}
    tokenStore.clear();
    _savedSuperAdminToken = null;
    setUser(null);
    setImpersonating(null);
    setSessionWarning(false);
  }, []);

  const resetIdle = useCallback(() => {
    setSessionWarning(false);
    clearTimeout(idleTimer.current);
    clearTimeout(warnTimer.current);
    idleTimer.current = setTimeout(() => {
      setSessionWarning(true);
      warnTimer.current = setTimeout(doLogout, WARN_MS);
    }, IDLE_MS);
  }, [doLogout]);

  useEffect(() => {
    if (!user) {
      clearTimeout(idleTimer.current);
      clearTimeout(warnTimer.current);
      return;
    }
    resetIdle();
    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetIdle, { passive: true }));
    return () => {
      clearTimeout(idleTimer.current);
      clearTimeout(warnTimer.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetIdle));
    };
  }, [user, resetIdle]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    tokenStore.set(data.access_token, data.refresh_token);
    const { access_token, refresh_token, ...userData } = data;
    setUser(userData);
    return userData;
  };

  const loginWithMicrosoft = async () => {
    const msal = await getMsalInstance();
    if (!msal) throw new Error("Microsoft login is not configured");
    const result = await msal.loginPopup(loginRequest);
    const { data } = await api.post("/auth/microsoft", { id_token: result.idToken });
    tokenStore.set(data.access_token, data.refresh_token);
    const { access_token, refresh_token, ...userData } = data;
    setUser(userData);
    return userData;
  };

  const logout = doLogout;

  const stayLoggedIn = () => resetIdle();

  const startImpersonation = (accessToken, targetUser) => {
    // Save the super admin's current token so we can restore it
    _savedSuperAdminToken = tokenStore.getAccess();
    tokenStore.set(accessToken, null);
    setUser(targetUser);
    setImpersonating({ id: targetUser.id, name: targetUser.name });
  };

  const stopImpersonation = async () => {
    if (!_savedSuperAdminToken) return;
    tokenStore.set(_savedSuperAdminToken, null);
    _savedSuperAdminToken = null;
    setImpersonating(null);
    // Re-fetch super admin profile
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      tokenStore.clear();
      setUser(null);
    }
  };

  /** Check if the current user holds any of the given roles (system or doc roles). */
  const hasRole = (...roles) => {
    if (!user) return false;
    const allRoles = [user.role, ...(user.doc_roles || [])].filter(Boolean);
    return roles.some(r => allRoles.includes(r));
  };

  /** Check if the current user has a specific feature module enabled. */
  const hasModule = (module) => {
    if (!user) return false;
    if (user.role === "admin" || user.role === "super_admin") return true;
    return (user.modules || []).includes(module);
  };

  return (
    <AuthContext.Provider value={{
      user, login, loginWithMicrosoft, logout, checkAuth,
      impersonating, startImpersonation, stopImpersonation,
      hasRole, hasModule,
      sessionWarning, stayLoggedIn,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
