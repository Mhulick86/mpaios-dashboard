import { asanaFetch } from "@/lib/asana";

export async function POST(req: Request) {
  try {
    const { pat, taskGid, sectionGid } = (await req.json()) as {
      pat?: string;
      taskGid?: string;
      sectionGid?: string;
    };

    if (!pat || !taskGid || !sectionGid) {
      return Response.json(
        { error: "PAT, task GID, and section GID are required" },
        { status: 400 }
      );
    }

    const res = await asanaFetch<Record<string, never>>(
      pat,
      `/sections/${sectionGid}/addTask`,
      {
        method: "POST",
        body: JSON.stringify({ data: { task: taskGid } }),
      }
    );

    return Response.json({ success: true, data: res.data });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to move task";
    return Response.json({ error: msg }, { status: 500 });
  }
}
