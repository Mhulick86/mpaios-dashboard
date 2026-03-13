import { driveUploadMultipart } from "@/lib/googleDrive";

export async function POST(req: Request) {
  try {
    const { accessToken, fileName, content, folderId, mimeType } =
      (await req.json()) as {
        accessToken?: string;
        fileName?: string;
        content?: string;
        folderId?: string;
        mimeType?: string;
      };

    if (!accessToken) {
      return Response.json(
        { error: "Google OAuth access token is required" },
        { status: 400 }
      );
    }
    if (!fileName || !content) {
      return Response.json(
        { error: "fileName and content are required" },
        { status: 400 }
      );
    }

    const result = await driveUploadMultipart(
      accessToken,
      fileName,
      content,
      mimeType || "text/markdown",
      folderId || undefined
    );

    return Response.json({
      success: true,
      file: result,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to upload file to Google Drive";
    return Response.json({ error: msg }, { status: 500 });
  }
}
