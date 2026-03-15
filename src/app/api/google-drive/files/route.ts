import { listFolderFiles } from "@/lib/googleDrive";

export async function POST(req: Request) {
  try {
    const { accessToken, folderId } = (await req.json()) as {
      accessToken?: string;
      folderId?: string;
    };

    if (!accessToken || !folderId) {
      return Response.json(
        { error: "Access token and folder ID are required" },
        { status: 400 }
      );
    }

    const files = await listFolderFiles(accessToken, folderId);
    return Response.json({ files });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to list files";
    return Response.json({ error: msg }, { status: 500 });
  }
}
