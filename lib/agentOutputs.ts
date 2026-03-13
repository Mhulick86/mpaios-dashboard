/**
 * Generates realistic simulated work-output for each agent step.
 * When real integration data (GA4/GSC) is available, it's woven
 * into the output. Otherwise we produce plausible demo text.
 */

import type { InsightData } from "./orchestrator";

/* ─── Types ─── */

interface OutputContext {
  agentId: number;
  agentName: string;
  agentShortName: string;
  action: string;
  stepIndex: number;
  totalSteps: number;
  pipelineName: string;
  insights: InsightData;
}

/* ─── Helpers ─── */

const today = () =>
  new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const pct = () => (Math.random() * 30 + 5).toFixed(1);
const cpa = () => `$${(Math.random() * 40 + 8).toFixed(2)}`;
const roas = () => (Math.random() * 3 + 1.2).toFixed(1);
const ctr = () => (Math.random() * 4 + 0.8).toFixed(2);
const cvr = () => (Math.random() * 6 + 1.5).toFixed(1);
const imp = () => `${(Math.random() * 80 + 10).toFixed(0)}K`;
const budget = () => `$${(Math.random() * 5000 + 1000).toFixed(0)}`;

/* ─── Agent-specific output generators ─── */

const generators: Record<number, (c: OutputContext) => string> = {
  /* 1 — Competitive Intelligence Analyst */
  1: (c) => `# Competitive Intelligence Report
Generated: ${today()}

## Competitor Landscape Summary
Analyzed 5 key competitors across paid channels, organic presence, and positioning.

### Top Findings
• Competitor A is running 12 active Meta ad sets targeting lookalike audiences — avg CTR ${ctr()}%
• Competitor B recently launched a new landing page with quiz funnel — estimated conversion lift 15-20%
• Competitor C increased Google Ads spend by ~${pct()}% this month — aggressive keyword bidding on branded terms
• Gap identified: No competitors are running YouTube Shorts ads — opportunity for first-mover advantage

### Competitive Ad Creative Themes
1. Social proof / testimonials (40% of competitor creatives)
2. Before/after transformations (25%)
3. Limited-time offers with urgency (20%)
4. Educational / value-first content (15%)

### Recommended Response
→ Priority: Counter Competitor A's lookalike strategy with custom audience segments
→ Opportunity: Launch YouTube Shorts campaign before competitors enter the channel
→ Creative: Test UGC-style testimonial ads to match market trend

### Tools Used
🔧 **Competitor Ad Monitor** — Cross-platform ad surveillance across Meta, Google, TikTok, LinkedIn
🔧 **Browser Automation** — Automated screenshot capture of competitor landing pages
🔧 **Gemini Vision API** — Visual analysis of competitor creative patterns

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 2 — Head of Strategy */
  2: (c) => `# Campaign Strategy Proposal
Generated: ${today()}

## Multi-Channel Campaign Architecture

### Campaign Objectives
• Primary: Drive qualified leads at target CPA of ${cpa()}
• Secondary: Build brand awareness (reach ${imp()} impressions/month)
• Tertiary: Grow organic pipeline for long-term cost reduction

### Channel Allocation
| Channel | Budget | Role | Target KPI |
|---------|--------|------|------------|
| Meta Ads | ${budget()} | Lead gen + retargeting | CPA < $25 |
| Google Search | ${budget()} | High-intent capture | ROAS > ${roas()}x |
| LinkedIn | ${budget()} | B2B decision-makers | CPL < $45 |
| Content/SEO | ${budget()} | Authority building | +${pct()}% organic traffic |

### Audience Strategy
• TOFU: Broad interest + lookalike audiences (awareness)
• MOFU: Website visitors + content engagers (consideration)
• BOFU: High-intent searchers + cart abandoners (conversion)

### Creative Brief Summary
→ 3 ad concepts per channel (9 total)
→ 2 landing page variants for A/B testing
→ 1 lead magnet / quiz funnel

### Tools Used
🔧 **UTM Campaign Tracker** — Generated tagged URLs for unified attribution across all channels
🔧 **Budget Pacing Optimizer** — Modeled budget scenarios and cross-channel allocation
🔧 **Campaign Planning Templates** — Structured multi-channel brief generation

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 3 — Authority Content Strategist */
  3: (c) => `# Content Strategy & Editorial Plan
Generated: ${today()}

## High-Opportunity Topics Identified
Analyzed keyword gaps, competitor content, and industry trends.

### Priority Content Pillars
1. **Industry Authority Piece** — "The Complete Guide to [Industry Topic] in 2026"
   - Search volume: 2,400/mo | KD: 35 | Current rank: None
   - Format: 3,500-word pillar page with infographics

2. **Thought Leadership** — "Why Most [Industry] Strategies Fail (And What Works Instead)"
   - Search volume: 1,100/mo | KD: 28 | Current rank: Page 3
   - Format: 2,000-word opinion piece + LinkedIn article

3. **How-To Guide** — "Step-by-Step: [Specific Process] for [Target Audience]"
   - Search volume: 890/mo | KD: 22 | Current rank: None
   - Format: 2,500-word tutorial with screenshots

### Content Calendar (Next 4 Weeks)
| Week | Content Type | Topic | Target Keywords |
|------|-------------|-------|----------------|
| 1 | Pillar Page | Industry guide | 8 primary + 15 secondary |
| 2 | Blog Post | Thought leadership | 5 primary + 10 secondary |
| 3 | How-To Guide | Tutorial piece | 6 primary + 12 secondary |
| 4 | Case Study | Client success story | 4 primary + 8 secondary |

### E-E-A-T Recommendations
→ Add author bios with credentials to all content
→ Include original research/data points
→ Build internal linking structure between pillar + cluster content

### Tools Used
🔧 **GSC Performance Monitor** — Surfaced ranking decline alerts and keyword gap data
🔧 **AI Search Visibility (LLMO)** — Identified content gaps where competitors are cited in AI answers
🔧 **AHREFS API / Semrush API** — Keyword difficulty scoring and competitive content analysis

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 4 — Authority Copywriter */
  4: (c) => `# Copy Production — Deliverables Complete
Generated: ${today()}

## Delivered Assets

### Landing Page Copy
✅ Headline: Tested 5 variants — selected highest-scoring option
✅ Hero section: Problem-agitate-solve framework
✅ Social proof section: 3 testimonials + trust badges
✅ CTA sections: Primary + 2 secondary CTAs
✅ FAQ section: 8 objection-handling questions
→ Word count: 1,850 words | Readability: Grade 8 | Flesch: 62

### Ad Copy Variations
✅ Meta Ads: 6 primary text variants + 3 headline variants
✅ Google Ads: 15 responsive search ad combinations
✅ LinkedIn: 4 sponsored content posts

### Email Sequence
✅ Welcome email (subject line A/B: 2 variants)
✅ Nurture email #1 — Value-first educational content
✅ Nurture email #2 — Social proof + case study
✅ Nurture email #3 — Offer + urgency CTA
→ Avg word count per email: 280 words | All CAN-SPAM compliant

### Quality Checks
• Plagiarism scan: ✅ 100% original
• Brand voice alignment: ✅ Matches style guide
• Grammar/spelling: ✅ Zero issues detected

### Tools Used
🔧 **Blog Brand Voice Writer** — Matched client brand voice profile across all long-form copy
🔧 **Email Nurture Automator** — Generated multi-step email sequences with A/B subject variants
🔧 **Readability Analysis** — Flesch-Kincaid and grade-level optimization

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 5 — Ad Creative Director */
  5: (c) => `# Creative Production Report
Generated: ${today()}

## Ad Creative Assets Produced

### Image Ads (Static)
✅ 3 concepts × 3 sizes (1080×1080, 1200×628, 1080×1920)
- Concept A: Social proof / testimonial overlay
- Concept B: Before/after comparison
- Concept C: Bold statistic + CTA
→ Total: 9 image assets ready for platform upload

### Video Scripts
✅ 15-second hook ad — UGC-style testimonial
✅ 30-second explainer — problem → solution → CTA
✅ 60-second brand story — documentary style
→ All scripts include B-roll direction + text overlay cues

### Carousel Ads
✅ 5-card carousel: Feature walkthrough
✅ 4-card carousel: Customer journey story
→ Designed for Meta + LinkedIn formats

### Creative Testing Matrix
| Concept | Format | Audience | Priority |
|---------|--------|----------|----------|
| Social Proof | Static + Video | Cold (TOFU) | High |
| Before/After | Carousel | Warm (MOFU) | High |
| Bold Stat | Static | Retargeting | Medium |

### Performance Predictions
Based on historical creative benchmarks:
→ Expected CTR range: ${ctr()}% - ${(parseFloat(ctr()) + 1.2).toFixed(2)}%
→ Recommended: Start with Concept A (social proof), scale winners after 72hrs

### Tools Used
🔧 **Social Content Amplifier** — Adapted long-form assets into platform-optimized social creatives
🔧 **IG Reels Generator** — Generated trending audio/format suggestions for short-form video
🔧 **Gemini API** — AI-powered image generation and visual concept exploration

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 6 — Landing Page Architect */
  6: (c) => `# Landing Page Build Report
Generated: ${today()}

## Pages Delivered

### Primary Landing Page
✅ Responsive HTML/CSS build — mobile-first design
✅ Hero section with dynamic headline testing
✅ 5-section layout: Hero → Problem → Solution → Social Proof → CTA
✅ Form integration: Name, Email, Phone (3-field for low friction)
✅ Page speed: 92/100 mobile, 97/100 desktop (Lighthouse)

### Quiz Funnel
✅ 5-question qualification quiz
✅ Branching logic: 3 result paths based on answers
✅ Lead capture gate between results
✅ Personalized results page per segment
→ Expected completion rate: 65-75% (industry avg: 55%)

### Technical Implementation
• Tracking: GTM container with custom events for each step
• Pixels: Meta Pixel + Google Ads conversion tag installed
• A/B Testing: Split test infrastructure ready (50/50 traffic split)
• Mobile: Fully responsive — tested on iOS Safari, Chrome Android

### Conversion Optimization Elements
→ Exit-intent popup with secondary offer
→ Sticky CTA bar on mobile (appears after 30% scroll)
→ Micro-animations on form focus (reduces abandonment)
→ Trust badges positioned above-fold

### Tools Used
🔧 **CRO A/B Test Engine** — Generated test hypotheses from heatmap and scroll depth analysis
🔧 **Frontend Frameworks** — Responsive build with GTM event tracking integration
🔧 **Browser Preview** — Cross-device rendering validation

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 7 — Meta Ads Manager */
  7: (c) => `# Campaign Deployment Report — Ads Manager
Generated: ${today()}

## Campaigns Created (Draft Mode)

### Campaign 1: Lead Generation — Cold Audiences
• Objective: Lead Generation
• Budget: ${budget()}/day | Bid Strategy: Lowest Cost
• Audiences: 4 ad sets
  - Interest-based (broad)
  - Lookalike 1% (website visitors)
  - Lookalike 2% (converters)
  - Interest stack (competitor interests)
• Creatives: 3 ads per ad set (12 total)
→ Status: DRAFT — awaiting human approval

### Campaign 2: Retargeting — Warm Audiences
• Objective: Conversions
• Budget: ${budget()}/day | Bid Strategy: Cost Cap ${cpa()}
• Audiences: 3 ad sets
  - Website visitors (7-day)
  - Website visitors (30-day, excl 7-day)
  - Video viewers (75%+ completion)
• Creatives: 2 ads per ad set (6 total)
→ Status: DRAFT — awaiting human approval

### Tracking Verification
✅ Meta Pixel: Firing on all key events (PageView, Lead, Purchase)
✅ Conversions API: Server-side events configured
✅ UTM Parameters: Applied to all destination URLs
✅ Custom audiences: Synced and ready

### Estimated Performance (First 7 Days)
→ Impressions: ${imp()} | CTR: ${ctr()}% | CPA: ${cpa()} | ROAS: ${roas()}x

### Tools Used
🔧 **GTM Ad Bidding Engine** — Real-time bid optimization across campaign and ad set level
🔧 **Competitor Ad Monitor** — Cross-referenced competitor creatives to differentiate positioning
🔧 **Meta Marketing API** — Campaign creation, audience sync, and conversion tracking

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 8 — Google Ads Manager */
  8: (c) => `# Google Ads Campaign Deployment
Generated: ${today()}

## Campaigns Created (Draft)

### Search Campaign — High-Intent Keywords
• Match types: Exact + Phrase
• Ad groups: 5 (themed by keyword cluster)
• Keywords: 45 targeted | 120 negatives applied
• RSAs: 3 per ad group (15 total)
→ Est. daily budget: ${budget()} | Target CPA: ${cpa()}

### Performance Max Campaign
• Asset groups: 3
• Audience signals: Customer list + in-market + custom intent
• Assets: Headlines (15), descriptions (5), images (9), videos (2)
→ Est. daily budget: ${budget()}

### Conversion Tracking
✅ Google Ads tag: Active on all conversion pages
✅ Enhanced conversions: Configured with hashed email
✅ Offline conversion import: Template ready

### Tools Used
🔧 **GTM Ad Bidding Engine** — Automated bid strategy selection and budget allocation
🔧 **Budget Pacing Optimizer** — Daily spend monitoring with auto-adjustment alerts
🔧 **Google Ads API** — Programmatic campaign creation and keyword management

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 9 — Social Ads Specialist */
  9: (c) => `# Social Advertising Deployment
Generated: ${today()}

## Platform Campaigns (Draft Mode)

### LinkedIn Campaign Manager
• Campaign type: Sponsored Content (Lead Gen Form)
• Targeting: Job title + industry + company size
• Budget: ${budget()}/day
• Creatives: 4 single-image ads
→ Est. CPL: $35-$55 | Est. CTR: ${ctr()}%

### TikTok Ads
• Campaign type: Traffic + Conversions
• Targeting: Interest + behavior + custom audience
• Budget: ${budget()}/day
• Creatives: 2 Spark Ads + 1 original video
→ Est. CPM: $8-$14

→ All campaigns in DRAFT — awaiting review

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 10 — SEO Manager */
  10: (c) => {
    const gscBlock = c.insights.gscOverview
      ? `\n\n## Live Google Search Console Data\n${c.insights.gscOverview.slice(0, 3000)}`
      : "";
    return `# SEO Optimization Report
Generated: ${today()}
${gscBlock}

## On-Page Optimization Actions

### Technical SEO
✅ Meta titles optimized (all under 60 chars, keywords front-loaded)
✅ Meta descriptions updated (all 150-160 chars with CTAs)
✅ H1-H3 hierarchy validated across 12 key pages
✅ Schema markup: FAQ, HowTo, Organization, LocalBusiness added
✅ Internal linking: 25 new contextual links added
✅ Image alt tags: 40 images updated with descriptive alt text

### Core Web Vitals
• LCP: 1.8s → 1.3s (improved ${pct()}%)
• FID: 45ms → 28ms (improved 38%)
• CLS: 0.12 → 0.05 (improved 58%)

### Keyword Ranking Movements
| Keyword | Previous | Current | Change |
|---------|----------|---------|--------|
| Primary keyword 1 | #14 | #8 | ↑6 |
| Primary keyword 2 | #22 | #15 | ↑7 |
| Primary keyword 3 | #31 | #19 | ↑12 |
| Long-tail keyword 1 | #45 | #11 | ↑34 |

### Backlink Opportunities Identified
→ 8 guest post prospects (DA 40+)
→ 3 broken link reclamation opportunities
→ 2 unlinked brand mentions to convert

### Tools Used
🔧 **GSC Performance Monitor** — Automated ranking change detection and keyword movement alerts
🔧 **WordPress Auto-Tagger** — Auto-categorized and internally linked 12 optimized pages
🔧 **SEO Content Machine** — Generated SEO briefs with entity and NLP scoring
🔧 **AHREFS API / Screaming Frog** — Technical audit and backlink opportunity discovery

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`;
  },

  /* 11 — Social Organic Manager */
  11: (c) => `# Organic Social Content Plan
Generated: ${today()}

## Social Calendar — Next 2 Weeks

### Content Mix
| Day | Platform | Type | Topic | Status |
|-----|----------|------|-------|--------|
| Mon | LinkedIn | Carousel | Industry insight | ✅ Drafted |
| Tue | Instagram | Reel | Behind-the-scenes | ✅ Scripted |
| Wed | Twitter/X | Thread | Data-driven take | ✅ Drafted |
| Thu | LinkedIn | Article | Thought leadership | ✅ Drafted |
| Fri | Instagram | Story | Client spotlight | ✅ Drafted |

### Engagement Strategy
→ Community response protocol: All comments within 2 hours
→ Hashtag strategy: 5 primary + 10 niche per platform
→ Cross-posting: LinkedIn → Twitter derivative content
→ Repurposing: Blog → carousel → reel → thread

### Projected Performance
→ LinkedIn: +${pct()}% impressions vs last month
→ Instagram: +${pct()}% reach via Reels push
→ Twitter/X: Target ${imp()} impressions on threads

### Tools Used
🔧 **Social Content Amplifier** — Transformed authority content into platform-optimized social posts
🔧 **Instagram Trend Engine** — Monitored trending audio and hashtags for Reels strategy
🔧 **Content Calendars** — Automated scheduling across LinkedIn, Instagram, Twitter/X

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 12 — Brand Monitor */
  12: (c) => `# Brand Sentiment & Reputation Report
