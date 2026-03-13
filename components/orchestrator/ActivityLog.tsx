"use client";

import { useEffect, useRef } from "react";
import type { ActivityLogEntry } from "@/lib/orchestrator";
import {
  Terminal,
  Bot,
  FolderKanban,
  UserCheck,
  Settings,
  Database,
} from "lucide-react";

interface Props {
  entries: ActivityLogEntry[];
}

function typeIcon(type: ActivityLogEntry["type"]) {
  switch (type) {
    case "agent":
      return <Bot className="w-3.5 h-3.5 text-brand-blue" />;
    case "asana":
      return <FolderKanban className="w-3.5 h-3.5 text-purple-400" />;
    case "human":
      return <UserCheck className="w-3.5 h-3.5 text-amber-400" />;
    case "data":
      return <Database className="w-3.5 h-3.5 text-emerald-400" />;
    default:
      return <Settings className="w-3.5 h-3.5 text-text-muted" />;
  }
}

function typeColor(type: ActivityLogEntry["type"]) {
  switch (type) {
    case "agent":
      return "text-brand-blue";
    case "asana":
      return "text-purple-400";
    case "human":
      return "text-amber-400";
    case "data":
      return "text-emerald-400";
    default:
      return "text-text-muted";
  }
}

export function ActivityLog({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="w-4 h-4 text-text-secondary" />
        <h3 className="text-[13px] md:text-[14px] font-semibold">
          Activity Log
        </h3>
        <span className="text-[11px] text-text-muted ml-auto">
          {entries.length} events
        </span>
      </div>

      <div className="max-h-[280px] overflow-y-auto space-y-1.5 pr-1 font-mono">
        {entries.map((entry) => {
          const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });

          return (
            <div
              key={entry.id}
              className="flex items-start gap-2 text-[11px] leading-relaxed"
            >
              <span className="text-text-muted shrink-0 w-[60px]">{time}</span>
              <span className="shrink-0 mt-0.5">{typeIcon(entry.type)}</span>
              <span className={`font-medium ${typeColor(entry.type)}`}>
                {entry.message}
              </span>
              {entry.detail && (
                <span className="text-text-muted truncate">{entry.detail}</span>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
