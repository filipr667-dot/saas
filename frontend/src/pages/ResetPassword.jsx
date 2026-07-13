import React, { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import api, { formatError } from "@/utils/api";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft, Loader2, CheckCircle, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/logo-light.png" : "/logo.png";
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 10) { setError("Password must be at least 10 characters"); return; }
    if (!/[A-Z]/.test(password)) { setError("Password must contain an uppercase letter"); return; }
    if (!/[a-z]/.test(password)) { setError("Password must contain a lowercase letter"); return; }
    if (!/\d/.test(password)) { setError("Password must contain a number"); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/\\`~"£€]/.test(password)) { setError("Password must contain a special character"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="w-full max-w-sm animate-[fadeUp_0.4s_ease-out]">
        <div className="flex items-center justify-center mb-8">
          <img src={logoSrc} alt="Lapis IMS" className="h-16 w-auto object-contain" />
        </div>

        {!token ? (
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground tracking-tight mb-2">Invalid reset link</h2>
            <p className="text-sm text-muted-foreground mb-8">This link is missing its token. Please request a new password reset.</p>
            <Link to="/forgot-password" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight mb-2">Password reset</h2>
            <p className="text-sm text-muted-foreground mb-8">Your password has been updated. Redirecting you to sign in…</p>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" /> Go to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-1">Set a new password</h2>
            <p className="text-sm text-muted-foreground mb-8">Choose a new password for your account.</p>

            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    name="new-password"
                    type={showPass ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="At least 10 characters"
                    className="w-full px-3 py-2 pr-10 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Min 10 chars · uppercase · lowercase · number · special character
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Confirm Password</label>
                <input
                  name="confirm-password"
                  type={showPass ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Re-enter password"
                  className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-ring transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Updating…" : "Reset password"}
              </button>
            </form>

            <div className="mt-8 text-center">
              <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
