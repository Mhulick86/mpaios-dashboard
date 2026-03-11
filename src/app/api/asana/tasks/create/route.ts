import { asanaFetch, AsanaTask } from "@/lib/asana";

export async function POST(req: Request) {
  try {
    const { pat, name, notes, projectGid, assignee, dueOn } =
      (await req.json()) as {
        pat?: string;
        name?: string;
        notes?: string;
        projectGid?: string;
        assignee?: string;
        dueOn?: string;
      };

    if (!pat || !name || !projectGid) {
      return Response.json(
        { error: "PAT, task name, and project GID are required" },
        { status: 400 }
      );
    }

    const taskData: Record<string, unknown> = {
      name,
      projects: [projectGid],
    };

    if (notes) taskData.notes = notes;
    if (assignee) taskData.assignee = assignee;
    if (dueOn) taskData.due_on = dueOn;

    const res = await asanaFetch<AsanaTask>(pat, "/tasks", {
      method: "POST",
      body: JSON.stringify({ data: taskData }),
    });

    return Response.json({ task: res.data });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to create task";
    return Response.json({ error: msg }, { status: 500 });
  }
}
