import { Contract, JsonRpcProvider, verifyMessage } from "ethers";
import { SignJWT, jwtVerify } from "jose";
import { extractAndVerifyAuth } from "./auth";
import { unauthorized } from "./response";
const OWNER_JWT_TTL_SECONDS = 2 * 60 * 60; // 2h
const OWNER_JWT_ISS = "coinplanet-owner";
const ADMIN_ABI = ["function isAdmin(address) view returns (bool)"];
function secretKey(env) {
    const raw = (env.JWT_SECRET || "").trim();
    if (!raw)
        return null;
    return new TextEncoder().encode(raw);
}
function isConfiguredAdminWallet(env, wallet) {
    if (!wallet)
        return false;
    const w = wallet.toLowerCase();
    if (env.ADMIN_ADDRESSES) {
        for (const entry of env.ADMIN_ADDRESSES.split(",")) {
            const a = entry.trim().toLowerCase();
            if (a && a === w)
                return true;
        }
    }
    return false;
}
function parseWalletCsv(raw) {
    if (!raw)
        return [];
    const wallets = new Set();
    for (const entry of raw.split(",")) {
        const wallet = entry.trim().toLowerCase();
        if (wallet)
            wallets.add(wallet);
    }
    return Array.from(wallets);
}
async function getConfiguredSubAdminWallets(env) {
    const result = new Set(parseWalletCsv([env.SUB_ADMIN_ADDRESSES, env.ADMIN_ADDRESSES].filter(Boolean).join(",")));
    try {
        const { results } = await env.DB.prepare(`SELECT wallet
       FROM owner_sub_admins
       WHERE enabled = 1`).all();
        for (const row of results ?? []) {
            const wallet = row.wallet?.trim().toLowerCase();
            if (wallet)
                result.add(wallet);
        }
    }
    catch {
        // Backward-compatible when table is not created yet.
    }
    return result;
}
export async function getPrimaryOwnerWallet(env) {
    const fallback = env.OWNER_ADDRESS ? env.OWNER_ADDRESS.toLowerCase() : null;
    try {
        const row = await env.DB.prepare("SELECT value FROM system_settings WHERE key='owner_address' LIMIT 1").first();
        const value = row?.value?.trim().toLowerCase();
        return value || fallback;
    }
    catch {
        return fallback;
    }
}
export async function isReferrerWallet(env, wallet) {
    if (!wallet)
        return false;
    const w = wallet.toLowerCase();
    const row = await env.DB.prepare(`SELECT 1 AS ok
     FROM users u
     INNER JOIN referral_edges re ON re.inviter_user_id = u.id
     WHERE u.wallet = ? AND re.status = 'active'
     LIMIT 1`)
        .bind(w)
        .first();
    return Boolean(row?.ok);
}
export async function isSubAdminWallet(env, wallet) {
    if (!wallet)
        return false;
    const configured = await getConfiguredSubAdminWallets(env);
    return configured.has(wallet.toLowerCase());
}
export async function getAdminActorRole(env, wallet) {
    if (await isOwnerWallet(env, wallet))
        return "owner";
    if (await isSubAdminWallet(env, wallet))
        return "subadmin";
    return null;
}
export async function isAdminActorWallet(env, wallet) {
    return (await getAdminActorRole(env, wallet)) !== null;
}
export async function isOwnerWallet(env, wallet) {
    if (!wallet)
        return false;
    const w = wallet.toLowerCase();
    const primaryOwner = await getPrimaryOwnerWallet(env);
    if (primaryOwner && w === primaryOwner)
        return true;
    if (isConfiguredAdminWallet(env, w))
        return true;
    if (!env.RPC_URL || !env.MINING_POOL_ADDRESS)
        return false;
    try {
        const provider = new JsonRpcProvider(env.RPC_URL);
        const contract = new Contract(env.MINING_POOL_ADDRESS, ADMIN_ABI, provider);
        return Boolean(await contract.isAdmin(wallet));
    }
    catch {
        return false;
    }
}
export async function issueOwnerJwt(env, wallet, sessionId) {
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = nowSec + OWNER_JWT_TTL_SECONDS;
    const key = secretKey(env);
    // Fallback mode: when JWT_SECRET is not configured, use an opaque
    // DB-backed session token so owner can still enter the admin system.
    if (!key) {
        return { token: `opaque:${sessionId}`, expiresAt: new Date(expSec * 1000).toISOString() };
    }
    const role = (await getAdminActorRole(env, wallet)) ?? "subadmin";
    const token = await new SignJWT({ wallet: wallet.toLowerCase(), role, sid: sessionId })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuer(OWNER_JWT_ISS)
        .setIssuedAt(nowSec)
        .setExpirationTime(expSec)
        .sign(key);
    return { token, expiresAt: new Date(expSec * 1000).toISOString() };
}
export async function verifyOwnerJwt(env, token) {
    try {
        if (token.startsWith("opaque:")) {
            const sessionId = token.slice("opaque:".length).trim();
            if (!sessionId)
                return { valid: false, error: "Invalid owner session" };
            const session = await env.DB.prepare(`SELECT id, wallet
         FROM owner_sessions
         WHERE id = ?
           AND revoked = 0
           AND expires_at > ?
         LIMIT 1`)
                .bind(sessionId, new Date().toISOString())
                .first();
            const wallet = session?.wallet?.toLowerCase() || null;
            if (!wallet)
                return { valid: false, error: "Owner session expired or revoked" };
            if (!(await isAdminActorWallet(env, wallet)))
                return { valid: false, error: "Not admin" };
            return { valid: true, wallet };
        }
        const key = secretKey(env);
        if (!key)
            return { valid: false, error: "Owner session secret not configured" };
        const { payload } = await jwtVerify(token, key, { issuer: OWNER_JWT_ISS });
        const wallet = typeof payload.wallet === "string" ? payload.wallet : null;
        const sessionId = typeof payload.sid === "string" ? payload.sid : null;
        if (!wallet || !sessionId)
            return { valid: false, error: "Invalid owner session" };
        if (!(await isAdminActorWallet(env, wallet)))
            return { valid: false, error: "Not admin" };
        const session = await env.DB.prepare(`SELECT id
       FROM owner_sessions
       WHERE id = ?
         AND wallet = ?
         AND revoked = 0
         AND expires_at > ?
       LIMIT 1`)
            .bind(sessionId, wallet.toLowerCase(), new Date().toISOString())
            .first();
        if (!session?.id)
            return { valid: false, error: "Owner session expired or revoked" };
        return { valid: true, wallet: wallet };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "invalid token";
        return { valid: false, error: msg };
    }
}
export function verifyLoginSignature(wallet, signature, nonce, ts) {
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
    }
    catch (err) {
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
export async function requireOwnerAuth(request, env, opts = {}) {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    const bearer = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
    let walletFromJwt = null;
    if (bearer) {
        const v = await verifyOwnerJwt(env, bearer);
        if (!v.valid)
            return { ok: false, response: unauthorized(v.error || "Invalid token") };
        walletFromJwt = v.wallet;
    }
    const hasLegacyHeaders = request.headers.get("x-signature") && request.headers.get("x-nonce") && request.headers.get("x-wallet");
    if (!bearer && !hasLegacyHeaders) {
        return { ok: false, response: unauthorized("Admin auth required") };
    }
    if (opts.sensitive || !bearer) {
        const sig = await extractAndVerifyAuth(request, env);
        if (!sig.valid)
            return { ok: false, response: unauthorized(sig.error || "Signature verification failed") };
        if (!(await isAdminActorWallet(env, sig.wallet ?? null)))
            return { ok: false, response: unauthorized("Admin wallet required") };
        if (walletFromJwt && walletFromJwt.toLowerCase() !== (sig.wallet || "").toLowerCase()) {
            return { ok: false, response: unauthorized("JWT/wallet mismatch") };
        }
        return { ok: true, wallet: sig.wallet.toLowerCase() };
    }
    return { ok: true, wallet: walletFromJwt };
}
