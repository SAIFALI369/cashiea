// Server-side AI usage accounting helpers. Reservations are atomic in SQL;
// a reservation is released only when the downstream provider/action was never
// successfully reached. A real provider response still counts as consumed.

export async function releaseApiUsage(service: any, ownerId: string, amount = 1): Promise<void> {
  if (!service || !ownerId || amount < 1) return;
  try {
    await service.rpc("release_api_usage", { p_user_id: ownerId, p_amount: amount });
  } catch {
    // Usage release is best-effort. Never replace the original provider error
    // with an accounting-cleanup error; the operator can reconcile from logs.
  }
}
