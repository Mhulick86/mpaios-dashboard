# Pipeline 4: Competitive Response

> Triggered when the Competitive Intelligence Analyst detects significant competitor moves that require a strategic response.

## Trigger
- Agent 01 detects significant competitor activity:
  - New campaign launches by key competitors
  - Major positioning shifts or rebranding
  - Aggressive spend increases (>30% week-over-week)
  - New market entry or product launch
  - Competitor targeting our client's branded terms
- Agent 12 detects competitor sentiment shift
- Manual trigger by human operator

## Priority
This pipeline runs at **P1 (Urgent)** priority and can interrupt scheduled work.

## Pipeline Steps

### Step 1: Competitive Activity Analysis
**Agent:** 01 - Competitive Intelligence Analyst
**Action:** Flag competitor activity change with detailed analysis
**Inputs:**
- Detected competitive activity signal
- Historical competitor baseline data (from Agent 18)
- Current client positioning and active campaigns
**Outputs:**
- Competitive activity alert report including:
  - What changed (new ads, new landing pages, spend shift, positioning change)
  - Evidence (screenshots, ad copies, landing page URLs)
  - Estimated impact on our client's market position
  - Spend estimate changes
  - Timeline of when the change was detected
- Threat level assessment (Low / Medium / High / Critical)
**Quality Gate:** Alert includes concrete evidence, not speculation
**Estimated Duration:** 1-2 hours

---

### Step 2: Strategic Assessment & Response Options
**Agent:** 02 - Head of Strategy & Campaign Planning
**Action:** Assess strategic implications and develop response options
**Inputs:**
- Competitive activity report (from Step 1)
- Client's current campaign strategy and performance
- Client's budget flexibility
- Brand positioning and differentiation factors
**Outputs:**
- Strategic impact assessment:
  - How does this affect our client's campaigns?
  - Which audiences or keywords are at risk?
  - What opportunities does this create?
- Response options (2-3 options with pros/cons):
  - **Option A: Defensive** — Protect current position (adjust targeting, increase spend on contested areas)
  - **Option B: Offensive** — Counter-attack (exploit competitor's gaps, launch competing campaign)
  - **Option C: Differentiate** — Pivot messaging to emphasize unique positioning
  - **Option D: Monitor** — No immediate action, continue observation
- Recommended response with justification
- Budget implications for each option
- Timeline for response execution
**Quality Gate:** Options are realistic within current budget, recommendations are clear
**Estimated Duration:** 2-4 hours

> **HUMAN REVIEW CHECKPOINT** — Response strategy must be approved before execution. Present options to human operator with clear recommendation.

---

### Step 3: Response Execution
**Agents:** Varies based on approved response (parallel where possible)
**Action:** Relevant creative and media agents execute the approved response

**If creative changes needed:**
- Agent 05 (Ad Creative Director) produces new creatives addressing the competitive move
- Agent 04 (Authority Copywriter) updates messaging or produces counter-content

**If targeting adjustments needed:**
- Agent 07/08/09 (Ads Managers) adjust targeting, exclusions, and bidding
- Agent 10 (SEO Manager) adjusts keyword strategy if organic is affected

**If budget shifts needed:**
- Agent 17 (Budget Manager) executes approved budget reallocation
- Platform agents implement budget changes

**If landing page changes needed:**
- Agent 06 (Landing Page Architect) creates or modifies landing pages
- Agent 14 (CRO Specialist) ensures conversion optimization is maintained

**Inputs:**
- Approved response strategy (from Step 2)
- Specific execution instructions per agent
- Budget authorization for any spend changes
**Outputs:**
- Implementation confirmation from each involved agent
- Updated campaign configurations
- New creatives or content (if applicable)
- Revised budget allocation (if applicable)
**Quality Gate:** All changes align with approved strategy, no unauthorized budget increases
**Estimated Duration:** 2-6 hours (depends on response scope)

---

### Step 4: Documentation & Client Briefing
**Agent:** 16 - Client Reporting & Insights Compiler
**Action:** Document the competitive move and agency response for client briefing
**Inputs:**
- Competitive activity report (from Step 1)
- Strategic assessment (from Step 2)
- Implementation confirmations (from Step 3)
**Outputs:**
- Client briefing document including:
  - What the competitor did (with evidence)
  - Our strategic assessment of the impact
  - What actions we took in response
  - Expected outcomes and timeline
  - Monitoring plan going forward
- Internal debrief for the knowledge base
**Quality Gate:** Briefing is professional, avoids alarmism, focuses on proactive response
**Estimated Duration:** 1-2 hours

---

## Post-Pipeline Actions

1. Agent 18 logs the competitive event and response for future reference
2. Agent 01 increases monitoring frequency on the triggering competitor (daily for 2 weeks)
3. Agent 13 adds competitive response metrics to the performance dashboard
4. Schedule follow-up assessment in 7 days to evaluate response effectiveness
5. If response was effective, document as a playbook for future competitive situations

## Escalation Criteria

Escalate immediately to human operator (bypass normal pipeline) if:
- Competitor is running ads targeting our client's brand name
- Competitor's actions may involve legal/compliance issues
- Required response budget exceeds pre-approved limits by >50%
- Competitive activity suggests market-level disruption (new entrant, M&A, etc.)

## Total Estimated Duration
- **Detection to briefing:** 6-14 hours of agent work
- **Including human review:** 1-2 business days
- **Emergency response (P0):** Same-day execution with human approval