Generated: ${today()}

## Sentiment Overview
• Overall sentiment: 78% positive | 15% neutral | 7% negative
• Trend: ↑${pct()}% improvement vs prior month
• Total mentions tracked: 340 across all platforms

## Key Findings
### Positive Signals
✅ 12 new 5-star Google reviews this week
✅ 3 organic social mentions from industry influencers
✅ Client NPS score holding at 72

### Attention Items
⚠️ 1 negative review on Google — response drafted (awaiting approval)
⚠️ Reddit thread discussing pricing — monitoring, no action needed

### Competitor Sentiment Comparison
| Brand | Positive | Neutral | Negative |
|-------|----------|---------|----------|
| Our client | 78% | 15% | 7% |
| Competitor A | 65% | 22% | 13% |
| Competitor B | 71% | 18% | 11% |

→ No crisis indicators detected. Next report: 7 days.

### Tools Used
🔧 **Brand Mention Radar** — Real-time brand mention tracking across web, social, and review sites
🔧 **Sentiment & Feedback Analyzer** — NLP-powered sentiment scoring from multi-source review data
🔧 **Google NLP API** — Entity and sentiment extraction from unstructured mentions

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 13 — Campaign Performance Analyst */
  13: (c) => {
    const gaBlock = c.insights.gaOverview
      ? `\n\n## Live Google Analytics Data\n${c.insights.gaOverview.slice(0, 3000)}`
      : "";
    return `# Cross-Channel Performance Dashboard
Generated: ${today()}
${gaBlock}

## KPI Summary (Last 7 Days)

| Metric | Value | vs Prior Period | Target |
|--------|-------|-----------------|--------|
| Total Spend | ${budget()} | +${pct()}% | On pace |
| Impressions | ${imp()} | +${pct()}% | Above target |
| CTR | ${ctr()}% | +0.3pp | Meeting target |
| CPA | ${cpa()} | -${pct()}% | Below target ✅ |
| ROAS | ${roas()}x | +0.4x | Above target ✅ |
| Conversions | ${(Math.random() * 100 + 20).toFixed(0)} | +${pct()}% | On pace |

## Channel Breakdown
### Meta Ads
→ Spend: ${budget()} | ROAS: ${roas()}x | CPA: ${cpa()} | CTR: ${ctr()}%
→ Top performer: Social proof carousel (${ctr()}% CTR)

### Google Ads
→ Spend: ${budget()} | ROAS: ${roas()}x | CPA: ${cpa()} | CTR: ${ctr()}%
→ Top performer: Exact match branded terms (${roas()}x ROAS)

### LinkedIn
→ Spend: ${budget()} | CPL: $${(Math.random() * 30 + 20).toFixed(2)} | CTR: ${ctr()}%
→ Top performer: Decision-maker targeting ad set

## Underperformers Flagged
⚠️ Google Display campaign: CPA ${cpa()} (2x above target) → recommend pause
⚠️ Meta broad interest ad set: CTR 0.4% → recommend refresh creative

## Optimization Recommendations
1. Shift 15% budget from Display → Search (higher ROAS)
2. Refresh Meta creative for broad interest audience
3. Scale LinkedIn campaign +20% (below CPA target)

### Tools Used
🔧 **GA4 Weekly AI Report** — Pulled GA4 data via API, generated AI-powered trend analysis
🔧 **UTM Campaign Tracker** — Unified attribution across all campaign URLs
🔧 **Budget Pacing Optimizer** — Flagged overspend on Display, recommended reallocation

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`;
  },

  /* 14 — CRO Specialist */
  14: (c) => `# Conversion Rate Optimization Report
Generated: ${today()}

## Funnel Analysis

### Current Conversion Funnel
| Stage | Visitors | CVR | Drop-off |
|-------|----------|-----|----------|
| Landing Page | ${imp()} | 100% | — |
| Form Start | ${(Math.random() * 40 + 20).toFixed(0)}% | ${cvr()}% | ${pct()}% |
| Form Complete | ${(Math.random() * 20 + 8).toFixed(0)}% | ${cvr()}% | ${pct()}% |
| Thank You Page | ${(Math.random() * 15 + 5).toFixed(0)}% | — | — |

### Key Findings from Heatmap Analysis
→ 62% of mobile users never scroll past the hero section
→ Form field 3 (phone number) causes 28% abandonment
→ CTA button has low contrast on mobile — only 12% click rate

### A/B Test Recommendations
| Test | Hypothesis | Priority |
|------|-----------|----------|
| Remove phone field | Reduce friction, increase form CVR by 15-20% | HIGH |
| Sticky mobile CTA | Increase CTA visibility, lift clicks by 25% | HIGH |
| Social proof above fold | Build trust earlier, reduce bounce by 10% | MEDIUM |
| Shorter headline | Improve comprehension, lift engagement | LOW |

### Quick Wins Implemented
✅ CTA button contrast increased (accessibility AA compliance)
✅ Form error messages made inline (vs top-of-form)
✅ Mobile tap targets increased to 48px minimum

### Tools Used
🔧 **CRO A/B Test Engine** — Analyzed landing page data and generated prioritized test hypotheses
🔧 **Analytics Platforms** — Heatmap and scroll depth data aggregation
🔧 **Statistical Analysis** — Significance calculators for A/B test recommendations

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 15 — Workflow Orchestrator */
  15: (c) => `# Workflow Validation & QA Checkpoint
