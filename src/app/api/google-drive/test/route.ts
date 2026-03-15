import { driveFetch } from "@/lib/googleDrive";

export async function POST(req: Request) {
  try {
    const { accessToken } = (await req.json()) as { accessToken?: string };

    if (!accessToken) {
      return Response.json(
        { error: "Access token is required" },
        { status: 400 }
      );
    }

    // Test by fetching user info
    const user = await driveFetch<{ user: { displayName: string; emailAddress: string } }>(
      accessToken,
      "https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)"
    );

    return Response.json({
      success: true,
      user: user.user,
    });
  } catch (error: unknown) {
    const msg =
      error instanceof Error ? error.message : "Failed to connect to Google Drive";
    return Response.json({ error: msg }, { status: 500 });
  }
}
