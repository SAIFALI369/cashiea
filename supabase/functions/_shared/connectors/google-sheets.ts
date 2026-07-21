// ════════════════════════════════════════════════════════════════
// Google Sheets Connector — permission-gated service.
//
// Every method checks the connection's permission_mode before
// executing. Write operations are blocked for read_only connections.
// The AI never calls Google APIs directly — it goes through here.
// ════════════════════════════════════════════════════════════════

import { refreshGoogleToken } from "../google.ts";

export interface Connection {
  id: string
  user_id: string
  app_slug: string
  permission_mode: 'read_only' | 'read_write' | 'full_access'
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  status: string
  metadata: Record<string, unknown>
}

// ─── Permission check helpers ───────────────────────────────────
function canRead(conn: Connection): boolean {
  return ['read_only', 'read_write', 'full_access'].includes(conn.permission_mode)
}
function canWrite(conn: Connection): boolean {
  return ['read_write', 'full_access'].includes(conn.permission_mode)
}
function canManage(conn: Connection): boolean {
  return conn.permission_mode === 'full_access'
}

// ─── Get a valid access token (refresh if expired) ──────────────
async function getToken(supabase: any, conn: Connection): Promise<string | null> {
  const integration = {
    user_id: conn.user_id,
    provider: 'google_sheets',
    metadata: {
      access_token: conn.access_token,
      refresh_token: conn.refresh_token,
      expires_at: conn.token_expires_at ? new Date(conn.token_expires_at).getTime() : null,
    },
  }
  return await refreshGoogleToken(supabase, integration)
}

// ─── Public connector methods ───────────────────────────────────

export async function testConnection(supabase: any, conn: Connection): Promise<{ ok: boolean; message: string }> {
  if (!canRead(conn)) return { ok: false, message: 'Insufficient permissions' }
  const token = await getToken(supabase, conn)
  if (!token) return { ok: false, message: 'Token expired — please reconnect' }
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return { ok: res.ok, message: res.ok ? 'Connection healthy' : `Google returned ${res.status}` }
  } catch (e) {
    return { ok: false, message: `Network error: ${e.message}` }
  }
}

export async function listSpreadsheets(supabase: any, conn: Connection): Promise<{ id: string; name: string }[]> {
  if (!canRead(conn)) throw new Error('Read permission required')
  const token = await getToken(supabase, conn)
  if (!token) throw new Error('Token expired — reconnect')
  // Use the Drive API to find spreadsheet files
  const res = await fetch(
    'https://www.googleapis.com/drive/v3/files?q=mimeType%3D%22application%2Fvnd.google-apps.spreadsheet%22&fields=files(id,name)&pageSize=50',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Google API error: ${res.status}`)
  const data = await res.json()
  return (data.files || []).map((f: any) => ({ id: f.id, name: f.name }))
}

export async function readSheetData(
  supabase: any,
  conn: Connection,
  spreadsheetId: string,
  range = 'A1:Z1000'
): Promise<string[][]> {
  if (!canRead(conn)) throw new Error('Read permission required')
  const token = await getToken(supabase, conn)
  if (!token) throw new Error('Token expired — reconnect')
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`Read failed: ${res.status}`)
  const data = await res.json()
  return data.values || []
}

export async function writeSheetData(
  supabase: any,
  conn: Connection,
  spreadsheetId: string,
  range: string,
  values: unknown[][]
): Promise<{ ok: boolean; updatedCells: number }> {
  if (!canWrite(conn)) throw new Error('Write permission required for this action')
  const token = await getToken(supabase, conn)
  if (!token) throw new Error('Token expired — reconnect')
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }
  )
  if (!res.ok) throw new Error(`Write failed: ${res.status}`)
  const data = await res.json()
  return { ok: true, updatedCells: data.updatedCells || 0 }
}

export async function createSpreadsheet(
  supabase: any,
  conn: Connection,
  title: string
): Promise<{ id: string; url: string }> {
  if (!canManage(conn)) throw new Error('Full access required to create spreadsheets')
  const token = await getToken(supabase, conn)
  if (!token) throw new Error('Token expired — reconnect')
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: { title } }),
  })
  if (!res.ok) throw new Error(`Create failed: ${res.status}`)
  const data = await res.json()
  return { id: data.spreadsheetId, url: data.spreadsheetUrl }
}

export async function syncSheetData(
  supabase: any,
  conn: Connection,
  spreadsheetId: string,
  range: string
): Promise<{ rowsRead: number; preview: string[][] }> {
  const data = await readSheetData(supabase, conn, spreadsheetId, range)
  return { rowsRead: data.length, preview: data.slice(0, 5) }
}
