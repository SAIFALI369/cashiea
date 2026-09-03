// Canonical authenticated-business resolver shared by AI and account edge functions.
// A request is accepted only when the actor is either an owner profile or has
// exactly one active team membership. Never trust a business/role in JSON.

export interface BusinessIdentity {
  ownerId: string;
  role: string;
  isOwner: boolean;
}

export async function resolveBusiness(service: any, actorId: string): Promise<BusinessIdentity | null> {
  const { data: actor, error: actorError } = await service
    .from("profiles")
    .select("id, role, business_owner_id")
    .eq("id", actorId)
    .maybeSingle();
  if (actorError || !actor) return null;

  if (actor.role === "owner" && actor.business_owner_id === null) {
    return { ownerId: actor.id, role: "owner", isOwner: true };
  }

  const { data: memberships, error: membershipError } = await service
    .from("team_members")
    .select("user_id, role")
    .eq("member_user_id", actorId)
    .eq("status", "active")
    .limit(2);
  if (membershipError || !memberships || memberships.length !== 1) return null;

  const membership = memberships[0];
  if (!(membership.role === "manager" || membership.role === "accountant" || membership.role === "staff")) return null;
  const { data: owner, error: ownerError } = await service
    .from("profiles")
    .select("id, role, business_owner_id")
    .eq("id", membership.user_id)
    .maybeSingle();
  if (ownerError || !owner || owner.role !== "owner" || owner.business_owner_id !== null) return null;

  // The profile mapping and the team row must agree. This matters after a
  // revoke/role change and prevents a stale team row from authorising an
  // otherwise orphaned account.
  if (actor.business_owner_id !== owner.id || actor.role !== membership.role) return null;

  return {
    ownerId: owner.id,
    role: membership.role || actor.role || "staff",
    isOwner: false,
  };
}
