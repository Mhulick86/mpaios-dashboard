"use client";

import Link from "next/link";
import { ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
  connected: boolean;
  projectGid?: string | null;
  projectName?: string | null;
}

export function AsanaBanner({ connected, projectGid, projectName }: Props) {
  if (connected && projectGid) {
    return (
      <div className="flex items-center gap-3 bg-purple-500/10 rounded-xl border border-purple-500/20 px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
        <span className="text-[12px] md:text-[13px] text-purple-300 font-medium flex-1 min-w-0 truncate">
          Syncing to Asana: {projectName ?? projectGid}
        </span>
        <a
          href={`https://app.asana.com/0/${projectGid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] text-purple-400 hover:text-purple-300 font-medium shrink-0 transition-colors"
        >
          Open in Asana <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="flex items-center gap-3 bg-brand-green/10 rounded-xl border border-brand-green/20 px-4 py-3">
        <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" />
        <span className="text-[12px] md:text-[13px] text-brand-green font-medium">
          Asana connected — workflows will sync automatically
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-surface-raised rounded-xl border border-border px-4 py-3">
      <AlertCircle className="w-4 h-4 text-text-muted shrink-0" />
      <span className="text-[12px] md:text-[13px] text-text-secondary flex-1">
        Asana not connected — running in simulation mode
      </span>
      <Link
        href="/integrations"
        className="text-[11px] text-brand-blue hover:underline font-medium shrink-0"
      >
        Connect →
      </Link>
    </div>
  );
}
