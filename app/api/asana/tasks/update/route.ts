import { asanaFetch } from "@/lib/asana";

export async function POST(req: Request) {
  try {
    const { pat, taskGid, completed, name, notes } = (await req.json()) as {
      pat?: string;
      taskGid?: string;
      completed?: boolean;
      name?: string;
      notes?: string;
    };

    if (!pat || !taskGid) {
      return Response.json(
        { error: "PAT and task GID are required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (completed !== undefined) updateData.completed = completed;
    if (name !== undefined) updateData.name = name;
    if (notes !== undefined) updateData.notes = notes;

    const res = await asanaFetch<{ gid: string; name: string }>(
      pat,
      `/tasks/${taskGid}`,
      {
        method: "PUT",
        body: JSON.stringify({ data: updateData }),
      }
    );

    return Response.json({ task: res.data });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to update task";
    return Response.json({ error: msg }, { status: 500 });
  }
}
