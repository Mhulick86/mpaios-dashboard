import { driveFetch, type DriveAbout } from "@/lib/googleDrive";
import { requireAuth } from "@/lib/apiAuth";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth();
    const { accessToken } = (await req.json()) as { accessToken?: string };

    if (!accessToken) {
      return Response.json(
        { error: "Google OAuth access token is required" },
        { status: 400 }
      );
    }

    const about = await driveFetch<DriveAbout>(
      accessToken,
      "/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage)"
    );

    return Response.json({
      success: true,
      user: about.user,
      storageQuota: about.storageQuota,
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to connect to Google Drive";
    return Response.json({ error: msg }, { status: 500 });
  }
}
