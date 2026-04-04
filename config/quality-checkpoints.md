# MPAIOS Quality Checkpoints

> Global quality gates applied across all agent outputs. Each checkpoint must pass before work is handed off to the next agent or delivered to a client.

## Universal Quality Gates

These apply to ALL agent outputs regardless of type:

### Gate 1: Client Alignment
- [ ] Output aligns with stated client objectives
- [ ] Brand voice and tone are consistent with client guidelines
- [ ] No content contradicts client's known positions or values
- [ ] Appropriate for the client's industry and regulatory environment

### Gate 2: Strategic Coherence
- [ ] Output supports the approved campaign strategy
- [ ] Messaging aligns with the target audience personas
- [ ] Funnel stage is appropriate (TOFU/MOFU/BOFU)
- [ ] Channel-specific best practices are followed

### Gate 3: Factual Accuracy
- [ ] All claims are verifiable and properly sourced
- [ ] No AI hallucinations in facts, statistics, or citations
- [ ] Industry terminology is used correctly
- [ ] Compliance requirements are met (healthcare, financial, legal)

### Gate 4: Professional Standards
- [ ] Grammar, spelling, and punctuation are error-free
- [ ] Formatting follows the required template/specification
- [ ] All required sections/components are present
- [ ] Output is complete — no placeholder text or TODO items

### Gate 5: Handoff Readiness
- [ ] Output format matches what the receiving agent expects
- [ ] All required metadata is included (client, campaign, dates)
- [ ] Context notes are provided for the receiving agent
- [ ] Priority and deadline are clearly stated

---

## Division-Specific Quality Gates

### Strategy & Intelligence (Agents 01-02)

**Competitive Intelligence Reports:**
- [ ] Minimum 3 competitors analyzed per report
- [ ] Ad creative examples include screenshots or descriptions
- [ ] Spend estimates include methodology and confidence level
- [ ] Opportunities are ranked by potential impact
- [ ] Report includes actionable recommendations, not just observations

**Campaign Proposals:**
- [ ] Multi-channel architecture is defined with clear rationale
- [ ] Budget allocation has mathematical justification
- [ ] Audience personas include demographic, psychographic, and behavioral data
- [ ] Funnel stages map to specific content and ad types
- [ ] KPI targets are realistic and benchmarked against industry standards

### Content & Creative (Agents 03-06)

**Written Content:**
- [ ] Readability score appropriate for target audience (aim for grade 8-10)
- [ ] E-E-A-T signals present (expertise, experience, authority, trust)
- [ ] SEO optimization without keyword stuffing (primary keyword density 1-2%)
- [ ] All citations link to credible, current sources
- [ ] Call-to-action is clear and aligned with funnel stage
- [ ] Content length meets the specified requirement
- [ ] Plagiarism check passes (0% duplicate content)

**Ad Creative:**
- [ ] Platform specifications met (dimensions, file size, text limits)
- [ ] Hook is present in first 3 seconds (video) or immediately visible (image)
- [ ] CTA is clear and action-oriented
- [ ] Brand elements are correctly applied (colors, fonts, logo placement)
- [ ] No policy violations for target platforms (Meta, Google, TikTok, etc.)
- [ ] Creative testing matrix includes minimum 3 variants

**Landing Pages:**
- [ ] Mobile-responsive design verified
- [ ] Page load time under 3 seconds
- [ ] Form fields are minimal and appropriate
- [ ] CTA is above the fold
- [ ] Trust elements present (testimonials, logos, certifications)
- [ ] Tracking pixels and UTM parameters configured
- [ ] Thank you page / post-conversion flow defined

### Paid Media Operations (Agents 07-09)

**Campaign Structures:**
- [ ] Naming conventions follow the standard format: `[Client]_[Channel]_[Objective]_[Audience]_[Date]`
- [ ] Campaign objective matches the funnel stage
- [ ] Audience targeting is defined and non-overlapping across ad sets
- [ ] Budget is correctly allocated per the approved plan
- [ ] Bid strategy aligns with campaign objectives
- [ ] Creative assets are correctly mapped to ad sets
- [ ] Tracking is configured (pixels, conversions, UTMs)
- [ ] Campaign is set to DRAFT / PAUSED — never auto-published
- [ ] Exclusions are set (existing customers, employees, etc.)

### Organic & Authority (Agents 10-12)

**SEO Deliverables:**
- [ ] Technical issues are prioritized by impact
- [ ] Keyword targets include search volume and difficulty data
- [ ] On-page recommendations reference specific URLs
- [ ] Schema markup suggestions include valid JSON-LD
- [ ] Internal linking recommendations are actionable

**Social Content:**
- [ ] Platform-native formatting (character limits, hashtag counts)
- [ ] Posting times align with audience activity data
- [ ] Content mix follows the 80/20 or 70/20/10 rule
- [ ] Visual descriptions or image briefs included for each post
- [ ] Engagement prompts included where appropriate

**Sentiment Reports:**
- [ ] Sentiment scoring methodology is documented
- [ ] Alert thresholds are defined and justified
- [ ] Crisis scenarios include recommended response templates
- [ ] Competitor comparison uses equivalent data sources and timeframes

### Analytics & Optimization (Agents 13-14)

**Performance Reports:**
- [ ] Data sources are identified and date ranges specified
- [ ] KPIs include period-over-period comparison
- [ ] Underperformers are identified with specific causes
- [ ] Recommendations include expected impact estimates
- [ ] Executive summary is under 200 words
- [ ] Visualizations are clear and properly labeled

**CRO Recommendations:**
- [ ] Test hypotheses are clearly stated
- [ ] Statistical significance requirements are defined (minimum 95%)
- [ ] Sample size calculations are included
- [ ] Expected lift is estimated with confidence range
- [ ] Implementation requirements are specified

### Operations & Infrastructure (Agents 15-18)

**Client Reports:**
- [ ] All data is current (within 24 hours for weekly reports)
- [ ] Narrative matches the data — no contradictions
- [ ] Recommendations are specific and actionable
- [ ] Design is consistent with client-facing templates
- [ ] Executive summary stands alone as a complete brief

**Budget Reports:**
- [ ] Spend data matches platform reporting (within 2% variance)
- [ ] Pacing projections use trailing 7-day averages
- [ ] Anomalies are flagged with specific details
- [ ] Reallocation recommendations include performance justification

**Knowledge Base Updates:**
- [ ] Learnings are tagged by client, channel, and topic
- [ ] Contradictions with existing knowledge are flagged
- [ ] Source data is referenced for verification
- [ ] Updates are timestamped and attributed to the source agent

---

## Quality Scoring

Each output receives a quality score from the orchestrator:

| Score | Label | Action |
|-------|-------|--------|
| 9-10 | Excellent | Proceed to next step |
| 7-8 | Good | Proceed with minor notes |
| 5-6 | Acceptable | Proceed after specific revisions |
| 3-4 | Below Standard | Re-prompt with detailed feedback |
| 1-2 | Unacceptable | Re-prompt or escalate to human |

Outputs scoring below 5 are never handed off to the next agent or delivered to clients.
