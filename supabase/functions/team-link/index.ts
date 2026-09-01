// ════════════════════════════════════════════════════════════════
// TEAM LINK — the owner creates REAL staff accounts that are
// connected to their business.
//
//   POST   { email, password, name?, role }   → creates the auth
//           account + profile (business_owner_id = owner) + an
//           ACTIVE team_members row. Roles: 'cashier' | 'accountant'
//           (cashier maps to the DB role 'staff'). MAX 2 linked.
//   PATCH  { memberId, role }                 → change role
//   DELETE ?memberId=…&deleteAccount=true|false
//           → revoke access (team_members → 'revoked'); optionally
//             delete the created account entirely (default: keep
//             the login but disconnected).
//
// Owner-only (JWT). Max 2 linked accounts enforced. Password must be
// ≥8 chars with a letter and a number. Email must not already belong
// to a Cashiea account.
// ════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/retry.ts";

const MAX_LINKED = 2;

/** UI role → DB role (cashier is stored as 'staff'). */
function dbRole(role: string): string | null {
  if (role === "cashier" || role === "staff") return "staff";
  if (role === "accountant") return "accountant";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );
    const { data: { user }, error: authErr } = await anon.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // The caller must be a business OWNER (not a linked staff member).
    const { data: ownerProfile } = await svc
      .from("profiles").select("id, role, business_owner_id").eq("id", user.id).single();
    if (!ownerProfile) return json({ error: "Profile not found" }, 404);
    if (ownerProfile.business_owner_id) return json({ error: "Only the owner can manage linked accounts" }, 403);

    const ownerId = ownerProfile.id;

    // ── POST: create + link a new account ─────────────────────────
    if (req.method === "POST") {
      const { email, password, name, role } = await req.json();
      const cleanEmail = String(email || "").trim().toLowerCase();
      const dbR = dbRole(String(role || ""));
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return json({ error: "Enter a valid email address" }, 400);
      if (!dbR) return json({ error: "Role must be cashier or accountant" }, 400);
      const pw = String(password || "");
      if (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) {
        return json({ error: "Password must be at least 8 characters with a letter and a number" }, 400);
      }

      // Max 2 linked accounts (active or invited).
      const { count } = await svc
        .from("team_members")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ownerId).in("status", ["active", "invited"]);
      if ((count ?? 0) >= MAX_LINKED) {
        return json({ error: `Maximum ${MAX_LINKED} linked accounts — remove one first` }, 400);
      }

      // createUser rejects emails that already have an account — the
      // conflict error surfaces as a friendly message below.
      const { data: created, error: createErr } = await svc.auth.admin.createUser({
        email: cleanEmail,
        password: pw,
        email_confirm: true,
        user_metadata: { full_name: name || null, created_by_owner: ownerId },
      });
      if (createErr) {
        const m = String(createErr.message || "").toLowerCase();
        if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
          return json({ error: "This email already has a Cashiea account — use a different email" }, 409);
        }
        return json({ error: createErr.message }, 400);
      }
      const newUserId = created.user.id;

      // Profile: the on_auth_user_created trigger already inserts a
      // starter row — UPSERT it into a staff profile linked to the
      // owner's business.
      const { error: profErr } = await svc.from("profiles").upsert({
        id: newUserId,
        full_name: name || cleanEmail.split("@")[0],
        company_name: null,
        role: dbR,
        business_owner_id: ownerId,
        onboarding_step: 5,
        plan: "free",
        plan_tier: "free",
        ai_provider: "groq",
        report_time_utc: "22:30",
      }, { onConflict: "id" });
      if (profErr) {
        // Roll back the auth user so we never leave a half-linked account.
        await svc.auth.admin.deleteUser(newUserId);
        return json({ error: "Could not create the profile: " + profErr.message }, 500);
      }

      const perms = dbR === "accountant"
        ? { pos: false, invoices: true, reports: true, accounts: true, team: false }
        : { pos: true, invoices: false, reports: false, accounts: false, team: false };

      const { data: member, error: memberErr } = await svc
        .from("team_members")
        .insert({
          user_id: ownerId,
          member_email: cleanEmail,
          member_user_id: newUserId,
          name: name || null,
          role: dbR,
          status: "active",
          permissions: perms,
        })
        .select()
        .single();
      if (memberErr) {
        await svc.auth.admin.deleteUser(newUserId);
        return json({ error: "Could not link the account: " + memberErr.message }, 500);
      }

      return json({
        ok: true,
        member,
        message: `Account created for ${cleanEmail} — they can sign in with this email and password`,
      });
    }

    // ── PATCH: change role ────────────────────────────────────────
    if (req.method === "PATCH") {
      const { memberId, role } = await req.json();
      const dbR = dbRole(String(role || ""));
      if (!dbR) return json({ error: "Role must be cashier or accountant" }, 400);

      const { data: member } = await svc
        .from("team_members").select("id, member_user_id").eq("id", memberId).eq("user_id", ownerId).single();
      if (!member) return json({ error: "Linked account not found" }, 404);

      const perms = dbR === "accountant"
        ? { pos: false, invoices: true, reports: true, accounts: true, team: false }
        : { pos: true, invoices: false, reports: false, accounts: false, team: false };

      const { error } = await svc
        .from("team_members").update({ role: dbR, permissions: perms }).eq("id", memberId).eq("user_id", ownerId);
      if (error) return json({ error: error.message }, 400);
      if (member.member_user_id) {
        await svc.from("profiles").update({ role: dbR }).eq("id", member.member_user_id);
      }
      return json({ ok: true });
    }

    // ── DELETE: revoke access (optionally delete the account) ────
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const memberId = url.searchParams.get("memberId");
      const deleteAccount = url.searchParams.get("deleteAccount") === "true";
      if (!memberId) return json({ error: "memberId required" }, 400);

      const { data: member } = await svc
        .from("team_members").select("id, member_user_id, member_email").eq("id", memberId).eq("user_id", ownerId).single();
      if (!member) return json({ error: "Linked account not found" }, 404);

      if (deleteAccount && member.member_user_id) {
        // Remove the account entirely (profiles cascade via FK).
        await svc.from("team_members").delete().eq("id", memberId);
        const { error: delErr } = await svc.auth.admin.deleteUser(member.member_user_id);
        if (delErr) return json({ error: "Could not delete the account: " + delErr.message }, 500);
        return json({ ok: true, deleted: true });
      }

      // Revoke: block access, keep the login (can be re-linked by role change back to active? no — revoked stays revoked; owner can delete).
      const { error } = await svc
        .from("team_members").update({ status: "revoked" }).eq("id", memberId).eq("user_id", ownerId);
      if (error) return json({ error: error.message }, 400);
      if (member.member_user_id) {
        await svc.from("profiles").update({ business_owner_id: null }).eq("id", member.member_user_id);
      }
      return json({ ok: true, revoked: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: (e as Error)?.message || String(e) }, 500);
  }
});
