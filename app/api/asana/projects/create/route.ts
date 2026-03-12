import { asanaFetch } from "@/lib/asana";

export async function POST(req: Request) {
  try {
    const { pat, workspaceGid, teamGid, name, notes, color } =
      (await req.json()) as {
        pat?: string;
        workspaceGid?: string;
        teamGid?: string;
        name?: string;
        notes?: string;
        color?: string;
      };

    if (!pat || !workspaceGid || !name) {
      return Response.json(
        { error: "PAT, workspace GID, and project name are required" },
        { status: 400 }
      );
    }

    const projectData: Record<string, unknown> = {
      name,
      workspace: workspaceGid,
      default_view: "board",
    };

    if (teamGid) projectData.team = teamGid;
    if (notes) projectData.notes = notes;
    if (color) projectData.color = color;

    const res = await asanaFetch<{ gid: string; name: string }>(
      pat,
      "/projects",
      {
        method: "POST",
        body: JSON.stringify({ data: projectData }),
      }
    );

    return Response.json({ project: res.data });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to create project";
    return Response.json({ error: msg }, { status: 500 });
  }
}
