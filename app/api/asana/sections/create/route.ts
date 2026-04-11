import { asanaFetch } from "@/lib/asana";
import { requireAuth } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    const { pat, projectGid, name } = (await req.json()) as {
      pat?: string;
      projectGid?: string;
      name?: string;
    };

    if (!pat || !projectGid || !name) {
      return Response.json(
        { error: "PAT, project GID, and section name are required" },
        { status: 400 }
      );
    }

    const res = await asanaFetch<{ gid: string; name: string }>(
      pat,
      `/projects/${projectGid}/sections`,
      {
        method: "POST",
        body: JSON.stringify({ data: { name } }),
      }
    );

    return Response.json({ section: res.data });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const msg =
      error instanceof Error ? error.message : "Failed to create section";
    return Response.json({ error: msg }, { status: 500 });
  }
}
