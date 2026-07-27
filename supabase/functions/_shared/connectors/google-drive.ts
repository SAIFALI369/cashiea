// ════════════════════════════════════════════════════════════════
// Google Drive Connector — reads the *content* of files the owner has
// explicitly picked (drive.file scope). Used by Meraj for live context.
// ════════════════════════════════════════════════════════════════

import { refreshGoogleToken } from "../google.ts";

export interface DriveFile {
  id: string
  name: string
  mimeType: string
}

/** Resolve a fresh access token from a connected_apps row (refreshes if expired). */
export async function getDriveToken(supabase: any, conn: any): Promise<string | null> {
  return await refreshGoogleToken(supabase, {
    user_id: conn.user_id,
    provider: "google_drive",
    metadata: {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : null,
    },
  });
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
  try {
    const exportMap: Record<string, string> = {
      "application/vnd.google-apps.document": "text/plain",
      "application/vnd.google-apps.spreadsheet": "text/csv",
      "application/vnd.google-apps.presentation": "text/plain",
    };
    if (exportMap[mimeType]) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${id}/export?mimeType=${encodeURIComponent(exportMap[mimeType])}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!res.ok) return null;
      const text = await res.text();
      return { name, mimeType, text: text.slice(0, 8000) };
    }
    if (/text\/|csv|json|markdown|xml/.test(mimeType) || /\.(txt|csv|json|md|xml)$/i.test(name)) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
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
