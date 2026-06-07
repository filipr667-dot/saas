import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { formatError } from "@/utils/api";
import { Eye, EyeOff, Sun, Moon, Shield } from "lucide-react";

const LIGHT_IMG = "https://static.prod-images.emergentagent.com/jobs/2dcdf7e2-f96f-4d31-9f03-6c1328bbeb64/images/60bc6f63926b55cdbcaf91d5496931d30b896937984d8cdee427aae361dd7656.png";
const DARK_IMG = "https://static.prod-images.emergentagent.com/jobs/2dcdf7e2-f96f-4d31-9f03-6c1328bbeb64/images/5e2d64dfd747a1f304d4ad91205c5e6214590bb268b20d9517b1f2623b57bb5e.png";

export default function Login() {
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
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
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <img
          src={theme === "dark" ? DARK_IMG : LIGHT_IMG}
          alt="Document Control"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/80 via-zinc-900/50 to-transparent" />
        <div className="relative z-10 flex flex-col justify-end p-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-zinc-900" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg leading-none">DocControl</p>
              <p className="text-white/60 text-sm">QMS Foundation</p>
            </div>
          </div>
          <h1 className="text-4xl font-semibold text-white tracking-tight leading-tight mb-3">
            Enterprise Document<br />Control System
          </h1>
          <p className="text-white/70 text-base max-w-sm">
            Full lifecycle management for ISO-compliant document control, review workflows, and audit traceability.
          </p>
          <div className="flex gap-6 mt-8">
            {["ISO 9001 Ready", "Audit Trail", "e-Signatures"].map((tag) => (
              <span key={tag} className="text-xs text-white/50 border border-white/20 rounded-full px-3 py-1">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel – Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
        <button
          data-testid="theme-toggle-login"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="absolute top-5 right-5 p-2 rounded-md text-muted-foreground hover:bg-muted transition-colors"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">DocControl QMS</span>
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
                type="email"
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
                  type={showPass ? "text" : "password"}
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

            <button
              data-testid="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-xs text-center text-muted-foreground">
            Document Control Management System v1.0
          </p>
        </div>
      </div>
    </div>
  );
}
