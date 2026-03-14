# MPAIOS - Marketing Powered AI Operating System

**Version 1.0 | March 2026**
**Confidential | Marketing Powered LLC**

---

## Overview

MPAIOS is a unified agent architecture designed to run a full-service digital marketing agency with AI agents at the operational core. It deploys **18 specialized AI agents** organized into **5 operational divisions** plus a shared Operations & Infrastructure layer, coordinated by a central LLM orchestrator.

## Architecture

```
                    +---------------------------+
                    |   Central LLM Orchestrator |
                    |      (system.md)           |
                    +---------------------------+
                               |
        +----------+-----------+-----------+----------+----------+
        |          |           |           |          |          |
   Strategy &  Content &   Paid Media  Organic &  Analytics  Operations
   Intelligence Creative   Operations  Authority  & Optim.   & Infra
   (01-02)     (03-06)    (07-09)     (10-12)    (13-14)    (15-18)
```

## Divisions

| Division | Agents | Scope |
|----------|--------|-------|
| Strategy & Intelligence | 01-02 | Competitive research, campaign planning, brand analysis |
| Content & Creative | 03-06 | Authority content, ad creative, landing pages, copywriting |
| Paid Media Operations | 07-09 | Meta, Google, TikTok, LinkedIn, Pinterest, X campaigns |
| Organic & Authority | 10-12 | SEO, organic social, brand sentiment, reputation |
| Analytics & Optimization | 13-14 | Cross-channel reporting, CRO, A/B testing, attribution |
| Operations & Infrastructure | 15-18 | Workflow management, client reporting, budget ops, memory |

## Agent Catalog

| # | Agent | Division |
|---|-------|----------|
| 01 | Competitive Intelligence Analyst | Strategy & Intelligence |
| 02 | Head of Strategy & Campaign Planning | Strategy & Intelligence |
| 03 | Authority Content Strategist | Content & Creative |
| 04 | Authority Copywriter | Content & Creative |
| 05 | Ad Creative Director | Content & Creative |
| 06 | Landing Page Architect | Content & Creative |
| 07 | Meta Ads Performance Manager | Paid Media Operations |
| 08 | Google Ads Performance Manager | Paid Media Operations |
| 09 | Social Media Advertising Specialist | Paid Media Operations |
| 10 | SEO & Organic Growth Manager | Organic & Authority |
| 11 | Social Media Organic Manager | Organic & Authority |
| 12 | Brand Sentiment & Reputation Monitor | Organic & Authority |
| 13 | Campaign Performance Analyst | Analytics & Optimization |
| 14 | Conversion Rate Optimization Specialist | Analytics & Optimization |
| 15 | Workflow Orchestrator & Task Manager | Operations & Infrastructure |
| 16 | Client Reporting & Insights Compiler | Operations & Infrastructure |
| 17 | Budget & Financial Operations Manager | Operations & Infrastructure |
| 18 | System Intelligence & Memory Agent | Operations & Infrastructure |

## Core Pipelines

1. **Full Campaign Launch** - End-to-end from competitive research to live campaigns
2. **Authority Content Engine** - Recurring thought leadership content production
3. **Performance Optimization Cycle** - Weekly campaign analysis and optimization
4. **Competitive Response** - Triggered response to competitor moves

## Directory Structure

```
mpaios/
├── README.md                          # This file
├── system.md                          # Central LLM orchestrator system message
├── config/
│   ├── orchestrator.md                # Orchestration rules, routing, coordination
│   ├── quality-checkpoints.md         # Global quality gates
│   └── pipelines/
│       ├── 01-full-campaign-launch.md
│       ├── 02-authority-content-engine.md
│       ├── 03-performance-optimization-cycle.md
│       └── 04-competitive-response.md
├── agents/
│   ├── division-1-strategy-intelligence/
│   │   ├── agent-01-competitive-intelligence-analyst.md
│   │   └── agent-02-head-of-strategy.md
│   ├── division-2-content-creative/
│   │   ├── agent-03-authority-content-strategist.md
│   │   ├── agent-04-authority-copywriter.md
│   │   ├── agent-05-ad-creative-director.md
│   │   └── agent-06-landing-page-architect.md
│   ├── division-3-paid-media/
│   │   ├── agent-07-meta-ads-manager.md
│   │   ├── agent-08-google-ads-manager.md
│   │   └── agent-09-social-ads-specialist.md
│   ├── division-4-organic-authority/
│   │   ├── agent-10-seo-manager.md
│   │   ├── agent-11-social-media-organic.md
│   │   └── agent-12-brand-sentiment-monitor.md
│   ├── division-5-analytics-optimization/
│   │   ├── agent-13-campaign-performance-analyst.md
│   │   └── agent-14-cro-specialist.md
│   └── division-6-operations-infrastructure/
│       ├── agent-15-workflow-orchestrator.md
│       ├── agent-16-client-reporting-compiler.md
│       ├── agent-17-budget-manager.md
│       └── agent-18-system-intelligence.md
├── memory/                            # Persistent knowledge base (Agent 18)
├── templates/                         # Reusable templates
│   ├── campaign-brief.md
│   ├── client-onboarding.md
│   └── handoff-protocol.md
└── clients/                           # Per-client data and context
```

## Execution Modes

- **Local Execution** - Full privacy compliance on Mac Studio cluster. Best for healthcare, legal, financial services.
- **API Execution** - Routes to Claude Opus 4.6 via Anthropic API. Best for complex strategy and creative work.
- **Hybrid** - Sensitive data local, creative work via API. Recommended default.

## Key Design Principles

- Every agent is defined by a markdown skill file with plain-text instructions
- No custom code required for agent behavior definition
- Agents hand off work sequentially through orchestrated pipelines
- Independent tasks support parallel execution
- All campaigns publish in draft mode for human review before activation
- Git version control provides full audit trail of process changes
