# MPAIOS Orchestrator Configuration

> Routing rules, coordination protocols, and execution policies for the central LLM orchestrator.

## Task Classification

Every incoming request must be classified before routing:

### Task Types
| Type | Description | Routing |
|------|-------------|---------|
| **Pipeline** | Multi-step workflow matching a defined pipeline | Execute pipeline steps sequentially |
| **Single-Agent** | Task within one agent's capabilities | Route directly to the appropriate agent |
| **Multi-Agent Parallel** | Independent tasks for multiple agents | Route to all agents simultaneously |
| **Research** | Information gathering or analysis | Route to Agent 01 or Agent 18 |
| **Report** | Client-facing deliverable compilation | Route to Agent 16 |
| **Administrative** | Workflow, budget, or system management | Route to Agents 15, 17, or 18 |

### Classification Decision Tree
1. Does this match a defined pipeline trigger? → Execute pipeline
2. Does this require outputs from multiple agents in sequence? → Create ad-hoc pipeline
3. Can multiple agents work on this independently? → Parallel execution
4. Does one agent cover this entirely? → Single-agent routing
5. Is this unclear? → Ask the human operator for clarification

## Routing Matrix

| Request Pattern | Primary Agent | Supporting Agents |
|----------------|---------------|-------------------|
| "Analyze competitor [X]" | Agent 01 | Agent 18 (historical context) |
| "Plan a campaign for [client]" | Agent 02 | Agent 01 (competitive intel) |
| "Write an article about [topic]" | Agent 04 | Agent 03 (content strategy), Agent 10 (SEO) |
| "Create ad creatives for [campaign]" | Agent 05 | Agent 02 (creative brief) |
| "Build a landing page for [offer]" | Agent 06 | Agent 04 (copy), Agent 14 (CRO) |
| "Launch Meta campaign for [client]" | Agent 07 | Agent 05 (creatives), Agent 02 (strategy) |
| "Launch Google campaign for [client]" | Agent 08 | Agent 02 (strategy) |
| "Run TikTok/LinkedIn/Pinterest ads" | Agent 09 | Agent 05 (creatives) |
| "Run SEO audit for [client]" | Agent 10 | Agent 03 (content strategy) |
| "Create social media calendar" | Agent 11 | Agent 03 (content strategy) |
| "Check brand sentiment for [client]" | Agent 12 | Agent 18 (historical data) |
| "Pull performance report" | Agent 13 | Agent 17 (budget data) |
| "Optimize conversion rates" | Agent 14 | Agent 06 (landing pages), Agent 13 (data) |
| "Check project status" | Agent 15 | All active agents |
| "Prepare client report" | Agent 16 | Agent 13 (performance data) |
| "Check budget pacing" | Agent 17 | Agent 13 (performance data) |
| "What did we learn from [campaign]?" | Agent 18 | — |

## Execution Policies

### Draft Mode Policy
All externally-visible outputs MUST be created in draft mode:
- Ad campaigns → Draft in platform (never auto-publish)
- Content pieces → Draft for human review
- Client reports → Draft for account manager review
- Email sequences → Draft for approval
- Landing pages → Staging URL for review

### Parallel Execution Rules
Agents may run in parallel when:
- They share the same campaign brief/context as input
- Their outputs do not depend on each other
- They are working on different deliverable types

Agents must run sequentially when:
- One agent's output is another's required input
- The campaign strategy has not yet been approved
- Quality checkpoint from a prior step has not passed

### Re-prompting Policy
When an agent's output fails quality checks:
1. First attempt: Re-prompt with specific feedback on what needs improvement
2. Second attempt: Re-prompt with additional context and examples
3. Third attempt: Escalate to human operator — do not re-prompt indefinitely

### Context Passing Protocol
When routing work to an agent, always include:
1. **Client context** from Agent 18's knowledge base
2. **Campaign brief** from Agent 02 (if applicable)
3. **Brand guidelines** (voice, tone, visual standards)
4. **Relevant historical data** from Agent 18
5. **Specific task instructions** with expected deliverables
6. **Deadline and priority level**
7. **Quality standards** applicable to this deliverable

## Priority Levels

| Priority | Response Time | Description |
|----------|---------------|-------------|
| **P0 - Critical** | Immediate | Crisis response, budget anomaly, campaign error |
| **P1 - Urgent** | Same day | Client request, campaign launch deadline |
| **P2 - Standard** | 1-2 days | Regular campaign work, content production |
| **P3 - Low** | This week | Optimization, reporting, analysis |
| **P4 - Background** | Ongoing | Monitoring, learning extraction, maintenance |

## Error Escalation Path

1. Agent detects issue → Logs error and notifies orchestrator
2. Orchestrator attempts automated resolution (re-routing, re-prompting)
3. If unresolved → Notifies Agent 15 (Workflow Orchestrator) for pipeline adjustment
4. If still unresolved → Escalates to human operator with full context
5. Resolution is logged by Agent 18 for future reference

## Inter-Agent Communication Format

When agents hand off work, they must use this standard format:

```
## Handoff: [Source Agent] → [Target Agent]
### Client: [Client Name]
### Campaign: [Campaign Name]
### Task: [Specific task description]
### Deliverables Attached:
- [List of deliverables with descriptions]
### Context Notes:
- [Any relevant context the receiving agent needs]
### Quality Status: [Passed / Needs Review / First Draft]
### Priority: [P0-P4]
### Deadline: [Date/Time]
```
