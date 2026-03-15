import { listFolders } from "@/lib/googleDrive";

export async function POST(req: Request) {
  try {
    const { accessToken } = (await req.json()) as { accessToken?: string };

    if (!accessToken) {
      return Response.json(
        { error: "Access token is required" },
        { status: 400 }
      );
    }

    const folders = await listFolders(accessToken);
    return Response.json({ folders });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to list folders";
    return Response.json({ error: msg }, { status: 500 });
  }
}
