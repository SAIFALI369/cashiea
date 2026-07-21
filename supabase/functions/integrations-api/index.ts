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
      const result = await SheetsConnector.testConnection(supabase, connection);
      await supabase.rpc('log_integration_event', {
        p_user_id: user.id, p_app_slug: app_slug, p_action_type: 'connection_tested',
        p_status: result.ok ? 'success' : 'failed',
        p_error_message: result.ok ? null : result.message,
      });
      return json(result);
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

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
});
