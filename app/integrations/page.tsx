"use client";

import {
  Plug,
  Search,
  HardDrive,
  TrendingUp,
  MessageSquare as SlackIcon,
  Users,
} from "lucide-react";

interface IntegrationDescriptor {
  name: string;
  description: string;
  details: string;
  icon: React.ReactNode;
}

const integrations: IntegrationDescriptor[] = [
  {
    name: "Asana",
    description: "Project management — push tasks, read projects, sync workflows",
    details:
      "The orchestrator surfaces Asana projects and tasks during chat. Agent 15 can create tasks and coordinate work.",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-500" fill="currentColor">
        <circle cx="12" cy="6" r="4" />
        <circle cx="6" cy="18" r="4" />
        <circle cx="18" cy="18" r="4" />
      </svg>
    ),
  },
  {
    name: "Google Analytics",
    description: "GA4 performance data, traffic sources, page views & attribution",
    details:
      "The orchestrator pulls GA4 traffic, sessions, top pages, and traffic sources into every chat. Agent 13 can analyze this data in depth.",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-gray-500" fill="currentColor">
        <path d="M22 3.2c0-.66-.54-1.2-1.2-1.2h-1.6c-.66 0-1.2.54-1.2 1.2v17.6c0 .66.54 1.2 1.2 1.2h1.6c.66 0 1.2-.54 1.2-1.2V3.2z" />
        <path d="M15 8.2c0-.66-.54-1.2-1.2-1.2h-1.6c-.66 0-1.2.54-1.2 1.2v12.6c0 .66.54 1.2 1.2 1.2h1.6c.66 0 1.2-.54 1.2-1.2V8.2z" />
        <circle cx="5" cy="19.5" r="2.5" />
      </svg>
    ),
  },
  {
    name: "Google Search Console",
    description: "Search queries, impressions, CTR, rankings & indexing data",
    details:
      "The orchestrator pulls top search queries, CTR, impressions, and ranking data into every chat. Agent 10 (SEO) uses this for keyword analysis and optimization.",
    icon: <Search className="w-6 h-6 text-gray-500" />,
  },
  {
    name: "Google Drive",
    description: "Document discovery, knowledge base ingestion, deliverable export",
    details:
      "The orchestrator can read briefs, content drafts, and SOPs from a configured Drive folder, and writes generated deliverables back to Drive.",
    icon: <HardDrive className="w-6 h-6 text-gray-500" />,
  },
  {
    name: "Ahrefs",
    description: "Backlinks, domain rating, keywords & competitor research",
    details:
      "Agent 10 (SEO) and Agent 23 use Ahrefs to evaluate domain rating, identify ranking opportunities, and track competitor movement.",
    icon: <TrendingUp className="w-6 h-6 text-gray-500" />,
  },
];

const comingSoon = [
  { name: "Slack", desc: "Notifications & team updates", icon: SlackIcon },
  { name: "HubSpot", desc: "CRM & lead management", icon: Users },
];

export default function IntegrationsPage() {
  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6 md:mb-8 gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] md:text-[24px] font-semibold">Integrations</h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            External tools wired into the operating system
          </p>
        </div>
      </div>

      <div className="bg-surface-raised rounded-xl border border-border p-3 md:p-4 mb-6 flex items-center gap-3">
        <Plug className="w-5 h-5 text-brand-blue shrink-0" />
        <div>
          <p className="text-[13px] font-medium">
            Integrations are managed by your administrator
          </p>
          <p className="text-[11px] text-text-muted">
            Reach out to your operations team to enable or disable a connection
          </p>
        </div>
      </div>

      {integrations.map((integration) => (
        <div
          key={integration.name}
          className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 bg-gray-100">
              {integration.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] font-semibold">{integration.name}</h3>
              <p className="text-[12px] text-text-secondary mt-0.5">
                {integration.description}
              </p>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[11px] text-text-muted">
              <span className="font-medium text-text-secondary">How it works:</span> {integration.details}
            </p>
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-6">
        {comingSoon.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.name}
              className="bg-surface-raised rounded-xl border border-border p-5 opacity-50"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-gray-500">{item.name}</h3>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                      Coming Soon
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">{item.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
