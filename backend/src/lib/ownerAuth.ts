import { verifyMessage } from "ethers";
import { SignJWT, jwtVerify } from "jose";
import type { Env } from "../types/env";
import { extractAndVerifyAuth } from "./auth";
import { unauthorized } from "./response";

const OWNER_JWT_TTL_SECONDS = 2 * 60 * 60; // 2h
const OWNER_JWT_ISS = "coinplanet-owner";

function secretKey(env: Env): Uint8Array {
  const raw = env.JWT_SECRET;
  return new TextEncoder().encode(raw);
}

export function isOwnerWallet(env: Env, wallet: string | null | undefined): boolean {
  return Boolean(
    env.OWNER_ADDRESS && wallet && wallet.toLowerCase() === env.OWNER_ADDRESS.toLowerCase()
  );
}

export async function issueOwnerJwt(env: Env, wallet: string): Promise<{ token: string; expiresAt: string }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + OWNER_JWT_TTL_SECONDS;
  const token = await new SignJWT({ wallet: wallet.toLowerCase(), role: "owner" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(OWNER_JWT_ISS)
    .setIssuedAt(nowSec)
    .setExpirationTime(expSec)
    .sign(secretKey(env));
  return { token, expiresAt: new Date(expSec * 1000).toISOString() };
}

export async function verifyOwnerJwt(env: Env, token: string): Promise<{ valid: boolean; wallet?: string; error?: string }> {
  try {
    const { payload } = await jwtVerify(token, secretKey(env), { issuer: OWNER_JWT_ISS });
    const wallet = typeof payload.wallet === "string" ? payload.wallet : null;
    if (!isOwnerWallet(env, wallet)) return { valid: false, error: "Not owner" };
    return { valid: true, wallet: wallet as string };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "invalid token";
    return { valid: false, error: msg };
  }
}

export function verifyLoginSignature(wallet: string, signature: string, nonce: string, ts: number | string): { valid: boolean; error?: string } {
  try {
    const tsNum = typeof ts === "number" ? ts : Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > 5 * 60 * 1000) {
      return { valid: false, error: "Timestamp out of range" };
    }
    const message = `coinplanet-owner|login|${nonce}|${tsNum}`;
    const recovered = verifyMessage(message, signature);
    if (recovered.toLowerCase() !== wallet.toLowerCase()) {
      return { valid: false, error: "Signature mismatch" };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : "verify failed" };
  }
}

/**
 * Middleware: require Owner auth.
 * Accepts either:
 *  - Bearer JWT (`Authorization: Bearer <jwt>`) for normal reads/writes
 *  - Legacy signature headers (x-signature/x-nonce/x-wallet) for backward compatibility
 * If `sensitive=true`, BOTH the JWT AND a fresh wallet signature are required.
 */
export async function requireOwnerAuth(
  request: Request,
  env: Env,
  opts: { sensitive?: boolean } = {}
): Promise<{ ok: true; wallet: string } | { ok: false; response: Response }> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  const bearer = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

  let walletFromJwt: string | null = null;
  if (bearer) {
    const v = await verifyOwnerJwt(env, bearer);
    if (!v.valid) return { ok: false, response: unauthorized(v.error || "Invalid token") };
    walletFromJwt = v.wallet!;
  }

  const hasLegacyHeaders = request.headers.get("x-signature") && request.headers.get("x-nonce") && request.headers.get("x-wallet");

  if (!bearer && !hasLegacyHeaders) {
    return { ok: false, response: unauthorized("Owner auth required") };
  }

  if (opts.sensitive || !bearer) {
    const sig = await extractAndVerifyAuth(request, env);
    if (!sig.valid) return { ok: false, response: unauthorized(sig.error || "Signature verification failed") };
    if (!isOwnerWallet(env, sig.wallet ?? null)) return { ok: false, response: unauthorized("Owner wallet required") };
    if (walletFromJwt && walletFromJwt.toLowerCase() !== (sig.wallet || "").toLowerCase()) {
      return { ok: false, response: unauthorized("JWT/wallet mismatch") };
    }
    return { ok: true, wallet: (sig.wallet as string).toLowerCase() };
  }

  return { ok: true, wallet: walletFromJwt! };
}
