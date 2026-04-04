/**
 * Workflow & Automation Engine
 * Event-driven workflows, background job processing, trigger-based actions
 */

import { createClient } from "@/lib/supabase/client";
import type { Workflow, WorkflowRun, WorkflowStep } from "@/lib/supabase/types";
import { agents } from "@/lib/agents";
import { logAuditEvent, trackTokenUsage } from "@/lib/observability";

const supabase = createClient();

// ── Workflow CRUD ──

export async function createWorkflow(params: {
  name: string;
  description?: string;
  pipelineId?: string;
  triggerType?: Workflow["trigger_type"];
  triggerConfig?: Record<string, unknown>;
  steps: WorkflowStep[];
}): Promise<Workflow | null> {
  const { data, error } = await supabase
    .from("workflows")
    .insert({
      name: params.name,
      description: params.description,
      pipeline_id: params.pipelineId,
      trigger_type: params.triggerType || "manual",
      trigger_config: params.triggerConfig || {},
      steps: params.steps,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create workflow:", error);
    return null;
  }

  await logAuditEvent({
    eventType: "workflow.created",
    resourceType: "workflow",
    resourceId: data.id,
    details: { name: params.name, stepCount: params.steps.length },
  });

  return data;
}

export async function getWorkflows(): Promise<Workflow[]> {
  const { data } = await supabase
    .from("workflows")
    .select("*")
    .order("updated_at", { ascending: false });
  return data || [];
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const { data } = await supabase.from("workflows").select("*").eq("id", id).single();
  return data;
}

export async function updateWorkflow(
  id: string,
  updates: Partial<Pick<Workflow, "name" | "description" | "steps" | "trigger_type" | "trigger_config" | "is_active">>
): Promise<Workflow | null> {
  const { data } = await supabase
    .from("workflows")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const { error } = await supabase.from("workflows").delete().eq("id", id);
  return !error;
}

// ── Workflow Execution ──

export async function executeWorkflow(
  workflowId: string,
  input: Record<string, unknown> = {},
  onStepUpdate?: (stepIndex: number, status: string, result?: Record<string, unknown>) => void
): Promise<WorkflowRun | null> {
  const workflow = await getWorkflow(workflowId);
  if (!workflow) return null;

  // Create run record
  const { data: run, error } = await supabase
    .from("workflow_runs")
    .insert({
      workflow_id: workflowId,
      status: "running",
      trigger: "manual",
      input,
      total_steps: workflow.steps.length,
    })
    .select()
    .single();

  if (error || !run) return null;

  await logAuditEvent({
    eventType: "workflow.started",
    resourceType: "workflow_run",
    resourceId: run.id,
    details: { workflowName: workflow.name },
  });

  const stepResults: Record<string, unknown>[] = [];
  let totalTokens = 0;
  let totalCost = 0;

  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const agent = agents.find((a) => a.id === step.agent_id);

      // Update run progress
      await supabase
        .from("workflow_runs")
        .update({ current_step: i, status: "running" })
        .eq("id", run.id);

      onStepUpdate?.(i, "running");

      // Record agent execution
      const { data: execution } = await supabase
        .from("agent_executions")
        .insert({
          workflow_run_id: run.id,
          agent_id: step.agent_id,
          agent_name: agent?.shortName || `Agent ${step.agent_id}`,
          division: agent?.divisionId,
          action: step.action,
          status: "running",
          input: { ...input, stepConfig: step.config },
        })
        .select()
        .single();

      const startTime = Date.now();

      try {
        // Execute the step via the chat API
        const result = await executeAgentStep(step, input, stepResults);
        const latency = Date.now() - startTime;

        // Estimate tokens (rough: 4 chars per token)
        const tokensEstimate = Math.ceil(
          (JSON.stringify(result).length + JSON.stringify(step).length) / 4
        );
        totalTokens += tokensEstimate;
        const stepCost = tokensEstimate * 0.000003; // rough estimate
        totalCost += stepCost;

        stepResults.push({ stepIndex: i, status: "completed", result, latency });

        if (execution) {
          await supabase
            .from("agent_executions")
            .update({
              status: "completed",
              output: result,
              latency_ms: latency,
              tokens_used: tokensEstimate,
              cost: stepCost,
              completed_at: new Date().toISOString(),
            })
            .eq("id", execution.id);
        }

        onStepUpdate?.(i, "completed", result);
      } catch (err) {
        const latency = Date.now() - startTime;
        const errorMsg = err instanceof Error ? err.message : "Step execution failed";

        stepResults.push({ stepIndex: i, status: "failed", error: errorMsg });

        if (execution) {
          await supabase
            .from("agent_executions")
            .update({
              status: "failed",
              error: errorMsg,
              latency_ms: latency,
              completed_at: new Date().toISOString(),
            })
            .eq("id", execution.id);
        }

        onStepUpdate?.(i, "failed");

        // Check if step is critical (no fallback)
        if (!step.config?.optional) {
          throw new Error(`Step ${i} failed: ${errorMsg}`);
        }
      }
    }

    // Mark workflow run as completed
    const { data: completedRun } = await supabase
      .from("workflow_runs")
      .update({
        status: "completed",
        step_results: stepResults,
        tokens_total: totalTokens,
        cost_total: totalCost,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .select()
      .single();

    // Update workflow stats
    await supabase
      .from("workflows")
      .update({
        run_count: workflow.run_count + 1,
        last_run_at: new Date().toISOString(),
      })
      .eq("id", workflowId);

    await logAuditEvent({
      eventType: "workflow.completed",
      resourceType: "workflow_run",
      resourceId: run.id,
      details: { steps: workflow.steps.length, totalTokens, totalCost },
    });

    return completedRun || run;
  } catch (err) {
    await supabase
      .from("workflow_runs")
      .update({
        status: "failed",
        step_results: stepResults,
        error: err instanceof Error ? err.message : "Workflow failed",
        tokens_total: totalTokens,
        cost_total: totalCost,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);

    return null;
  }
}

async function executeAgentStep(
  step: WorkflowStep,
  workflowInput: Record<string, unknown>,
  previousResults: Record<string, unknown>[]
): Promise<Record<string, unknown>> {
  // Call the chat API endpoint with agent-specific context
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: `Execute workflow step: ${step.action}\n\nDescription: ${step.description}\n\nContext from previous steps:\n${JSON.stringify(previousResults.slice(-3), null, 2)}\n\nWorkflow input:\n${JSON.stringify(workflowInput, null, 2)}`,
        },
      ],
      agentId: step.agent_id,
      isWorkflowStep: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Agent ${step.agent_id} returned ${response.status}`);
  }

  const text = await response.text();
  return { output: text, agentId: step.agent_id, action: step.action };
}

// ── Workflow Run History ──

export async function getWorkflowRuns(
  workflowId?: string,
  limit: number = 20
): Promise<WorkflowRun[]> {
  let query = supabase
    .from("workflow_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (workflowId) query = query.eq("workflow_id", workflowId);

  const { data } = await query;
  return data || [];
}

export async function cancelWorkflowRun(runId: string): Promise<boolean> {
  const { error } = await supabase
    .from("workflow_runs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", runId)
    .in("status", ["queued", "running", "paused"]);
  return !error;
}
