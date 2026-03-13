// ─── Google Drive Integration Types & Helpers ───

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";

/* ---------- Types ---------- */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  modifiedTime?: string;
  createdTime?: string;
  parents?: string[];
  iconLink?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface DriveUploadResult {
  id: string;
  name: string;
  webViewLink: string;
  mimeType: string;
}

export interface DrivePermission {
  id: string;
  type: string;
  role: string;
  emailAddress?: string;
}

export interface DriveUser {
  displayName: string;
  emailAddress: string;
  photoLink?: string;
}

export interface DriveAbout {
  user: DriveUser;
  storageQuota?: {
    limit: string;
    usage: string;
  };
}

/* ---------- Fetch helper ---------- */

export async function driveFetch<T = unknown>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const isAbsoluteUrl = endpoint.startsWith("https://");
  const url = isAbsoluteUrl ? endpoint : `${DRIVE_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Google Drive API error (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.error?.message) {
        message = parsed.error.message;
      }
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  return res.json();
}

/* ---------- Upload helper ---------- */

export async function driveUploadMultipart(
  accessToken: string,
  fileName: string,
  content: string,
  mimeType: string,
  folderId?: string
): Promise<DriveUploadResult> {
  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType,
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = "mpaios_upload_boundary";
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n` +
    `${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(
    `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink,mimeType`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    let message = `Drive upload error (${res.status})`;
    try {
      const parsed = JSON.parse(errBody);
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      if (errBody) message = errBody;
    }
    throw new Error(message);
  }

  return res.json();
}

/* ---------- Utilities ---------- */

export function formatDriveFileSize(bytes: string | number): string {
  const b = typeof bytes === "string" ? parseInt(bytes, 10) : bytes;
  if (isNaN(b) || b === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(b) / Math.log(1024));
  return `${(b / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDriveDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
