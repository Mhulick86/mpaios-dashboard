import { asanaFetch, AsanaUser, AsanaWorkspace } from "@/lib/asana";

export async function POST(req: Request) {
  try {
    const { pat } = (await req.json()) as { pat?: string };

    if (!pat) {
      return Response.json(
        { error: "Personal Access Token is required" },
        { status: 400 }
      );
    }

    // Validate token by fetching current user
    const userRes = await asanaFetch<AsanaUser>(pat, "/users/me");

    // Fetch workspaces
    const wsRes = await asanaFetch<AsanaWorkspace[]>(pat, "/workspaces");

    return Response.json({
      user: userRes.data,
      workspaces: wsRes.data,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to connect to Asana";
    return Response.json({ error: msg }, { status: 500 });
  }
}
