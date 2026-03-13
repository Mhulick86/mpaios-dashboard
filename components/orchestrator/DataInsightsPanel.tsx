"use client";

import { useState } from "react";
import type { InsightData } from "@/lib/orchestrator";
import {
  BarChart3,
  Search,
  ChevronDown,
  ChevronUp,
  Database,
} from "lucide-react";

interface Props {
  insights: InsightData;
}

function MarkdownSection({
  title,
  icon: Icon,
  content,
  accent,
}: {
  title: string;
  icon: React.ElementType;
  content: string;
  accent: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Show first ~600 chars collapsed, full when expanded
  const preview = content.length > 600 ? content.slice(0, 600) + "…" : content;
  const isLong = content.length > 600;

  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-surface-raised/50 transition-colors text-left"
      >
        <Icon className={`w-4 h-4 ${accent} shrink-0`} />
        <span className="text-[12px] md:text-[13px] font-semibold flex-1">
          {title}
        </span>
        {isLong && (
          expanded ? (
            <ChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          )
        )}
      </button>
      <div className="px-4 pb-3">
        <pre className="text-[10px] md:text-[11px] text-text-secondary leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto max-h-[260px] md:max-h-[400px] overflow-y-auto">
          {expanded || !isLong ? content : preview}
        </pre>
        {isLong && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className={`mt-2 text-[10px] font-medium ${accent} hover:underline`}
          >
            Show full data →
          </button>
        )}
      </div>
    </div>
  );
}

export function DataInsightsPanel({ insights }: Props) {
  if (!insights.gaOverview && !insights.gscOverview) return null;

  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
      <div className="flex items-center gap-2 mb-4">
        <Database className="w-4 h-4 text-brand-blue" />
        <h3 className="text-[13px] md:text-[14px] font-semibold">
          Live Integration Data
        </h3>
        <span className="text-[10px] text-text-muted ml-auto">
          Pulled during workflow execution
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {insights.gaOverview && (
          <MarkdownSection
            title="Google Analytics (GA4)"
            icon={BarChart3}
            content={insights.gaOverview}
            accent="text-brand-blue"
          />
        )}
        {insights.gscOverview && (
          <MarkdownSection
            title="Google Search Console"
            icon={Search}
            content={insights.gscOverview}
            accent="text-brand-green"
          />
        )}
      </div>
    </div>
  );
}
