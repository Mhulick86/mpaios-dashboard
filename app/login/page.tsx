"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { BrandLogoMark, BrandWordmark } from "@/components/BrandLogo";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        {/* Brand Header */}
        <div className="flex items-center gap-3 justify-center mb-10">
          <BrandLogoMark size={48} />
          <BrandWordmark className="text-[20px]" />
        </div>

        {/* Auth Card */}
        <div className="bg-surface-dark-raised rounded-2xl border border-border-dark p-8">
          <h2 className="text-[20px] font-semibold text-white mb-1 text-center">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-[13px] text-text-muted text-center mb-8">
            {mode === "login"
              ? "Sign in to your AI Operating System"
              : "Start automating with 24 AI agents"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-surface-dark border border-border-dark rounded-lg px-4 py-3 text-[14px] text-white placeholder-text-muted focus:outline-none focus:border-brand-blue transition-colors"
                  placeholder="Your name"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-[12px] font-medium text-gray-400 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-dark border border-border-dark rounded-lg px-4 py-3 text-[14px] text-white placeholder-text-muted focus:outline-none focus:border-brand-blue transition-colors"
                placeholder="you@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-gray-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface-dark border border-border-dark rounded-lg px-4 py-3 pr-10 text-[14px] text-white placeholder-text-muted focus:outline-none focus:border-brand-blue transition-colors"
                  placeholder="Min 6 characters"
                  minLength={6}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-[13px] text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-blue text-white font-semibold rounded-lg px-4 py-3 text-[14px] hover:bg-brand-blue-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign In" : "Create Account"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              className="text-[13px] text-text-muted hover:text-brand-blue transition-colors"
            >
              {mode === "login"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px] text-text-muted text-center mt-8">
          24 Specialized AI Agents &middot; 6 Operational Divisions &middot; Full-Stack Automation
        </p>
      </div>
    </div>
  );
}