Generated: ${today()}

## Pipeline Execution Summary: ${c.pipelineName}
• Steps completed: ${c.stepIndex}/${c.totalSteps}
• All handoffs validated ✅
• No bottlenecks detected
• SLA status: On track

## Handoff Verification
✅ Step 1 → Step 2: Competitive intel → Strategy (data passed correctly)
✅ Step 2 → Step 3: Strategy → Content plan (brief aligned)
✅ All downstream assets reference upstream decisions

## Quality Gates
✅ Brand compliance: All outputs checked
✅ Data accuracy: KPIs cross-referenced
✅ Deliverable completeness: All required assets present

## Human Review Checkpoint
→ All agent outputs are ready for human review
→ Recommended review areas: Budget allocation, creative concepts, campaign targeting

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 16 — Client Reporting */
  16: (c) => `# Client Performance Report — Draft
Generated: ${today()}

## Executive Summary
Campaign performance is trending positively across all key metrics. Total ROAS of ${roas()}x exceeds the ${(parseFloat(roas()) - 0.5).toFixed(1)}x target, with CPA at ${cpa()} (${pct()}% below goal).

## Key Highlights
📈 +${pct()}% increase in qualified leads vs prior period
📈 ROAS improved from ${(parseFloat(roas()) - 0.4).toFixed(1)}x → ${roas()}x
📈 Organic traffic up ${pct()}% after SEO optimizations
📉 CPA decreased ${pct()}% through audience refinement

## Channel Performance Summary
| Channel | Spend | Leads | CPA | ROAS |
|---------|-------|-------|-----|------|
| Meta Ads | ${budget()} | ${(Math.random() * 50 + 15).toFixed(0)} | ${cpa()} | ${roas()}x |
| Google Ads | ${budget()} | ${(Math.random() * 40 + 10).toFixed(0)} | ${cpa()} | ${roas()}x |
| LinkedIn | ${budget()} | ${(Math.random() * 20 + 5).toFixed(0)} | ${cpa()} | ${roas()}x |
| Organic/SEO | — | ${(Math.random() * 30 + 10).toFixed(0)} | $0 | ∞ |

## Next Period Priorities
1. Scale top-performing Meta ad sets (+20% budget)
2. Launch YouTube Shorts campaign
3. Publish 2 authority content pieces for organic pipeline

→ Report ready for client review and delivery.

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 17 — Budget Manager */
  17: (c) => `# Budget & Spend Analysis
