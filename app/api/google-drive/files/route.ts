import { driveFetch, type DriveFile } from "@/lib/googleDrive";

interface DriveFileList {
  files: DriveFile[];
  nextPageToken?: string;
}

export async function POST(req: Request) {
  try {
    const { accessToken, folderId, pageToken } = (await req.json()) as {
      accessToken?: string;
      folderId?: string;
      pageToken?: string;
    };

    if (!accessToken) {
      return Response.json(
        { error: "Google OAuth access token is required" },
        { status: 400 }
      );
    }

    const parentQuery = folderId
      ? `'${folderId}' in parents and `
      : "";
    const q = encodeURIComponent(
      `${parentQuery}trashed = false`
    );
    const fields = encodeURIComponent(
      "files(id,name,mimeType,webViewLink,webContentLink,size,modifiedTime,createdTime,iconLink),nextPageToken"
    );

    let endpoint = `/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=50`;
    if (pageToken) {
      endpoint += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const result = await driveFetch<DriveFileList>(accessToken, endpoint);

    return Response.json({
      files: result.files || [],
      nextPageToken: result.nextPageToken || null,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to list Google Drive files";
    return Response.json({ error: msg }, { status: 500 });
  }
}
