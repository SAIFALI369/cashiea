// ════════════════════════════════════════════════════════════════
// Google token refresh helper — shared by google-fetch and daily-brain.
// If an access token is expired, refreshes it using the stored refresh
// token and updates the integration row. Returns a valid access token
// (or null if not refreshable).
// ════════════════════════════════════════════════════════════════

export async function refreshGoogleToken(
  supabase: any,
  integration: { user_id: string; provider: string; metadata: any }
): Promise<string | null> {
  const meta = integration.metadata || {};
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  const now = Date.now();

  // Still valid?
  if (meta.access_token && (!meta.expires_at || meta.expires_at > now + 60_000)) {
    return meta.access_token as string;
  }

  // Need a refresh token to renew
  if (!meta.refresh_token || !clientId || !clientSecret) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: meta.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const tokens = await res.json();

    // Persist the refreshed tokens
    await supabase.from("integrations").update({
      metadata: {
        ...meta,
        access_token: tokens.access_token,
        expires_at: tokens.expires_in ? now + tokens.expires_in * 1000 : null,
      },
    }).eq("user_id", integration.user_id).eq("provider", integration.provider);

    return tokens.access_token as string;
  } catch {
    return null;
  }
}

/**
 * Fetch recent Gmail messages (subject + snippet) for a user's connection.
 * Returns an array of { subject, snippet, date }.
 */
export async function fetchGmail(accessToken: string, max = 25): Promise<{ subject: string; snippet: string; date: string }[]> {
  // List recent message IDs
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${max}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) return [];
  const { messages = [] } = await listRes.json();

  const out: { subject: string; snippet: string; date: string }[] = [];
  for (const m of messages) {
    try {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();
      const headers = msg.payload?.headers || [];
      const subject = headers.find((h: any) => h.name === "Subject")?.value || "(no subject)";
      const from = headers.find((h: any) => h.name === "From")?.value || "";
      const date = headers.find((h: any) => h.name === "Date")?.value || "";
      out.push({ subject: `${subject} — from ${from}`, snippet: (msg.snippet || "").slice(0, 300), date });
    } catch { /* skip this message */ }
  }
  return out;
}

/**
 * Fetch rows from a Google Sheet by ID + range.
 * Returns an array of row objects using the first row as headers.
 */
export async function fetchSheet(accessToken: string, spreadsheetId: string, range = "A1:Z500"): Promise<Record<string, string>[]> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const rows: string[][] = data.values || [];
  if (rows.length < 2) return [];
  const headers = rows[0].map((h, i) => h || `col${i}`);
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = (row[i] || "").toString(); });
    return obj;
  });
}
