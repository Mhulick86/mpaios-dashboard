# Pipeline 1: Full Campaign Launch

> The flagship pipeline that takes a client engagement from competitive research to live campaigns across multiple channels.

## Trigger
- New client onboarding
- New campaign request from existing client
- Quarterly campaign refresh

## Pipeline Steps

### Step 1: Competitive Intelligence
**Agent:** 01 - Competitive Intelligence Analyst
**Action:** Extract and analyze competitor ads, landing pages, and positioning
**Inputs:**
- Client name and industry
- Top 3-5 known competitors
- Target geographic market
**Outputs:**
- Competitive analysis report (HTML)
- Creative asset archive (screenshots, ad copies)
- Spend estimates and channel allocation analysis
- Opportunity map with positioning gaps
**Quality Gate:** Report covers minimum 3 competitors with actionable insights
**Estimated Duration:** 2-4 hours

---

### Step 2: Campaign Strategy Development
**Agent:** 02 - Head of Strategy & Campaign Planning
**Action:** Analyze client brand and develop multi-channel campaign proposal
**Inputs:**
- Competitive analysis report (from Step 1)
- Client website URL and existing brand materials
- Campaign objectives and budget
- Target audience description
**Outputs:**
- Campaign proposal document
- Brand bible / style guide extraction
- Audience personas (3-5 per campaign)
- Multi-channel architecture with budget allocation
- Creative briefs for each channel
- Funnel map (TOFU → MOFU → BOFU)
**Quality Gate:** Strategy approved by human operator before proceeding
**Estimated Duration:** 3-6 hours

> **HUMAN REVIEW CHECKPOINT** — Campaign strategy must be approved before creative production begins.

---

### Step 3: Content Strategy & Editorial Planning
**Agent:** 03 - Authority Content Strategist
**Action:** Develop content pillars and SEO-aligned editorial plan
**Inputs:**
- Campaign proposal (from Step 2)
- Brand bible and audience personas (from Step 2)
- Competitive analysis (from Step 1)
**Outputs:**
- Content pillar map with topic clusters
- Editorial calendar (first 90 days)
- SEO keyword targets per content piece
- Content-to-conversion funnel mapping
**Quality Gate:** Content pillars align with campaign strategy and SEO opportunity
**Estimated Duration:** 2-4 hours

---

### Step 4: Copy & Content Production
**Agent:** 04 - Authority Copywriter
**Action:** Produce landing page copy, ad copy, email sequences, and authority content
**Inputs:**
- Creative briefs (from Step 2)
- Content strategy and SEO targets (from Step 3)
- Brand bible and voice guidelines (from Step 2)
**Outputs:**
- Landing page copy (all pages in the funnel)
- Ad copy variants (headlines, descriptions, primary text per platform)
- Email sequences (nurture, onboarding, re-engagement)
- First authority content piece (article or case study)
**Quality Gate:** Copy passes readability, brand voice, and E-E-A-T checks
**Parallel With:** Step 5 (Ad Creative Director) — both receive creative briefs simultaneously
**Estimated Duration:** 4-8 hours

---

### Step 5: Creative Asset Production
**Agent:** 05 - Ad Creative Director
**Action:** Generate image ads, video scripts, carousel assets across all formats
**Inputs:**
- Creative briefs (from Step 2)
- Brand bible with visual standards (from Step 2)
- Ad copy variants (from Step 4, if available; otherwise work from briefs)
**Outputs:**
- Image ad creatives (3-5 variants per platform)
- Video ad scripts (15s, 30s formats)
- Carousel ad designs with sequencing
- Creative testing matrix
**Quality Gate:** Creatives meet platform specs and brand guidelines
**Parallel With:** Step 4 (Authority Copywriter)
**Estimated Duration:** 3-6 hours

---

### Step 6: Landing Page Build
**Agent:** 06 - Landing Page Architect
**Action:** Build conversion-optimized landing pages and quiz funnels
**Inputs:**
- Landing page copy (from Step 4)
- Brand visual standards (from Step 2)
- Funnel architecture (from Step 2)
- CRO best practices
**Outputs:**
- Production-ready landing pages (HTML/CSS)
- Quiz funnel implementation (if applicable)
- Lead magnet delivery pages
- A/B test variants (headline and CTA variants)
- Thank you / post-conversion pages
**Quality Gate:** Pages are mobile-responsive, load under 3 seconds, tracking configured
**Estimated Duration:** 4-8 hours

---

### Step 7: Campaign Deployment (Draft Mode)
**Agents:** 07, 08, 09 — Platform-specific ads managers (parallel)
**Action:** Build campaigns in each target platform in DRAFT/PAUSED mode

**Agent 07 - Meta Ads Manager:**
- Create campaign structure in Meta Ads Manager
- Configure audience targeting and exclusions
- Upload creatives and map to ad sets
- Set budget allocation and bid strategy
- **Output:** Draft campaigns ready for activation

**Agent 08 - Google Ads Manager:**
- Create Search, Display, PMax, or YouTube campaigns
- Configure keyword targeting and negative keywords
- Upload ad copy and creative assets
- Set bid strategies and budget
- **Output:** Draft campaigns ready for activation

**Agent 09 - Social Ads Specialist:**
- Create campaigns in TikTok, LinkedIn, Pinterest, X as needed
- Adapt creatives to platform specifications
- Configure platform-specific targeting
- **Output:** Draft campaigns ready for activation

**Quality Gate:** All campaigns in DRAFT mode, naming conventions followed, tracking verified
**Parallel Execution:** All platform agents work simultaneously
**Estimated Duration:** 2-4 hours per platform

---

### Step 8: Analytics & Tracking Setup
**Agent:** 13 - Campaign Performance Analyst
**Action:** Set up tracking dashboards and KPI benchmarks
**Inputs:**
- Campaign structures from all platforms (from Step 7)
- KPI targets from campaign proposal (from Step 2)
- Budget allocation plan (from Step 2)
**Outputs:**
- Cross-channel performance dashboard
- KPI tracking framework with alert thresholds
- Attribution model configuration
- Automated reporting schedule
**Quality Gate:** All tracking pixels firing, dashboard shows live data
**Estimated Duration:** 2-3 hours

---

### Step 9: Final Validation & Human Review
**Agent:** 15 - Workflow Orchestrator & Task Manager
**Action:** Validate all handoffs, compile deliverables, trigger human review
**Inputs:**
- All outputs from Steps 1-8
- Quality checkpoint results
**Outputs:**
- Campaign launch checklist (all items verified)
- Consolidated deliverable package for human review
- List of items requiring human approval
- Recommended activation sequence and timeline
**Quality Gate:** All prior quality gates passed, human approval obtained

> **HUMAN REVIEW CHECKPOINT** — All campaigns, landing pages, and content must be reviewed and approved by a human operator before any activation.

---

## Pipeline Completion

After human approval:
1. Platform ad managers activate campaigns per the approved sequence
2. Agent 13 begins real-time performance monitoring
3. Agent 17 begins budget pacing tracking
4. Agent 15 schedules the first Performance Optimization Cycle (Pipeline 3) for 7 days post-launch
5. Agent 18 logs the campaign launch in the knowledge base

## Total Estimated Duration
- **With parallel execution:** 12-24 hours of agent work
- **Including human review time:** 1-3 business days end-to-end