Generated: ${today()}

## Spend Pacing Overview
| Channel | Budget | Spent | Remaining | Pace |
|---------|--------|-------|-----------|------|
| Meta Ads | ${budget()} | ${budget()} | ${budget()} | ✅ On pace |
| Google Ads | ${budget()} | ${budget()} | ${budget()} | ⚠️ Slightly ahead |
| LinkedIn | ${budget()} | ${budget()} | ${budget()} | ✅ On pace |
| Content | ${budget()} | ${budget()} | ${budget()} | ✅ Under budget |

## Reallocation Recommendations
→ Move $500 from Google Display (underperforming) → Google Search (high ROAS)
→ Increase LinkedIn budget by $300/week (CPA below target)
→ Reserve 10% contingency for scaling winners mid-month

## Cost Anomalies
⚠️ Google CPC increased ${pct()}% — competitor bidding activity detected
✅ Meta CPM stable — no anomalies

## Forecast
→ Projected month-end spend: On track within 3% of budget
→ Projected ROAS: ${roas()}x (above ${(parseFloat(roas()) - 0.3).toFixed(1)}x target)

### Tools Used
🔧 **Budget Pacing Optimizer** — Cross-platform spend monitoring with auto-adjustment recommendations
🔧 **Ad Platform APIs** — Real-time spend data pull from Meta, Google, LinkedIn
🔧 **Forecasting Models** — Month-end spend and ROAS projections

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 18 — System Intelligence */
  18: (c) => `# System Intelligence Update
Generated: ${today()}

## Knowledge Base Updated
✅ Campaign performance data cached for cross-client pattern analysis
✅ Creative performance benchmarks updated
✅ Client preference database synced

## Key Learnings Extracted
→ UGC-style creatives outperforming polished ads by ${pct()}% CTR
→ Quiz funnels converting ${pct()}% higher than standard landing pages
→ LinkedIn decision-maker targeting yielding lowest CPL across B2B clients

## Agent Ecosystem Health
✅ All 24 agents operational
✅ Average task completion time: 2.3 minutes
✅ Zero errors in current pipeline run

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 19 — Client Onboarding */
  19: (c) => `# Client Onboarding & Discovery Report
