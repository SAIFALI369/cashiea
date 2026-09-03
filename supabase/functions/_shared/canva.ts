// ════════════════════════════════════════════════════════════════
// Canva Connect API helper — token refresh + read designs/assets.
// Used by canva-oauth, integrations-api, and (future) Meraj.
//
// Secrets: CANVA_CLIENT_ID, CANVA_CLIENT_SECRET (from the Canva Developer Portal).
// Token endpoint: https://api.canva.com/rest/v1/oauth/token
// ════════════════════════════════════════════════════════════════

const CLIENT_ID = Deno.env.get("CANVA_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("CANVA_CLIENT_SECRET");
const TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

export function isCanvaConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET);
}

// Normalize either a connected_apps row or an integrations.metadata shape.
function tokenFields(conn: any) {
  const meta = conn.metadata || {};
  return {
    access_token: conn.access_token ?? meta.access_token,
    refresh_token: conn.refresh_token ?? meta.refresh_token,
    expires_at: conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : (meta.expires_at ?? null),
  };
}

/** Return a valid access token, refreshing if expired. Updates connected_apps on refresh. */
export async function refreshCanvaToken(supabase: any, conn: any): Promise<string | null> {
  const t = tokenFields(conn);
  if (t.access_token && (!t.expires_at || t.expires_at > Date.now() + 60_000)) return t.access_token;
  if (!t.refresh_token || !CLIENT_ID || !CLIENT_SECRET) return null;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${CLIENT_ID}:${CLIENT_SECRET}`)}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: t.refresh_token,
      }),
    });
    if (!res.ok) return null;
    const tk = await res.json();
    // Persist refreshed token (best-effort, whichever table the caller used)
    try {
      await supabase.from("connected_apps").update({
        access_token: tk.access_token,
        refresh_token: tk.refresh_token || t.refresh_token,
        token_expires_at: tk.expires_in ? new Date(Date.now() + tk.expires_in * 1000).toISOString() : null,
      }).eq("id", conn.id);
    } catch { /* integrations-table callers have no id here */ }
    return tk.access_token as string;
  } catch {
    return null;
  }
}

/** List the user's recent designs (id, name, thumbnail). */
export async function listDesigns(accessToken: string, max = 20): Promise<{ id: string; name: string; thumbnail?: string }[]> {
  try {
    const res = await fetch("https://api.canva.com/rest/v1/designs", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    const items = data.items || data.designs || [];
    return items.slice(0, max).map((d: any) => ({ id: d.id, name: d.name, thumbnail: d.thumbnail?.url }));
  } catch {
    return [];
  }
}
