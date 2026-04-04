"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { BrandLogoMark, BrandWordmark } from "@/components/BrandLogo";
import {
  ArrowRight, Eye, EyeOff, Loader2,
  Bot, Brain, Zap, Target, BarChart3, GitBranch,
  Shield, Database, Workflow, MapPin, Users, TrendingUp,
  Search, Mail, Cpu, Activity,
} from "lucide-react";

const FEATURES = [
  { icon: Bot, label: "33 AI Agents", desc: "Specialized marketing specialists" },
  { icon: Shield, label: "9 Divisions", desc: "Full operational coverage" },
  { icon: GitBranch, label: "7 Pipelines", desc: "End-to-end automation" },
  { icon: Database, label: "pgvector RAG", desc: "Persistent memory system" },
  { icon: Brain, label: "Multi-LLM", desc: "Claude, GPT-4o, Gemini" },
  { icon: Activity, label: "Observability", desc: "Token tracking & audit" },
];

const DIVISIONS = [
  { name: "Strategy & Intelligence", color: "#2CACE8", agents: "01-02, 19" },
  { name: "Content & Creative", color: "#08AE67", agents: "03-06, 20" },
  { name: "Paid Media Operations", color: "#F59E0B", agents: "07-09" },
  { name: "Organic & Authority", color: "#8B5CF6", agents: "10-12, 21, 23" },
  { name: "Analytics & Optimization", color: "#EF4444", agents: "13-14, 22" },
  { name: "Operations & Infrastructure", color: "#6B7280", agents: "15-18, 24" },
  { name: "Client Success & Revenue", color: "#0EA5E9", agents: "25-27" },
  { name: "Data Engineering", color: "#F97316", agents: "28-30" },
  { name: "Local & Community Growth", color: "#14B8A6", agents: "31-33" },
];

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
    <div className="min-h-screen bg-brand-black flex">
      {/* ── Left: Login Form ── */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center items-center lg:items-start p-6 sm:p-8 lg:p-12 shrink-0">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-10">
          <BrandLogoMark size={42} />
          <BrandWordmark className="text-[18px]" />
        </div>

        {/* Auth Card */}
        <div className="bg-surface-dark-raised rounded-2xl border border-border-dark p-6 sm:p-8 w-full max-w-[420px]">
          <h2 className="text-[20px] sm:text-[22px] font-semibold text-white mb-1 text-center lg:text-left">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-[13px] text-text-muted mb-8 text-center lg:text-left">
            {mode === "login"
              ? "Sign in to your AI Operating System"
              : "Start automating with 33 AI agents"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-[12px] font-medium text-gray-400 mb-1.5">Full Name</label>
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
              <label className="block text-[12px] font-medium text-gray-400 mb-1.5">Email</label>
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
              <label className="block text-[12px] font-medium text-gray-400 mb-1.5">Password</label>
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
              onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
              className="text-[13px] text-text-muted hover:text-brand-blue transition-colors"
            >
              {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-text-muted mt-8 text-center lg:text-left">
          33 Specialized AI Agents &middot; 9 Operational Divisions &middot; Full-Stack Automation
        </p>
      </div>

      {/* ── Right: Brand showcase (hidden on mobile) ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-center p-12 xl:p-16 relative overflow-hidden">
        {/* Giant watermark logo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg width="700" height="700" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-[0.04]">
            <path d="M38 8L12 32L26 32L16 56L52 28L36 28L46 8H38Z" fill="#2CACE8" stroke="#2CACE8" strokeWidth="2" strokeLinejoin="round" />
            <path d="M34 14L14 34L26 34L18 52L48 30L34 30L42 14H34Z" fill="#fff" stroke="#fff" strokeWidth="1" strokeLinejoin="round" />
            <path d="M26 34L18 52L48 30" fill="none" stroke="#2CACE8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        {/* Floating glow */}
        <div className="absolute top-1/4 right-1/4 w-[400px] h-[400px] bg-brand-blue/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/3 left-1/3 w-[300px] h-[300px] bg-brand-green/5 rounded-full blur-[100px]" />

        <div className="relative z-10 max-w-[560px]">
          {/* Headline */}
          <div className="mb-10">
            <h1 className="text-[36px] xl:text-[42px] font-bold text-white leading-tight mb-4">
              The AI Operating System<br />
              <span className="text-brand-blue">for Marketing Teams</span>
            </h1>
            <p className="text-[15px] text-gray-400 leading-relaxed max-w-[480px]">
              33 specialized agents execute real marketing work — SEO audits, campaign launches,
              content production, local SEO tracking, and client reporting — all orchestrated
              autonomously with downloadable deliverables.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-3 gap-3 mb-10">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.06] transition-colors">
                  <Icon className="w-5 h-5 text-brand-blue mb-2" />
                  <p className="text-[13px] font-semibold text-white">{f.label}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{f.desc}</p>
                </div>
              );
            })}
          </div>

          {/* Division list */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-3">9 Operational Divisions</p>
            <div className="flex flex-wrap gap-2">
              {DIVISIONS.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-[11px] text-gray-400 font-medium">{d.name}</span>
                  <span className="text-[9px] text-gray-600 font-mono">{d.agents}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Animated agent dots */}
          <div className="mt-10 flex items-center gap-1.5">
            {Array.from({ length: 33 }, (_, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full transition-all"
                style={{
                  backgroundColor: i < 2 ? "#2CACE8" : i < 7 ? "#08AE67" : i < 10 ? "#F59E0B" : i < 15 ? "#8B5CF6" : i < 18 ? "#EF4444" : i < 24 ? "#6B7280" : i < 27 ? "#0EA5E9" : i < 30 ? "#F97316" : "#14B8A6",
                  opacity: 0.3 + (Math.sin(Date.now() / 1000 + i * 0.5) + 1) * 0.35,
                }}
              />
            ))}
            <span className="text-[10px] text-gray-600 ml-2 font-mono">33 agents ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
