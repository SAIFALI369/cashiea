const TOKEN_VERSION = 1;
const TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60;

function secret(): string {
  const value = Deno.env.get("TRACKING_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!value) throw new Error("TRACKING_SECRET is not configured");
  return value;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export type TrackingType = "open" | "click" | "reply";
export interface TrackingClaims {
  id: string;
  type: TrackingType;
  exp: number;
  dest?: string;
}

/** Create a tamper-proof, expiring token. The recipient UUID is never accepted
 * from a public request by itself. For clicks, the destination is signed too. */
export async function createTrackingToken(id: string, type: TrackingType, dest?: string): Promise<string> {
  const claims: TrackingClaims & { v: number } = {
    v: TOKEN_VERSION,
    id,
    type,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    ...(dest ? { dest } : {}),
  };
  const payload = new TextEncoder().encode(JSON.stringify(claims));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), payload));
  return `${base64UrlEncode(payload)}.${base64UrlEncode(signature)}`;
}

export async function verifyTrackingToken(token: string, expectedType: TrackingType): Promise<TrackingClaims | null> {
  if (!token || token.length > 12_000) return null;
  const [encodedPayload, encodedSignature, extra] = token.split(".");
  if (!encodedPayload || !encodedSignature || extra) return null;
  try {
    const payload = base64UrlDecode(encodedPayload);
    const signature = base64UrlDecode(encodedSignature);
    const valid = await crypto.subtle.verify("HMAC", await hmacKey(), signature, payload);
    if (!valid) return null;
    const claims = JSON.parse(new TextDecoder().decode(payload)) as Partial<TrackingClaims> & { v?: number };
    if (claims.v !== TOKEN_VERSION || claims.type !== expectedType || typeof claims.id !== "string" ||
        !/^[0-9a-f-]{36}$/i.test(claims.id) || !Number.isInteger(claims.exp) || claims.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (expectedType === "click" && (typeof claims.dest !== "string" || !isSafeRedirect(claims.dest))) return null;
    return claims as TrackingClaims;
  } catch {
    return null;
  }
}

export function isSafeRedirect(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
