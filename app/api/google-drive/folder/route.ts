import { driveFetch, type DriveFolder } from "@/lib/googleDrive";

interface DriveCreateResponse {
  id: string;
  name: string;
  webViewLink: string;
}

export async function POST(req: Request) {
  try {
    const { accessToken, folderName, parentFolderId } = (await req.json()) as {
      accessToken?: string;
      folderName?: string;
      parentFolderId?: string;
    };

    if (!accessToken) {
      return Response.json(
        { error: "Google OAuth access token is required" },
        { status: 400 }
      );
    }
    if (!folderName) {
      return Response.json(
        { error: "folderName is required" },
        { status: 400 }
      );
    }

    const metadata: Record<string, unknown> = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
    }

    const folder = await driveFetch<DriveCreateResponse>(
      accessToken,
      "/files?fields=id,name,webViewLink",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      }
    );

    return Response.json({
      success: true,
      folder: folder as DriveFolder,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to create Google Drive folder";
    return Response.json({ error: msg }, { status: 500 });
  }
}