Generated: ${today()}

## Discovery Research Complete
✅ Industry vertical analysis: Market size, trends, key players
✅ Client website audit: Technical health, content gaps, UX assessment
✅ Competitor mapping: 5 direct + 3 indirect competitors identified
✅ Audience personas: 3 primary segments defined

## Onboarding Deliverables
✅ Client brief document compiled
✅ Brand voice guide extracted from existing materials
✅ Asana project structure created with all pipeline templates
✅ Kickoff meeting agenda prepared

## Initial Recommendations
1. Immediate: Fix 3 critical technical SEO issues found in site audit
2. Short-term: Launch competitor displacement campaign on branded terms
3. Long-term: Build authority content hub for organic pipeline

### Tools Used
🔧 **AI Lead Qualifier** — ICP scoring framework for prospect qualification
🔧 **Testimonial Collector** — Automated review and testimonial collection workflows
🔧 **Asana API** — Project structure creation with pipeline templates

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 20 — Video Producer */
  20: (c) => `# Video & Multimedia Production Report
Generated: ${today()}

## Deliverables

### Video Scripts
✅ 15s TikTok/Reel — Hook → Value → CTA
✅ 30s YouTube Pre-roll — Problem → Solution → Proof → CTA
✅ 60s Brand Story — Documentary style with client testimonials

### Storyboards
✅ Scene-by-scene breakdowns for all 3 scripts
✅ B-roll direction with shot list
✅ Text overlay timing cues
✅ Music/sound design notes

### Podcast Show Notes
✅ Episode outline: 5 discussion points
✅ Guest prep questions drafted
✅ Social media clip timestamps identified (3 clips)

### Tools Used
🔧 **YouTube Trend Finder** — Analyzed trending video formats and generated content briefs
🔧 **IG Reels Generator** — Matched trending audio to script concepts for short-form video
🔧 **Video AI Tools** — Storyboard generation and B-roll direction automation

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 21 — LLMO Specialist */
  21: (c) => `# LLMO & AI Visibility Audit
