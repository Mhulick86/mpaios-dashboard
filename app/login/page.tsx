"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandLogoMark, BrandWordmark } from "@/components/BrandLogo";
import { ALLOWED_EMAIL_DOMAIN } from "@/lib/access";
import {
  Bot, Brain, GitBranch, Shield, Database, Activity, Lock, AlertCircle,
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

const AGENT_COLORS = Array.from({ length: 33 }, (_, i) =>
  i < 2 ? "#2CACE8" : i < 7 ? "#08AE67" : i < 10 ? "#F59E0B" : i < 15 ? "#8B5CF6" : i < 18 ? "#EF4444" : i < 24 ? "#6B7280" : i < 27 ? "#0EA5E9" : i < 30 ? "#F97316" : "#14B8A6"
);

const ERROR_MESSAGES: Record<string, string> = {
  domain: `Use your @${ALLOWED_EMAIL_DOMAIN} Google account. Personal Gmail and other domains are not permitted.`,
  auth: "Google sign-in could not be completed. Please try again.",
};

/** Only allow same-origin relative paths as a post-login destination. */
function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/login") || value.startsWith("/auth/")) return null;
  return value;
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [next, setNext] = useState<string | null>(null);

  // Read ?next= and ?error= on the client (avoids a Suspense boundary for useSearchParams).
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      setNext(sanitizeNext(params.get("next")));
      const code = params.get("error");
      if (code) setError(ERROR_MESSAGES[code] || "Sign-in failed. Please try again.");
    } catch {
      // ignore
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      const redirectTo =
        `${window.location.origin}/auth/callback` +
        (next ? `?next=${encodeURIComponent(next)}` : "");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            hd: ALLOWED_EMAIL_DOMAIN,
            prompt: "select_account",
            access_type: "online",
          },
        },
      });
      if (error) throw error;
      // On success Supabase redirects the whole window away.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black flex">
      {/* ── Left: Sign-in ── */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center items-center lg:items-start p-6 sm:p-8 lg:p-12 shrink-0">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-10">
          <BrandLogoMark size={42} />
          <BrandWordmark className="text-[18px]" />
        </div>

        {/* Auth Card */}
        <div className="bg-surface-dark-raised rounded-2xl border border-border-dark p-6 sm:p-8 w-full max-w-[420px]">
          <h2 className="text-[20px] sm:text-[22px] font-semibold text-white mb-1 text-center lg:text-left">
            Welcome back
          </h2>
          <p className="text-[13px] text-text-muted mb-8 text-center lg:text-left">
            Sign in to your AI Operating System
          </p>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-[13px] text-red-400 mb-5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google sign-in — the only option */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white text-black font-semibold rounded-lg px-4 py-3 text-[14px] hover:bg-gray-100 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
            </svg>
            {loading ? "Connecting…" : "Continue with Google"}
          </button>

          <div className="mt-6 flex items-start gap-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06] px-4 py-3">
            <Lock className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
            <p className="text-[12px] text-text-muted leading-relaxed">
              Access is limited to Marketing Powered staff. Sign in with your{" "}
              <span className="text-gray-300 font-medium">@{ALLOWED_EMAIL_DOMAIN}</span> Google
              Workspace account. There is no separate password.
            </p>
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

          {/* Agent dots */}
          <div className="mt-10 flex items-center gap-1.5">
            {AGENT_COLORS.map((color, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: color, opacity: 0.35 + ((i * 7) % 10) / 20 }}
              />
            ))}
            <span className="text-[10px] text-gray-600 ml-2 font-mono">33 agents ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
