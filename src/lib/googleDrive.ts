// ─── Google Drive Integration Types & Helpers ───

const DRIVE_BASE = "https://www.googleapis.com/drive/v3";

/* ---------- Types ---------- */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  modifiedTime: string;
  webViewLink?: string;
  thumbnailLink?: string;
  size?: string;
  parents?: string[];
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface GoogleDriveConfig {
  accessToken: string;
  folderId: string;
  folderName: string;
  connected: boolean;
  connectedAt: string | null;
}

export function defaultDriveConfig(): GoogleDriveConfig {
  return {
    accessToken: "",
    folderId: "",
    folderName: "",
    connected: false,
    connectedAt: null,
  };
}

/* ---------- Readable file types ---------- */

const READABLE_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/csv",
  "text/html",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
];

export function isReadableFile(mimeType: string): boolean {
  return READABLE_MIME_TYPES.some(
    (t) => mimeType === t || mimeType.startsWith("text/")
  );
}

/* ---------- Fetch helper ---------- */

export async function driveFetch<T = unknown>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${DRIVE_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
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

/* ---------- List files in a folder ---------- */

export async function listFolderFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFile[]> {
  const query = `'${folderId}' in parents and trashed = false`;
  const fields =
    "files(id,name,mimeType,createdTime,modifiedTime,webViewLink,thumbnailLink,size,parents)";
  const res = await driveFetch<{ files: DriveFile[] }>(
    accessToken,
    `/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=createdTime desc&pageSize=50`
  );
  return res.files || [];
}

/* ---------- Download file content ---------- */

export async function downloadFileContent(
  accessToken: string,
  fileId: string,
  mimeType: string
): Promise<{ content: string | ArrayBuffer; exportedMime: string }> {
  // Google Docs/Sheets need export
  if (mimeType === "application/vnd.google-apps.document") {
    const res = await fetch(
      `${DRIVE_BASE}/files/${fileId}/export?mimeType=text/plain`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return { content: await res.text(), exportedMime: "text/plain" };
  }

  if (mimeType === "application/vnd.google-apps.spreadsheet") {
    const res = await fetch(
      `${DRIVE_BASE}/files/${fileId}/export?mimeType=text/csv`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    return { content: await res.text(), exportedMime: "text/csv" };
  }

  // Regular files — download binary
  const res = await fetch(`${DRIVE_BASE}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);

  if (mimeType.startsWith("text/") || mimeType === "text/csv") {
    return { content: await res.text(), exportedMime: mimeType };
  }

  return { content: await res.arrayBuffer(), exportedMime: mimeType };
}

/* ---------- List folders (for folder picker) ---------- */

export async function listFolders(
  accessToken: string
): Promise<DriveFolder[]> {
  const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const fields = "files(id,name)";
  const res = await driveFetch<{ files: DriveFolder[] }>(
    accessToken,
    `/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&orderBy=name&pageSize=100`
  );
  return res.files || [];
}
