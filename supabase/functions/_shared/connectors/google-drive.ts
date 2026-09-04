// ════════════════════════════════════════════════════════════════
// Google Drive Connector — reads the *content* of files the owner selected
// through the server-mediated read-only browser flow. Used by Meraj for live context.
// ════════════════════════════════════════════════════════════════

import { refreshGoogleToken } from "../google.ts";

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
}

/** List basic metadata the server-side OAuth connection can access. The access
 * token never leaves the edge function. The caller receives metadata only;
 * selected file content is fetched separately by the server. */
export async function listDriveFiles(accessToken: string, max = 100): Promise<DriveFile[]> {
  try {
    const params = new URLSearchParams({
      q: "trashed = false",
      fields: "files(id,name,mimeType,modifiedTime),nextPageToken",
      pageSize: String(Math.max(1, Math.min(max, 100))),
      orderBy: "modifiedTime desc",
    });
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (Array.isArray(data?.files) ? data.files : []).map((file: any) => ({
      id: String(file.id || ""),
      name: String(file.name || "File").slice(0, 200),
      mimeType: String(file.mimeType || "").slice(0, 200),
      modifiedTime: typeof file.modifiedTime === "string" ? file.modifiedTime : undefined,
    })).filter((file: DriveFile) => /^[A-Za-z0-9_-]{1,200}$/.test(file.id));
  } catch {
    return [];
  }
}

/** Resolve a fresh access token from a connected_apps row (refreshes if expired). */
export async function getDriveToken(supabase: any, conn: any): Promise<string | null> {
  return await refreshGoogleToken(supabase, { ...conn, provider: "google_drive", app_slug: "google-drive" });
}

/**
 * Read the text content of a single Drive file the app has access to.
 * Handles Google Docs/Sheets/Slides (export) + plain text/CSV/JSON/MD/XML (download).
 * Returns null for binary/unsupported types so callers can skip gracefully.
 */
export async function readDriveFile(
  accessToken: string,
  file: DriveFile
): Promise<{ name: string; mimeType: string; text: string } | null> {
  const { id, mimeType, name } = file;
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(String(id || ""))) return null;
  try {
    const exportMap: Record<string, string> = {
      "application/vnd.google-apps.document": "text/plain",
      "application/vnd.google-apps.spreadsheet": "text/csv",
      "application/vnd.google-apps.presentation": "text/plain",
    };
    if (exportMap[mimeType]) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent(exportMap[mimeType])}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return null;
      const text = await res.text();
      return { name, mimeType, text: text.slice(0, 8000) };
    }
    if (/text\/|csv|json|markdown|xml/.test(mimeType) || /\.(txt|csv|json|md|xml)$/i.test(name)) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return null;
      const text = await res.text();
      return { name, mimeType, text: text.slice(0, 8000) };
    }
    return null;
  } catch {
    return null;
  }
}
