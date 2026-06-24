import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { formatError } from "@/utils/api";
import { Eye, EyeOff, Sun, Moon, Loader2 } from "lucide-react";
import { isMicrosoftLoginEnabled } from "@/utils/msalConfig";

export default function Login() {
  const { login, loginWithMicrosoft } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [msLoading, setMsLoading] = useState(false);

  // Prefill a previously remembered email
  useEffect(() => {
    const saved = localStorage.getItem("lapis_remembered_email");
    if (saved) { setEmail(saved); setRemember(true); }
  }, []);

  const handleMicrosoftLogin = async () => {
    setError("");
    setMsLoading(true);
    try {
      await loginWithMicrosoft();
      navigate("/dashboard");
    } catch (err) {
      // User cancelled the popup — don't show an error
      if (err?.errorCode === "user_cancelled" || err?.message?.includes("user_cancelled")) return;
      setError(formatError(err));
    } finally {
      setMsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      if (remember) localStorage.setItem("lapis_remembered_email", email);
      else localStorage.removeItem("lapis_remembered_email");
      navigate("/dashboard");
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel – Branding */}
      <div className="hidden lg:block lg:w-1/2 relative overflow-hidden bg-[#030d1f]">
        <img
          src="/login-bg.jpeg"
          alt="Lapis IMS"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
      </div>

      {/* Right Panel – Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        <button
          data-testid="theme-toggle-login"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="absolute top-5 right-5 p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-sm animate-[fadeUp_0.4s_ease-out]">
          {/* Logo above form — white-text variant in dark mode, dark-text on light bg */}
          <div className="flex items-center justify-center mb-8">
            <img
              src={theme === "dark" ? "/logo-light.png" : "/logo.png"}
              alt="Lapis IMS"
              className="h-20 w-auto max-w-full object-contain"
            />
          </div>

          <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-1">Sign in</h2>
          <p className="text-sm text-muted-foreground mb-8">Enter your credentials to access the system</p>

          {error && (
            <div data-testid="login-error" className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
              <input
                data-testid="email-input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  data-testid="password-input"
                  id="password"
                  name="password"
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter password"
                  className="w-full px-3 py-2 pr-10 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
                />
                <button
                  type="button"
                  data-testid="toggle-password"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-input accent-primary cursor-pointer"
                />
                <span className="text-xs text-muted-foreground">Remember my email</span>
              </label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {isMicrosoftLoginEnabled && (
            <div className="mt-4">
              <div className="relative flex items-center justify-center mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <span className="relative px-3 text-xs text-muted-foreground bg-background">or</span>
              </div>
              <button
                type="button"
                onClick={handleMicrosoftLogin}
                disabled={msLoading || loading}
                className="w-full py-2.5 px-4 rounded-md border border-input bg-background text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50 transition-colors flex items-center justify-center gap-2.5"
              >
                {msLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 21 21">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
                  </svg>
                )}
                {msLoading ? "Signing in…" : "Sign in with Microsoft"}
              </button>
            </div>
          )}

          <div className="mt-8 text-center space-y-2">
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
              <a href="mailto:support@lapisims.com" className="hover:text-foreground transition-colors">Support</a>
              <span className="text-border">·</span>
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <span className="text-border">·</span>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
            <p className="text-xs text-muted-foreground">
              Lapis IMS — Integrated Management System v1.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