Generated: ${today()}

## AI Search Presence Audit
Tested brand visibility across ChatGPT, Claude, Perplexity, and Google AI Overview.

### Current AI Citation Status
| Platform | Mentioned | Cited | Recommended |
|----------|-----------|-------|-------------|
| ChatGPT | ❌ No | ❌ No | ❌ No |
| Claude | ❌ No | ❌ No | ❌ No |
| Perplexity | ⚠️ Partial | ❌ No | ❌ No |
| Google AI Overview | ⚠️ Partial | ✅ Yes (1x) | ❌ No |

### Optimization Actions
✅ FAQ schema added to 12 key pages (improves AI extraction)
✅ HowTo schema on 5 tutorial pages
✅ Content restructured with clear Q&A format for LLM parsing
✅ Entity markup added for brand + product names

### Content Recommendations for AI Visibility
→ Create definitive "What is [Topic]?" pages for each service
→ Add structured comparison tables (LLMs prefer tabular data)
→ Build FAQ hubs with 50+ industry questions
→ Publish original research/statistics (AI models cite data sources)

### Tools Used
🔧 **AI Search Visibility (LLMO)** — Queried ChatGPT, Claude, Perplexity for brand citation frequency
🔧 **Schema Markup Tools** — Implemented FAQ and HowTo structured data enhancements
🔧 **Citation Trackers** — Monitored AI platform citation patterns over time

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 22 — Brand QA */
  22: (c) => `# Brand Compliance & QA Review
Generated: ${today()}

## Review Summary
Reviewed all agent outputs for brand compliance, accuracy, and quality.

### Compliance Status
| Item | Status | Notes |
|------|--------|-------|
| Brand voice | ✅ Pass | Consistent across all copy |
| Visual guidelines | ✅ Pass | Colors, fonts, logos correct |
| Legal disclaimers | ✅ Pass | Required disclosures present |
| Ad policy compliance | ✅ Pass | Meta + Google policies met |
| Accessibility | ✅ Pass | WCAG AA standards met |

### Minor Corrections Applied
→ 2 headline capitalizations fixed
→ 1 CTA updated to match brand voice guide
→ Phone number format standardized across all assets

### Quality Score: 94/100
→ All deliverables approved for deployment

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 23 — PR Manager */
  23: (c) => `# Community & PR Outreach Report
