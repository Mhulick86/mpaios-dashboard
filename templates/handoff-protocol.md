# Agent Handoff Protocol

> Standard format and rules for passing work between agents in the MPAIOS ecosystem.

---

## Handoff Document Format

Every handoff between agents MUST use the following format:

```markdown
## Handoff: Agent [XX] → Agent [XX]

### Metadata
- **Client:** [Client Name]
- **Campaign:** [Campaign Name]
- **Pipeline:** [Pipeline Name or "Standalone"]
- **Pipeline Step:** [Step Number, if applicable]
- **Priority:** [P0-P4]
- **Deadline:** [Date/Time]
- **Handoff ID:** [Auto-generated: YYYYMMDD-AgentXX-AgentXX-001]

### Task Description
[Clear, concise description of what the receiving agent needs to do]

### Deliverables Attached
1. [Deliverable name] — [Brief description]
2. [Deliverable name] — [Brief description]

### Context Notes
- [Key context the receiving agent needs to understand]
- [Relevant decisions made in prior steps]
- [Client preferences or constraints to be aware of]

### Quality Status
- **Source Agent Quality Score:** [1-10]
- **Quality Checkpoints Passed:** [List]
- **Known Issues or Caveats:** [Any limitations in the delivered work]

### Dependencies
- **Blocked By:** [Any pending items this work depends on]
- **Blocks:** [Which downstream agents/steps are waiting on this]

### Reference Materials
- [Links to brand guidelines, previous deliverables, templates]
```

---

## Handoff Rules

### Rule 1: Validate Before Sending
The sending agent MUST verify before handoff:
- [ ] All required deliverables are complete (no placeholders or TODOs)
- [ ] Output format matches what the receiving agent expects
- [ ] Quality checkpoints for this step have passed
- [ ] Client and campaign context is included
- [ ] Priority and deadline are clearly stated

### Rule 2: Validate Before Accepting
The receiving agent MUST verify before beginning work:
- [ ] All required inputs are present and accessible
- [ ] Inputs are in the expected format
- [ ] Context is sufficient to begin work
- [ ] No contradictions between the brief and the deliverables
- [ ] Deadline is achievable

If validation fails, the receiving agent returns the handoff with a specific description of what's missing.

### Rule 3: Never Assume Missing Context
If the receiving agent needs information not included in the handoff:
1. First check Agent 18's knowledge base for the missing information
2. If not found, request the specific information from the sending agent
3. Never guess or fabricate missing context
4. Document the gap so Agent 15 can improve the pipeline

### Rule 4: Maintain the Chain of Custody
Every handoff is logged by Agent 15 (Workflow Orchestrator) for:
- Pipeline progress tracking
- Bottleneck identification
- SLA compliance monitoring
- Quality trend analysis

### Rule 5: Escalation on Failure
If a handoff fails validation twice:
1. Agent 15 is notified automatically
2. Agent 15 mediates between the sending and receiving agents
3. If still unresolved, escalate to human operator
4. Document the failure pattern for Agent 18

---

## Common Handoff Paths

### Strategy → Creative
```
Agent 02 (Strategy) → Agent 04 (Copywriter)
Agent 02 (Strategy) → Agent 05 (Creative Director)
Agent 02 (Strategy) → Agent 06 (Landing Page Architect)
```
**Required from Strategy:**
- Campaign proposal (approved)
- Creative briefs per channel
- Audience personas
- Brand bible / style guide
- Funnel architecture

### Creative → Media
```
Agent 04 (Copywriter) → Agent 07/08/09 (Ads Managers)
Agent 05 (Creative Director) → Agent 07/08/09 (Ads Managers)
Agent 06 (Landing Page) → Agent 07/08/09 (Ads Managers)
```
**Required from Creative:**
- Ad copy variants (platform-formatted)
- Creative assets (platform-spec compliant)
- Landing page URLs (live or staging)
- UTM parameter specifications

### Content → Organic
```
Agent 04 (Copywriter) → Agent 10 (SEO Manager)
Agent 04 (Copywriter) → Agent 11 (Social Organic)
Agent 03 (Content Strategist) → Agent 04 (Copywriter)
```
**Required from Content:**
- Completed content pieces
- Target keywords and SEO requirements
- Distribution plan
- Pull quotes for social

### Analytics → Operations
```
Agent 13 (Performance Analyst) → Agent 16 (Reporting)
Agent 13 (Performance Analyst) → Agent 17 (Budget)
Agent 14 (CRO) → Agent 06 (Landing Page)
Agent 14 (CRO) → Agent 05 (Creative Director)
```
**Required from Analytics:**
- Performance data (structured, date-stamped)
- Specific optimization recommendations
- Statistical analysis results
- Priority-ranked action items

---

## Handoff Timing Standards

| Handoff Type | Maximum Time |
|-------------|--------------|
| Pipeline step → next step | 1 hour after quality gate passed |
| Optimization recommendation → implementation | Same business day |
| Competitive alert → strategic assessment | 4 hours |
| Client request → first agent activation | 2 hours |
| Quality failure → re-prompt | 30 minutes |

---

## Conflict Resolution

When two agents disagree on approach or quality:
1. Agent 15 (Workflow Orchestrator) reviews both positions
2. If strategic disagreement → Agent 02 (Head of Strategy) arbitrates
3. If quality disagreement → Apply quality checkpoints objectively
4. If still unresolved → Escalate to human operator
5. Document the resolution for future reference (Agent 18)
