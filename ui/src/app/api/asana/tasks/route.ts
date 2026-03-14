import { asanaFetch, AsanaTask } from "@/lib/asana";

export async function POST(req: Request) {
  try {
    const { pat, projectGid, completed } = (await req.json()) as {
      pat?: string;
      projectGid?: string;
      completed?: boolean;
    };

    if (!pat || !projectGid) {
      return Response.json(
        { error: "PAT and project GID are required" },
        { status: 400 }
      );
    }

    let endpoint = `/projects/${projectGid}/tasks?opt_fields=name,assignee.name,due_on,completed,notes&limit=100`;

    // If we only want incomplete tasks
    if (completed === false) {
      endpoint += "&completed_since=now";
    }

    const res = await asanaFetch<AsanaTask[]>(pat, endpoint);

    return Response.json({ tasks: res.data || [] });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to fetch tasks";
    return Response.json({ error: msg }, { status: 500 });
  }
}
