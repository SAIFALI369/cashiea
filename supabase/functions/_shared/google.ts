// ════════════════════════════════════════════════════════════════
// Google token helper — tokens live only in connected_apps.
//
// Older installations used integrations.metadata. The migration copies those
// values once and removes the secret keys. The fallback below is retained only
// for a controlled rolling deploy; new callers must pass a connected_apps row
// (normally through a service-role client).
// ════════════════════════════════════════════════════════════════

interface GoogleConnection {
  id?: string
  user_id: string
  provider?: string
  app_slug?: string
  metadata?: Record<string, any> | null
  access_token?: string | null
  refresh_token?: string | null
  token_expires_at?: string | null
}

function tokenFields(connection: GoogleConnection) {
  const metadata = connection.metadata || {};
  const expiry = connection.token_expires_at
    ? new Date(connection.token_expires_at).getTime()
    : metadata.expires_at == null ? null : Number(metadata.expires_at);
  return {
    accessToken: connection.access_token ?? metadata.access_token ?? null,
    refreshToken: connection.refresh_token ?? metadata.refresh_token ?? null,
    expiresAt: Number.isFinite(expiry as number) ? expiry : null,
  };
}

export async function refreshGoogleToken(
  supabase: any,
  connection: GoogleConnection,
): Promise<string | null> {
  const { accessToken, refreshToken, expiresAt } = tokenFields(connection);
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const now = Date.now();

  if (accessToken && (!expiresAt || expiresAt > now + 60_000)) return accessToken;
  if (!refreshToken || !clientId || !clientSecret) return null;

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    if (!response.ok) return null;
    const tokens = await response.json();
    if (!tokens.access_token) return null;

    const nextExpiry = tokens.expires_in ? new Date(now + tokens.expires_in * 1000).toISOString() : null;
    if (connection.id && (connection.app_slug || connection.id)) {
      // connected_apps is the only supported token store. This query must use
      // the service-role client; browser-readable column grants exclude these
      // columns by design.
      await supabase.from("connected_apps").update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || refreshToken,
        token_expires_at: nextExpiry,
        status: "connected",
        updated_at: new Date().toISOString(),
      }).eq("id", connection.id);
    } else if (connection.provider) {
      // Rolling-deploy compatibility for a legacy row. Never put the refreshed
      // token back into metadata; metadata is browser-readable.
      const safeMetadata = { ...(connection.metadata || {}) };
      delete safeMetadata.access_token;
      delete safeMetadata.refresh_token;
      delete safeMetadata.expires_at;
      await supabase.from("integrations").update({
        metadata: safeMetadata,
        last_error: null,
      }).eq("user_id", connection.user_id).eq("provider", connection.provider);
    }
    return tokens.access_token as string;
  } catch {
    return null;
  }
}

/** Fetch recent Gmail messages (subject + snippet) for a connected account. */
export async function fetchGmail(accessToken: string, max = 25): Promise<{ subject: string; snippet: string; date: string }[]> {
  const safeMax = Math.max(1, Math.min(100, Math.floor(Number(max) || 25)));
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${safeMax}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) throw new Error(`Gmail API returned ${listRes.status}`);
  const payload = await listRes.json();
  const messages = Array.isArray(payload?.messages) ? payload.messages.slice(0, safeMax) : [];
  const out: { subject: string; snippet: string; date: string }[] = [];
  for (const message of messages) {
    try {
      const messageId = typeof message?.id === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(message.id) ? message.id : "";
      if (!messageId) continue;
      const messageRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!messageRes.ok) continue;
      const data = await messageRes.json();
      const headers = data.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === "Subject")?.value || "(no subject)";
      const from = headers.find((h: any) => h.name === "From")?.value || "";
      const date = headers.find((h: any) => h.name === "Date")?.value || "";
      out.push({ subject: `${String(subject).slice(0, 300)} — from ${String(from).slice(0, 300)}`.slice(0, 650), snippet: String(data.snippet || "").slice(0, 500), date: String(date).slice(0, 100) });
    } catch { /* skip an individual message */ }
  }
  return out;
}

/** Fetch rows from a Google Sheet by ID + range. */
export async function fetchSheet(accessToken: string, spreadsheetId: string, range = "A1:Z500"): Promise<Record<string, string>[]> {
  const safeSpreadsheetId = encodeURIComponent(String(spreadsheetId).slice(0, 200));
  const safeRange = encodeURIComponent(String(range).slice(0, 200));
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${safeSpreadsheetId}/values/${safeRange}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Google Sheets API returned ${response.status}`);
  const data = await response.json();
  const rows: string[][] = Array.isArray(data?.values) ? data.values.slice(0, 5_000) : [];
  if (rows.length < 2) return [];
  const headers = rows[0].map((header, index) => header || `col${index}`);
  return rows.slice(1).map((row) => {
    const result: Record<string, string> = {};
    headers.forEach((header, index) => { result[header] = (row[index] || "").toString(); });
    return result;
  });
}

export async function appendSheetRows(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  rows: (string | number)[][],
): Promise<{ ok: boolean; updatedCells: number; error?: string }> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ values: rows }),
      },
    );
    if (!response.ok) return { ok: false, updatedCells: 0, error: (await response.text()).slice(0, 300) };
    const data = await response.json();
    return { ok: true, updatedCells: data?.updates?.updatedCells || rows.flat().length };
  } catch (error) {
    return { ok: false, updatedCells: 0, error: (error as Error)?.message || "network error" };
  }
}

export async function createSpreadsheet(
  accessToken: string,
  title: string,
): Promise<{ ok: boolean; spreadsheetId?: string; url?: string; error?: string }> {
  try {
    const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ properties: { title } }),
    });
    if (!response.ok) return { ok: false, error: (await response.text()).slice(0, 300) };
    const data = await response.json();
    return { ok: true, spreadsheetId: data?.spreadsheetId, url: data?.spreadsheetUrl };
  } catch (error) {
    return { ok: false, error: (error as Error)?.message || "network error" };
  }
}

export async function writeSheetRange(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  rows: (string | number)[][],
): Promise<{ ok: boolean; updatedCells: number; error?: string }> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ values: rows }),
      },
    );
    if (!response.ok) return { ok: false, updatedCells: 0, error: (await response.text()).slice(0, 300) };
    const data = await response.json();
    return { ok: true, updatedCells: data?.updatedCells || rows.flat().length };
  } catch (error) {
    return { ok: false, updatedCells: 0, error: (error as Error)?.message || "network error" };
  }
}
