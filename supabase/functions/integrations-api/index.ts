// ════════════════════════════════════════════════════════════════
// Integrations API — handles all connected-app operations.
// Every request validates JWT auth + connection ownership.
//
// Endpoints (POST body: { action, ...params }):
//   status     → GET connection info for an app
//   list_sheets → list user's spreadsheets
//   read       → read data from a sheet
//   write      → write data (blocked if read_only)
//   test       → test connection health
//   sync       → sync sheet data
//   disconnect → revoke + remove connection
//
// Deploy: supabase functions deploy integrations-api
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";
import * as SheetsConnector from "../_shared/connectors/google-sheets.ts";
import { refreshGoogleToken } from "../_shared/google.ts";
import { getDriveToken, readDriveFile } from "../_shared/connectors/google-drive.ts";
import { refreshCanvaToken, listDesigns as canvaListDesigns } from "../_shared/canva.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, app_slug } = body;

    // ─── STATUS: get connection info ────────────────────────────
    if (action === 'status') {
      const { data: conn } = await supabase
        .from('connected_apps')
        .select('*')
        .eq('user_id', user.id)
        .eq('app_slug', app_slug || 'google-sheets')
        .maybeSingle();

      // Also get recent audit logs for this app
      const { data: logs } = await supabase
        .from('integration_audit_logs')
        .select('action_type, status, error_message, created_at')
        .eq('user_id', user.id)
        .eq('app_slug', app_slug || 'google-sheets')
        .order('created_at', { ascending: false })
        .limit(10);

      return json({ connection: conn, auditLogs: logs || [] });
    }

    // All other actions need an active connection
    const { data: conn } = await supabase
      .from('connected_apps')
      .select('*')
      .eq('user_id', user.id)
      .eq('app_slug', app_slug || 'google-sheets')
      .maybeSingle();

    if (!conn || conn.status !== 'connected') {
      return json({ error: `${app_slug} is not connected` }, 400);
    }

    // Cast for the connector
    const connection = conn as any;

    // ─── TEST ───────────────────────────────────────────────────
    if (action === 'test') {
      // Gmail uses the same Google OAuth tokens as Sheets — verify via a token refresh.
      if (app_slug === 'gmail') {
        const ok = !!await refreshGoogleToken(supabase, {
          user_id: conn.user_id, provider: 'gmail',
          metadata: {
            access_token: conn.access_token,
            refresh_token: conn.refresh_token,
            expires_at: conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : null,
          },
        });
        await supabase.rpc('log_integration_event', {
          p_user_id: user.id, p_app_slug: app_slug, p_action_type: 'connection_tested',
          p_status: ok ? 'success' : 'failed', p_error_message: ok ? null : 'Token expired — reconnect',
        });
        return json({ ok, message: ok ? 'Gmail connection healthy' : 'Token expired — reconnect' });
      }
      // Canva uses its own PKCE OAuth tokens — verify via a token refresh.
      if (app_slug === 'canva') {
        const ok = !!await refreshCanvaToken(supabase, connection);
        await supabase.rpc('log_integration_event', {
          p_user_id: user.id, p_app_slug: 'canva', p_action_type: 'connection_tested',
          p_status: ok ? 'success' : 'failed', p_error_message: ok ? null : 'Token expired — reconnect',
        });
        return json({ ok, message: ok ? 'Canva connection healthy' : 'Token expired — reconnect' });
      }
      const result = await SheetsConnector.testConnection(supabase, connection);
      await supabase.rpc('log_integration_event', {
        p_user_id: user.id, p_app_slug: app_slug, p_action_type: 'connection_tested',
        p_status: result.ok ? 'success' : 'failed',
        p_error_message: result.ok ? null : result.message,
      });
      return json(result);
    }

    // Sheets-only data actions (Gmail has no spreadsheet picker)
    if (['list_sheets', 'read', 'write', 'sync'].includes(action) && app_slug !== 'google-sheets') {
      return json({ error: 'This action is only available for Google Sheets' }, 400);
    }

    // ─── LIST SHEETS ────────────────────────────────────────────
    if (action === 'list_sheets') {
      try {
        const sheets = await SheetsConnector.listSpreadsheets(supabase, connection);
        await supabase.rpc('log_integration_event', {
          p_user_id: user.id, p_app_slug: app_slug, p_action_type: 'data_read',
          p_metadata: { count: sheets.length },
        });
        return json({ sheets });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ─── READ ───────────────────────────────────────────────────
    if (action === 'read') {
      const { spreadsheet_id, range } = body;
      if (!spreadsheet_id) return json({ error: 'spreadsheet_id required' }, 400);
      try {
        const data = await SheetsConnector.readSheetData(supabase, connection, spreadsheet_id, range || 'A1:Z1000');
        await supabase.rpc('log_integration_event', {
          p_user_id: user.id, p_app_slug: app_slug, p_action_type: 'data_read',
          p_metadata: { rows: data.length },
        });
        return json({ rows: data.length, data });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ─── WRITE (permission-gated + confirmation check) ──────────
    if (action === 'write') {
      const { spreadsheet_id, range, values, confirmed } = body;
      if (!spreadsheet_id || !values) return json({ error: 'spreadsheet_id and values required' }, 400);
      if (!confirmed) return json({ error: 'Write confirmation required. Set confirmed: true.' }, 403);
      try {
        const result = await SheetsConnector.writeSheetData(supabase, connection, spreadsheet_id, range || 'A1', values);
        await supabase.rpc('log_integration_event', {
          p_user_id: user.id, p_app_slug: app_slug, p_action_type: 'data_written',
          p_metadata: { cells: result.updatedCells, spreadsheet_id, range },
        });
        return json(result);
      } catch (e) {
        await supabase.rpc('log_integration_event', {
          p_user_id: user.id, p_app_slug: app_slug, p_action_type: 'data_written',
          p_status: 'failed', p_error_message: e.message,
        });
        return json({ error: e.message }, 500);
      }
    }

    // ─── SYNC ───────────────────────────────────────────────────
    if (action === 'sync') {
      const { spreadsheet_id, range } = body;
      if (!spreadsheet_id) return json({ error: 'spreadsheet_id required' }, 400);
      try {
        const result = await SheetsConnector.syncSheetData(supabase, connection, spreadsheet_id, range || 'A1:Z500');
        await supabase.from('connected_apps').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id);
        await supabase.rpc('log_integration_event', {
          p_user_id: user.id, p_app_slug: app_slug, p_action_type: 'sync_completed',
          p_metadata: { rows: result.rowsRead },
        });
        return json(result);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ─── DISCONNECT ─────────────────────────────────────────────
    if (action === 'disconnect') {
      // Revoke token at Google if possible
      const token = connection.access_token;
      if (token) {
        try {
          await fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, { method: 'POST' });
        } catch { /* best effort */ }
      }
      // Mark disconnected in DB
      await supabase.from('connected_apps').update({
        status: 'disconnected',
        access_token: null,
        refresh_token: null,
      }).eq('id', conn.id);

      await supabase.rpc('log_integration_event', {
        p_user_id: user.id, p_app_slug: app_slug, p_action_type: 'disconnect_completed',
      });
      return json({ ok: true, message: 'Disconnected successfully' });
    }

    // ─── GOOGLE DRIVE (file-picker model — drive.file) ────────────
    if (app_slug === 'google-drive') {
      // Hand the browser a short-lived token to open the Google Picker.
      if (action === 'get_drive_token') {
        const token = await getDriveToken(supabase, connection);
        if (!token) return json({ error: 'Token expired — reconnect Google Drive' }, 401);
        return json({ token });
      }
      // Persist the files the owner picked with the Google Picker.
      if (action === 'save_drive_files') {
        const { files } = body;
        if (!Array.isArray(files)) return json({ error: 'files[] required' }, 400);
        const selectedFiles = files.map((f: any) => ({ id: String(f.id), name: String(f.name || 'File'), mimeType: String(f.mimeType || '') }));
        await supabase.from('connected_apps').update({
          metadata: { ...(connection.metadata || {}), selectedFiles },
          last_synced_at: new Date().toISOString(),
        }).eq('id', conn.id);
        await supabase.rpc('log_integration_event', {
          p_user_id: user.id, p_app_slug: 'google-drive', p_action_type: 'data_read',
          p_metadata: { files: selectedFiles.length },
        });
        return json({ ok: true, selectedFiles });
      }
      // Preview which selected files are readable + their size.
      if (action === 'list_drive_files') {
        const selected = (connection.metadata?.selectedFiles as any[]) || [];
        if (!selected.length) return json({ files: [] });
        const token = await getDriveToken(supabase, connection);
        if (!token) return json({ error: 'Token expired — reconnect' }, 401);
        const out = await Promise.all(selected.slice(0, 6).map((f) =>
          readDriveFile(token, f)
            .then((c) => (c ? { name: c.name, mimeType: c.mimeType, chars: c.text.length } : { name: f.name, mimeType: f.mimeType, chars: 0, unreadable: true }))
            .catch(() => ({ name: f.name, mimeType: f.mimeType, chars: 0, unreadable: true }))
        ));
        return json({ files: out });
      }
    }

    // ─── CANVA: list designs ──────────────────────────────────────
    if (action === 'list_canva_designs' && app_slug === 'canva') {
      const token = await refreshCanvaToken(supabase, connection);
      if (!token) return json({ error: 'Token expired — reconnect Canva' }, 401);
      const designs = await canvaListDesigns(token);
      return json({ designs });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
