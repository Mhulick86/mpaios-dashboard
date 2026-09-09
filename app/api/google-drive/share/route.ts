import { driveFetch, type DrivePermission } from "@/lib/googleDrive";
import { requireRole } from "@/lib/apiAuth";

const SHARE_ROLES = new Set(["reader", "writer", "commenter"]);

export async function POST(req: Request) {
  try {
    await requireRole("admin");
    const { accessToken, fileId, email, role } = (await req.json()) as {
      accessToken?: string;
      fileId?: string;
      email?: string;
      role?: "reader" | "writer" | "commenter";
    };

    if (!accessToken) {
      return Response.json(
        { error: "Google OAuth access token is required" },
        { status: 400 }
      );
    }
    if (!fileId || !email) {
      return Response.json(
        { error: "fileId and email are required" },
        { status: 400 }
      );
    }
    if (role && !SHARE_ROLES.has(role)) {
      return Response.json(
        { error: "role must be one of reader, writer, commenter" },
        { status: 400 }
      );
    }

    const permission = await driveFetch<DrivePermission>(
      accessToken,
      `/files/${encodeURIComponent(fileId)}/permissions?fields=id,type,role,emailAddress`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "user",
          role: role || "reader",
          emailAddress: email,
        }),
      }
    );

    return Response.json({
      success: true,
      permission,
    });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    const msg =
      error instanceof Error
        ? error.message
        : "Failed to share Google Drive file";
    return Response.json({ error: msg }, { status: 500 });
  }
}
