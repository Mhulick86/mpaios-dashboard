"use client";

import { useState } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";

interface Props {
  onSubmit: (prompt: string) => void;
  disabled: boolean;
  phase: string;
}

const PLACEHOLDERS = [
  "Launch a full campaign for a new SaaS client…",
  "Onboard a new e-commerce client with competitor analysis…",
  "Run a weekly performance optimization cycle…",
  "Audit our AI search visibility across ChatGPT & Perplexity…",
  "Build an email nurture sequence for our latest lead magnet…",
];

export function RequestInputBar({ onSubmit, disabled, phase }: Props) {
  const [value, setValue] = useState("");
  const [placeholder] = useState(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)]
  );

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue("");
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border p-3 md:p-4 focus-within:border-brand-blue/40 transition-colors">
        <Sparkles className="w-5 h-5 text-brand-blue shrink-0" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent text-[13px] md:text-[14px] text-text-primary placeholder:text-text-muted outline-none disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-blue text-white text-[12px] md:text-[13px] font-semibold hover:bg-brand-blue/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
        >
          {disabled ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline capitalize">{phase}…</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Launch</span>
            </>
          )}
        </button>
      </div>
      <p className="text-[11px] text-text-muted mt-2 ml-1">
        Describe a marketing task — Agent 15 (Workflow Orchestrator) will select
        the right pipeline, build a plan, and coordinate your agent swarm.
      </p>
    </div>
  );
}
