import React, { useState } from "react";
import { Link } from "react-router-dom";
import api, { formatError } from "@/utils/api";
import { useTheme } from "@/contexts/ThemeContext";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? "/logo-light.png" : "/logo.png";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
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

        {sent ? (
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                <MailCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-foreground tracking-tight mb-2">Check your email</h2>
            <p className="text-sm text-muted-foreground mb-8">
              If an account exists for <span className="text-foreground font-medium">{email}</span>, we've sent a link to reset your password. The link expires in 60 minutes.
            </p>
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" /> Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-foreground tracking-tight mb-1">Forgot password?</h2>
            <p className="text-sm text-muted-foreground mb-8">Enter your email and we'll send you a reset link.</p>

            {error && (
              <div className="mb-4 px-3 py-2.5 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email Address</label>
                <input
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? "Sending…" : "Send reset link"}
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
