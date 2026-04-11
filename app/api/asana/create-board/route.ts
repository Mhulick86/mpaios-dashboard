/**
 * Creates a full Asana project board with sections, tasks, and subtasks.
 * Used by the client when executing ASANA_CREATE markers from local LLM responses.
 */

import { asanaFetch } from "@/lib/asana";

export async function POST(req: Request) {
  const { pat, workspaceGid, board } = await req.json();

  if (!pat || !workspaceGid || !board?.project_name || !board?.tasks?.length) {
    return Response.json(
      { success: false, error: "Missing pat, workspaceGid, or board data" },
      { status: 400 }
    );
  }

  try {
    // Fetch team (required for org workspaces)
    let teamGid: string | undefined;
    try {
      const teamsRes = await asanaFetch<Array<{ gid: string }>>(
        pat,
        `/workspaces/${workspaceGid}/teams?limit=1`
      );
      teamGid = teamsRes.data?.[0]?.gid;
    } catch {
      // Personal workspace — no team needed
    }

    // 1. Create project
    const projectBody: Record<string, unknown> = {
      data: {
        name: board.project_name,
        workspace: workspaceGid,
        layout: "board",
        notes: `Created by MPAIOS Orchestrator — ${new Date().toLocaleString()}`,
      },
    };
    if (teamGid) {
      (projectBody.data as Record<string, unknown>).team = teamGid;
    }

    const projRes = await asanaFetch<{ gid: string; name: string }>(
      pat,
      `/projects`,
      { method: "POST", body: JSON.stringify(projectBody) }
    );
    const projectGid = projRes.data.gid;

    // 2. Create sections
    const sectionNames: string[] = board.sections?.length ? board.sections : ["To Do"];
    const sectionMap: Record<string, string> = {};
    for (const secName of sectionNames) {
      const secRes = await asanaFetch<{ gid: string }>(
        pat,
        `/projects/${projectGid}/sections`,
        { method: "POST", body: JSON.stringify({ data: { name: secName } }) }
      );
      sectionMap[secName] = secRes.data.gid;
    }
    const defaultSectionGid = sectionMap[sectionNames[0]];

    // 3. Create tasks and subtasks
    let taskCount = 0;
    let subtaskCount = 0;
    for (const taskDef of board.tasks) {
      const taskRes = await asanaFetch<{ gid: string }>(
        pat,
        `/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            data: {
              name: taskDef.name,
              notes: taskDef.notes || "",
              projects: [projectGid],
              memberships: [{ project: projectGid, section: defaultSectionGid }],
            },
          }),
        }
      );
      taskCount++;

      if (taskDef.subtasks?.length) {
        for (const sub of taskDef.subtasks) {
          await asanaFetch(
            pat,
            `/tasks/${taskRes.data.gid}/subtasks`,
            {
              method: "POST",
              body: JSON.stringify({
                data: { name: sub.name, notes: sub.notes || "" },
              }),
            }
          );
          subtaskCount++;
        }
      }
    }

    return Response.json({
      success: true,
      projectGid,
      summary: `${board.project_name} — ${taskCount} tasks, ${subtaskCount} subtasks`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
}