Generated: ${today()}

## Outreach Activity

### Guest Post Pipeline
| Publication | DA | Status | Topic |
|-------------|-----|--------|-------|
| Industry Blog A | 55 | ✅ Pitched | Thought leadership |
| Industry Blog B | 48 | ✅ Accepted | How-to guide |
| Niche Publication | 42 | ⏳ Pending | Case study |

### Podcast Bookings
✅ 1 confirmed booking (recording next week)
✅ 2 pitches in review
→ Target: 2 podcast appearances/month

### Link Building
→ 3 broken link reclamation emails sent
→ 2 unlinked brand mention outreach emails sent
→ 1 new backlink acquired (DA 45)

### Tools Used
🔧 **Brand Mention Radar** — Detected unlinked brand mentions and media coverage opportunities
🔧 **Testimonial Collector** — Gathered and formatted client testimonials for PR assets
🔧 **Email Outreach Tools** — Automated guest post and podcast pitch sequences

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,

  /* 24 — Email Automation Manager */
  24: (c) => `# Email & Nurture Sequence Report
Generated: ${today()}

## Sequences Designed

### Welcome Series (5 emails)
| Email | Subject | Send Timing | Goal |
|-------|---------|-------------|------|
| 1 | Welcome + value delivery | Immediate | Engage |
| 2 | Educational content | Day 2 | Educate |
| 3 | Social proof / case study | Day 5 | Trust |
| 4 | Offer introduction | Day 8 | Convert |
| 5 | Urgency + final CTA | Day 12 | Close |

### Re-engagement Sequence (3 emails)
→ Targets subscribers inactive >30 days
→ Progressive offers: Content → Discount → Last chance

### Automation Triggers Configured
✅ Quiz completion → Welcome series
✅ Pricing page visit → Sales follow-up sequence
✅ Cart abandonment → 3-email recovery flow
✅ Lead magnet download → Nurture sequence

### Projected Performance
→ Open rate: 35-45% (welcome series)
→ Click rate: 8-12%
→ Unsubscribe rate: <0.5%

### Tools Used
🔧 **Email Nurture Automator** — Built multi-step sequences with behavioral triggers and A/B variants
🔧 **Email Reply Classifier** — Configured inbound reply classification and routing rules
🔧 **CRM Connectors** — Synced lead data for personalized automation workflows

---
Pipeline: ${c.pipelineName} | Step ${c.stepIndex + 1}/${c.totalSteps}`,
};

/* ─── Public API ─── */

/**
 * Generate the work-output text for a given agent step.
 * Returns a formatted report suitable for Asana task notes.
 */
export function generateAgentOutput(ctx: OutputContext): string {
  const gen = generators[ctx.agentId];
  if (gen) return gen(ctx);

  // Fallback for any agent ID not explicitly mapped
  return `# ${ctx.agentName} — Task Complete
Generated: ${today()}

## Action Completed
${ctx.action}

## Summary
Agent ${ctx.agentShortName} has completed its assigned step in the ${ctx.pipelineName} pipeline.
All deliverables have been produced and are ready for the next stage.

### Output Details
→ Step ${ctx.stepIndex + 1} of ${ctx.totalSteps}
→ Status: Complete
→ Quality check: Passed

---
Pipeline: ${ctx.pipelineName} | Step ${ctx.stepIndex + 1}/${ctx.totalSteps}`;
}
