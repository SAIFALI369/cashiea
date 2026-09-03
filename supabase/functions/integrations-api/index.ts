// ════════════════════════════════════════════════════════════════
// Integrations API — authenticated control plane for connected apps.
// Browser responses contain status/metadata only. OAuth access and refresh
// tokens are loaded with the service role inside this edge function.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import * as SheetsConnector from "../_shared/connectors/google-sheets.ts";
import { refreshGoogleToken } from "../_shared/google.ts";
import { getDriveToken, listDriveFiles } from "../_shared/connectors/google-drive.ts";
import { refreshCanvaToken, listDesigns as canvaListDesigns } from "../_shared/canva.ts";
import { resolveBusiness } from "../_shared/business.ts";

const APP_SLUGS = ["google-sheets", "gmail", "google-drive", "canva"] as const;
type AppSlug = (typeof APP_SLUGS)[number];
const SAFE_CONNECTION_FIELDS = "id,user_id,app_slug,app_name,provider_account_id,provider_email,permission_mode,scopes_granted,status,last_synced_at,metadata,created_at,updated_at";

// Metadata is intentionally user-visible, so treat it as hostile legacy data.
// Do not rely on a migration having already scrubbed every old integrations row.
function sanitizeMetadata(value: unknown, depth = 0): unknown {
  if (depth > 5 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== "object") return value;
  const secretKey = /(access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|password|authorization|bearer|secret|(^|[_-])token($|[_-])|token[_-]?expires)/i;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !secretKey.test(key))
    .slice(0, 100)
    .map(([key, item]) => [key, sanitizeMetadata(item, depth + 1)]));
}

function safeConnection(connection: any): Record<string, unknown> | null {
  if (!connection) return null;
  return {
    id: connection.id,
    user_id: connection.user_id,
    app_slug: connection.app_slug,
    app_name: connection.app_name,
    provider_account_id: connection.provider_account_id,
    provider_email: connection.provider_email,
    permission_mode: connection.permission_mode,
    scopes_granted: connection.scopes_granted,
    status: connection.status,
    last_synced_at: connection.last_synced_at,
    metadata: sanitizeMetadata(connection.metadata || {}),
    created_at: connection.created_at,
    updated_at: connection.updated_at,
  };
}

function validAppSlug(value: unknown): value is AppSlug {
  return typeof value === "string" && (APP_SLUGS as readonly string[]).includes(value);
}

