# Pipeline 3: Performance Optimization Cycle

> A weekly automated cycle that analyzes campaign performance and generates optimization actions across all active campaigns.

## Trigger
- Weekly schedule (every Monday)
- Manual trigger when performance anomaly detected
- Post-launch review (7 days after any new campaign activation)

## Frequency
Weekly for all active clients. Can be triggered on-demand for urgent optimization.

## Pipeline Steps

### Step 1: Cross-Channel Performance Analysis
**Agent:** 13 - Campaign Performance Analyst
**Action:** Pull cross-channel data and identify underperformers
**Inputs:**
- Active campaign list across all platforms
- KPI targets and benchmarks per campaign
- Previous week's performance data
- Historical performance baselines (from Agent 18)
**Outputs:**
- Cross-channel performance dashboard (updated)
- Underperformer identification with root cause analysis
- Top performer identification with winning element analysis
- Week-over-week and month-over-month trend report
- KPI alert summary (any metrics outside acceptable range)
**Quality Gate:** Data sources verified, date ranges correct, no missing campaigns
**Estimated Duration:** 2-3 hours

---

### Step 2: Conversion Funnel Analysis
**Agent:** 14 - Conversion Rate Optimization Specialist
**Action:** Analyze landing page and funnel conversion data, recommend tests
**Inputs:**
- Performance data (from Step 1)
- Landing page analytics (page views, bounce rate, conversion rate)
- Heatmap and session recording data (if available)
- Active A/B test results
**Outputs:**
- Funnel drop-off analysis with specific bottleneck identification
- A/B test results with statistical significance assessment
- New test recommendations with hypotheses and expected lift
- Landing page improvement recommendations (specific and prioritized)
- Conversion rate trend report
**Quality Gate:** Recommendations are specific, actionable, and prioritized by expected impact
**Estimated Duration:** 2-3 hours

---

### Step 3: Budget Review & Reallocation
**Agent:** 17 - Budget & Financial Operations Manager
**Action:** Review spend pacing and recommend budget reallocations
**Inputs:**
- Performance data (from Step 1)
- Current budget allocation and pacing data
- Client budget constraints and goals
- Cost anomaly alerts (if any)
**Outputs:**
- Budget pacing report (on track, underspend, overspend per campaign)
- Spend efficiency analysis by campaign, channel, and audience
- Reallocation recommendations (shift budget from underperformers to winners)
- Cost anomaly investigation results
- Projected end-of-month spend at current pacing
**Quality Gate:** Reallocation recommendations don't exceed client budget limits
**Estimated Duration:** 1-2 hours

---

### Step 4: Creative Refresh
**Agent:** 05 - Ad Creative Director
**Action:** Produce refreshed creatives for fatiguing ads
**Inputs:**
- Creative performance analysis (from Step 1 — which creatives are fatiguing)
- Winning element analysis (which hooks, visuals, CTAs perform best)
- Brand guidelines
- Current creative testing matrix
**Outputs:**
- Refreshed ad creatives for fatiguing campaigns
- New creative variants based on winning elements
- Updated creative testing matrix
- Creative fatigue prevention schedule
**Quality Gate:** New creatives are distinct from fatiguing ones while building on winning patterns
**Conditional:** Only runs if creative fatigue is detected in Step 1
**Estimated Duration:** 2-4 hours

---

### Step 5: Platform Optimization Implementation
**Agents:** 07, 08, 09 — Platform-specific ads managers (parallel)
**Action:** Implement approved optimizations in each platform
**Inputs:**
- Optimization recommendations (from Steps 1-3)
- Budget reallocation plan (from Step 3)
- Refreshed creatives (from Step 4, if applicable)
- Human-approved changes
**Actions per platform:**
- Pause underperforming ad sets/campaigns
- Adjust budgets per reallocation plan
- Upload refreshed creatives
- Refine audience targeting based on performance data
- Update bid strategies if recommended
- Add negative keywords (Google) or exclusions (Meta)
**Outputs:**
- Implementation confirmation with list of changes made
- Updated campaign configurations
- Expected impact summary
**Quality Gate:** All changes logged, no budget increases without approval, campaigns still in compliant state
**Parallel Execution:** All platform agents work simultaneously
**Estimated Duration:** 1-2 hours per platform

> **HUMAN REVIEW CHECKPOINT** — Significant budget changes (>20% reallocation) and campaign pausing require human approval.

---

### Step 6: Weekly Performance Summary
**Agent:** 16 - Client Reporting & Insights Compiler
**Action:** Generate weekly performance summary with actions taken
**Inputs:**
- Performance analysis (from Step 1)
- CRO findings (from Step 2)
- Budget adjustments (from Step 3)
- Creative changes (from Step 4)
- Implementation log (from Step 5)
**Outputs:**
- Weekly performance summary (client-ready format)
- Executive summary (under 200 words)
- Key metrics table with week-over-week changes
- Actions taken this week with expected impact
- Recommendations requiring client input
- Next week's optimization priorities
**Quality Gate:** Summary is accurate, concise, and actionable. No jargon without explanation.
**Estimated Duration:** 1-2 hours

---

## Post-Cycle Actions

1. Agent 18 logs all optimizations and their outcomes for pattern recognition
2. Agent 15 updates the workflow status for all active campaigns
3. If any critical issues found, escalate to human operator immediately (don't wait for weekly cycle)
4. Schedule next cycle for the following week

## Total Estimated Duration Per Cycle
- **Standard cycle:** 6-12 hours of agent work
- **With creative refresh:** 8-16 hours
- **Human review:** Minimal (pre-approved optimization thresholds reduce approval bottlenecks)
