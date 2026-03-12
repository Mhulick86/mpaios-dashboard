"use client";

import { useState } from "react";
import type { Agent } from "@/lib/agents";
import { divisions } from "@/lib/agents";
import { StatusBadge } from "./StatusBadge";
import { ChevronDown, ChevronUp, Wrench } from "lucide-react";

export function AgentCard({ agent }: { agent: Agent }) {
  const [expanded, setExpanded] = useState(false);
  const division = divisions.find((d) => d.id === agent.divisionId);
  const divColor = division?.color || "#2CACE8";

  return (
    <div className="bg-surface-raised rounded-xl border border-border hover:border-gray-300 transition-all group">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[13px] font-bold text-white shrink-0"
              style={{ backgroundColor: divColor }}
            >
              {String(agent.id).padStart(2, "0")}
            </div>
            <div>
              <h3 className="text-[13px] font-semibold leading-tight">
                {agent.shortName}
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                Agent {String(agent.id).padStart(2, "0")}
              </p>
            </div>
          </div>
          <StatusBadge status={agent.status} />
        </div>

        {/* Description */}
        <p className="text-[12px] text-text-secondary leading-relaxed line-clamp-2">
          {agent.description}
        </p>

        {/* Capabilities Preview */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-text-secondary"
            >
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-text-muted">
              +{agent.capabilities.length - 3} more
            </span>
          )}
        </div>

        {/* Expand/Collapse */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1 text-[11px] font-medium text-brand-blue hover:text-brand-blue-dark transition-colors"
        >
          {expanded ? (
            <>
              Hide details <ChevronUp className="w-3 h-3" />
            </>
          ) : (
            <>
              Show details <ChevronDown className="w-3 h-3" />
            </>
          )}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
          <div>
            <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
              All Capabilities
            </h4>
            <ul className="space-y-1">
              {agent.capabilities.map((cap) => (
                <li key={cap} className="text-[12px] text-text-secondary flex items-start gap-1.5">
                  <span className="text-brand-blue mt-0.5">-</span>
                  {cap}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Wrench className="w-3 h-3" /> Tooling
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {agent.tooling.map((tool) => (
                <span
                  key={tool}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-brand-blue/20 text-brand-blue bg-brand-blue/5"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
