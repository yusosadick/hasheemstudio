// Minimal HS256 JWT verifier for Supabase-issued (GoTrue) access tokens. Hand-rolled rather than
// pulling in a JWT library, matching scripts/ops/generate-supabase-secrets.mjs's signer — same
// algorithm, same shape, so this is the exact inverse of that code.
import { createHmac, timingSafeEqual } from "node:crypto";

export interface VerifiedToken {
  sub: string;
  role: string;
  exp: number;
  [key: string]: unknown;
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

function base64url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export class TokenError extends Error {}

export function verifyAccessToken(token: string, secret: string): VerifiedToken {
  const parts = token.split(".");
  if (parts.length !== 3) throw new TokenError("Malformed token");
  const [headerB64, payloadB64, signatureB64] = parts;

  const expectedSig = base64url(createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest());
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(signatureB64);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TokenError("Invalid signature");
  }

  const payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8")) as VerifiedToken;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    throw new TokenError("Token expired");
  }
  if (!payload.sub) throw new TokenError("Token missing sub claim");
  if (payload.aud !== "authenticated") throw new TokenError("Unexpected audience");
  return payload;
}