async function validatePickedFile(token: string, file: any): Promise<{ id: string; name: string; mimeType: string } | null> {
  const id = String(file?.id || "");
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) return null;
  try {
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,mimeType`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return { id: data.id, name: String(data.name || file.name || "File").slice(0, 200), mimeType: String(data.mimeType || file.mimeType || "").slice(0, 200) };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") || "" } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const business = await resolveBusiness(service, user.id);
    if (!business) return json({ error: "Your business profile could not be verified" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const appSlug = body.app_slug || "google-sheets";
    if (!validAppSlug(appSlug)) return json({ error: "Unsupported app" }, 400);
    // Integration connections and their provider data are an owner control
    // plane. Route guards are only UX; enforce the policy at the edge too.
    if (action !== "status" && !business.isOwner) return json({ error: "Only the business owner can manage integrations" }, 403);

    // ─── STATUS: explicit safe columns only ─────────────────────
    if (action === "status") {
      const { data: connection } = await supabase.from("connected_apps")
        .select(SAFE_CONNECTION_FIELDS).eq("user_id", user.id).eq("app_slug", appSlug).maybeSingle();
      const { data: logs } = await supabase.from("integration_audit_logs")
        .select("action_type,status,error_message,created_at").eq("user_id", user.id).eq("app_slug", appSlug)
        .order("created_at", { ascending: false }).limit(10);
      return json({ connection: safeConnection(connection), auditLogs: logs || [] });
    }

    // Token-bearing connection reads are service-role-only and always scoped by
    // the authenticated user's id, so a body cannot select another account.
    const { data: connection } = await service.from("connected_apps")
      .select("*").eq("user_id", user.id).eq("app_slug", appSlug).maybeSingle();
    if (!connection || connection.status !== "connected") return json({ error: `${appSlug} is not connected` }, 400);

    const log = async (actionType: string, status = "success", errorMessage: string | null = null, metadata: Record<string, unknown> = {}) => {
      await service.from("integration_audit_logs").insert({
        user_id: user.id, app_slug: appSlug, action_type: actionType, status,
        error_message: errorMessage, metadata,
      });
    };

    // ─── TEST ───────────────────────────────────────────────────
    if (action === "test") {
      if (appSlug === "canva") {
        const ok = !!await refreshCanvaToken(service, connection);
        await log("connection_tested", ok ? "success" : "failed", ok ? null : "Token expired — reconnect");
        return json({ ok, message: ok ? "Canva connection healthy" : "Token expired — reconnect" });
      }
      if (appSlug === "gmail") {
        const ok = !!await refreshGoogleToken(service, { ...connection, provider: "gmail", app_slug: "gmail" });
        await log("connection_tested", ok ? "success" : "failed", ok ? null : "Token expired — reconnect");
        return json({ ok, message: ok ? "Gmail connection healthy" : "Token expired — reconnect" });
      }
      const result = await SheetsConnector.testConnection(service, { ...connection, app_slug: appSlug } as any);
      await log("connection_tested", result.ok ? "success" : "failed", result.ok ? null : result.message);
      return json(result);
    }

    // A Sheets connection needs an explicit spreadsheet before live sync and
    // Meraj import/export can do anything useful. Store only a validated ID and
    // non-secret display metadata; the access token remains in connected_apps.
    // Validation uses the Sheets API rather than Drive listing, so a least-
    // privilege spreadsheets.readonly connection is sufficient.
    if (appSlug === "google-sheets" && action === "save_spreadsheet") {
      const spreadsheetId = String(body.spreadsheet_id || "").trim();
      if (!/^[A-Za-z0-9_-]{1,200}$/.test(spreadsheetId)) return json({ error: "Valid spreadsheet ID or URL required" }, 400);
      const token = await refreshGoogleToken(service, { ...connection, app_slug: "google-sheets", provider: "google_sheets" });
      if (!token) return json({ error: "Token expired — reconnect Google Sheets" }, 401);
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,spreadsheetUrl`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return json({ error: "Cashiea could not access that spreadsheet. Check the ID, sharing, and Google permission." }, 400);
      const sheet = await response.json();
      const metadata = { ...(connection.metadata || {}), spreadsheet_id: spreadsheetId, spreadsheet_name: String(sheet.properties?.title || "Spreadsheet").slice(0, 200), spreadsheet_url: String(sheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`).slice(0, 500) };
      const { error: saveError } = await service.from("connected_apps").update({ metadata, last_synced_at: new Date().toISOString() }).eq("id", connection.id).eq("user_id", user.id);
      if (saveError) return json({ error: "Could not save spreadsheet selection" }, 503);
      await log("data_read", "success", null, { spreadsheet_id: spreadsheetId });
      return json({ ok: true, spreadsheet: { id: spreadsheetId, name: metadata.spreadsheet_name, url: metadata.spreadsheet_url } });
    }

    if (appSlug === "google-sheets" && action === "clear_spreadsheet") {
      const metadata = { ...(connection.metadata || {}) };
      delete metadata.spreadsheet_id;
      delete metadata.spreadsheet_name;
      delete metadata.spreadsheet_url;
      const { error: clearError } = await service.from("connected_apps").update({ metadata, last_synced_at: null }).eq("id", connection.id).eq("user_id", user.id);
      if (clearError) return json({ error: "Could not clear spreadsheet selection" }, 503);
      await log("data_read", "success", null, { cleared_spreadsheet: true });
      return json({ ok: true });
    }

    if (["list_sheets", "read", "write", "sync"].includes(action) && appSlug !== "google-sheets") {
      return json({ error: "This action is only available for Google Sheets" }, 400);
    }

    if (appSlug === "google-sheets" && ["list_sheets", "read", "write", "sync"].includes(action)) {
      const connector = { ...connection, app_slug: appSlug } as any;
      if (action === "list_sheets") {
        const sheets = await SheetsConnector.listSpreadsheets(service, connector);
        await log("data_read", "success", null, { count: sheets.length });
        return json({ sheets });
      }
      if (action === "read") {
        const spreadsheetId = String(body.spreadsheet_id || "");
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(spreadsheetId)) return json({ error: "Valid spreadsheet_id required" }, 400);
        const data = await SheetsConnector.readSheetData(service, connector, spreadsheetId, String(body.range || "A1:Z1000"));
        await log("data_read", "success", null, { rows: data.length });
        return json({ rows: data.length, data });
      }
      if (action === "write") {
        const spreadsheetId = String(body.spreadsheet_id || "");
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(spreadsheetId) || !Array.isArray(body.values)) return json({ error: "spreadsheet_id and values[] required" }, 400);
        if (!body.confirmed) return json({ error: "Write confirmation required. Set confirmed: true." }, 403);
        if (body.values.length > 5000) return json({ error: "Write is limited to 5,000 rows per request" }, 413);
        const result = await SheetsConnector.writeSheetData(service, connector, spreadsheetId, String(body.range || "A1"), body.values);
        await log("data_written", "success", null, { cells: result.updatedCells, spreadsheet_id: spreadsheetId });
        return json(result);
      }
      if (action === "sync") {
        const spreadsheetId = String(body.spreadsheet_id || "");
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(spreadsheetId)) return json({ error: "Valid spreadsheet_id required" }, 400);
        const result = await SheetsConnector.syncSheetData(service, connector, spreadsheetId, String(body.range || "A1:Z500"));
        await service.from("connected_apps").update({ last_synced_at: new Date().toISOString() }).eq("id", connection.id);
        await log("sync_completed", "success", null, { rows: result.rowsRead });
        return json(result);
      }
    }

    // ─── GOOGLE DRIVE (selected-file model) ─────────────────────
    if (appSlug === "google-drive") {
      const token = await getDriveToken(service, connection);
      if (!token) return json({ error: "Token expired — reconnect Google Drive" }, 401);
      // The browser receives metadata only. Google Picker requires an OAuth
      // bearer token in browser JavaScript, so using it here would defeat the
      // server-only token-storage model. Instead the edge function lists the
      // files accessible to this connection and validates the selected IDs.
      if (action === "list_drive_files") {
        const files = await listDriveFiles(token, 100);
        await log("data_read", "success", null, { count: files.length });
        return json({ files });
      }
      if (action === "save_drive_files") {
        if (!Array.isArray(body.files) || body.files.length > 20) return json({ error: "files[] is required (maximum 20)" }, 400);
        const selectedFiles = (await Promise.all(body.files.map((file: any) => validatePickedFile(token, file)))).filter(Boolean);
        if (body.files.length > 0 && selectedFiles.length !== body.files.length) {
          return json({ error: "One or more files are no longer accessible. Refresh the list and try again." }, 400);
        }
        const { error: saveError } = await service.from("connected_apps").update({
          metadata: { ...(connection.metadata || {}), selectedFiles },
          last_synced_at: new Date().toISOString(),
        }).eq("id", connection.id).eq("user_id", user.id);
        if (saveError) return json({ error: "Could not save Drive selection" }, 503);
        await log("data_read", "success", null, { files: selectedFiles.length });
        return json({ ok: true, selectedFiles });
      }
    }

    // ─── CANVA: read-only design listing ────────────────────────
    if (appSlug === "canva" && action === "list_canva_designs") {
      const token = await refreshCanvaToken(service, connection);
      if (!token) return json({ error: "Token expired — reconnect Canva" }, 401);
      const designs = await canvaListDesigns(token);
      await log("data_read", "success", null, { count: designs.length });
      return json({ designs });
    }

    // ─── DISCONNECT ─────────────────────────────────────────────
    if (action === "disconnect") {
      if (appSlug !== "canva" && connection.access_token) {
        try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(connection.access_token)}`, { method: "POST" }); } catch { /* best effort */ }
      }
      await service.from("connected_apps").update({ status: "disconnected", access_token: null, refresh_token: null, token_expires_at: null, updated_at: new Date().toISOString() }).eq("id", connection.id);
      const legacyProvider = appSlug === "google-sheets" ? "google_sheets" : appSlug === "google-drive" ? "google_drive" : appSlug;
      await service.from("integrations").update({ status: "disconnected", metadata: {}, last_error: null }).eq("user_id", user.id).eq("provider", legacyProvider);
      await log("disconnect_completed");
      return json({ ok: true, message: "Disconnected successfully" });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
