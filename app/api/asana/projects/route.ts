import { asanaFetch, AsanaProject } from "@/lib/asana";

export async function POST(req: Request) {
  try {
    const { pat, workspaceGid } = (await req.json()) as {
      pat?: string;
      workspaceGid?: string;
    };

    if (!pat || !workspaceGid) {
      return Response.json(
        { error: "PAT and workspace GID are required" },
        { status: 400 }
      );
    }

    const res = await asanaFetch<AsanaProject[]>(
      pat,
      `/workspaces/${workspaceGid}/projects?opt_fields=name,notes,color,archived&limit=100`
    );

    // Filter out archived projects
    const active = (res.data || []).filter((p) => !p.archived);

    return Response.json({ projects: active });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to fetch projects";
    return Response.json({ error: msg }, { status: 500 });
  }
}
