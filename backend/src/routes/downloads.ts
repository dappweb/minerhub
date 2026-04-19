/**
 * /api/downloads  —  App distribution via Cloudflare R2
 *
 * Public endpoints:
 *   GET  /api/downloads              → list latest versions for all platforms
 *   GET  /api/downloads/android      → redirect to pre-signed R2 URL (APK)
 *   GET  /api/downloads/ios          → redirect to stored iOS URL
 *
 * Admin-only endpoints (require X-Wallet: <owner>):
 *   PUT  /api/downloads/android      → upload APK binary (multipart or raw body)
 *   PUT  /api/downloads/ios          → update iOS download URL (JSON: { url })
 *   DELETE /api/downloads/android    → remove current APK from R2
 */

import { isOwnerWallet } from "../lib/ownerAuth";
import { badRequest, internalError, json, notFound, unauthorized } from "../lib/response";
import type { Env } from "../types/env";

const ANDROID_KEY = "releases/android/coin-planet-latest.apk";
const IOS_URL_KEY  = "downloads:ios_url";
const META_KEY_ANDROID = "downloads:android_meta";

// ──────────────────────────────────────────
// helpers
// ──────────────────────────────────────────

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,x-wallet",
  };
}

function isOwner(request: Request, env: Env): boolean {
  const wallet = request.headers.get("x-wallet");
  return isOwnerWallet(env, wallet);
}

interface AndroidMeta {
  version: string;
  size: number;
  uploadedAt: string;
  key: string;
}

// ──────────────────────────────────────────
// public handlers
// ──────────────────────────────────────────

async function listDownloads(env: Env): Promise<Response> {
  const [androidMetaRaw, iosUrl] = await Promise.all([
    env.CACHE.get(META_KEY_ANDROID),
    env.CACHE.get(IOS_URL_KEY),
  ]);

  const androidMeta: AndroidMeta | null = androidMetaRaw
    ? (JSON.parse(androidMetaRaw) as AndroidMeta)
    : null;

  return json({
    android: androidMeta
      ? {
          available: true,
          version: androidMeta.version,
          size: androidMeta.size,
          uploadedAt: androidMeta.uploadedAt,
          downloadUrl: `/api/downloads/android`,
        }
      : { available: false },
    ios: iosUrl
      ? { available: true, downloadUrl: iosUrl }
      : { available: false },
  });
}

async function downloadAndroid(env: Env): Promise<Response> {
  if (!env.APP_BUCKET) {
    return internalError("R2 bucket is not configured");
  }

  const obj = await env.APP_BUCKET.get(ANDROID_KEY);
  if (!obj) {
    return notFound("Android APK not yet uploaded");
  }

  // Stream the file directly from R2
  const headers = new Headers({
    "content-type": "application/vnd.android.package-archive",
    "content-disposition": 'attachment; filename="coin-planet.apk"',
    "cache-control": "public, max-age=3600",
    ...corsHeaders(),
  });

  if (obj.size) headers.set("content-length", String(obj.size));

  return new Response(obj.body, { headers });
}

async function downloadIos(env: Env): Promise<Response> {
  const iosUrl = await env.CACHE.get(IOS_URL_KEY);
  if (!iosUrl) {
    return notFound("iOS download URL not configured");
  }
  return Response.redirect(iosUrl, 302);
}

// ──────────────────────────────────────────
// admin handlers
// ──────────────────────────────────────────

async function uploadAndroid(request: Request, env: Env): Promise<Response> {
  if (!isOwner(request, env)) {
    return unauthorized("Owner wallet required");
  }
  if (!env.APP_BUCKET) {
    return internalError("R2 bucket is not configured");
  }

  const contentType = request.headers.get("content-type") ?? "";

  let body: ReadableStream | ArrayBuffer;
  let version = "1.0.0";

  // Support version hint via query param: ?version=1.2.3
  const url = new URL(request.url);
  version = url.searchParams.get("version") ?? version;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as { arrayBuffer?: () => Promise<ArrayBuffer> } | null;
    if (!file || typeof file.arrayBuffer !== "function") {
      return badRequest("multipart field 'file' is required");
    }
    body = await file.arrayBuffer();
    version = (formData.get("version") as string | null) ?? version;
  } else {
    // raw binary body
    body = await request.arrayBuffer();
  }

  if (!body || (body instanceof ArrayBuffer && body.byteLength === 0)) {
    return badRequest("Empty file body");
  }

  const size = body instanceof ArrayBuffer ? body.byteLength : 0;

  await env.APP_BUCKET.put(ANDROID_KEY, body, {
    httpMetadata: {
      contentType: "application/vnd.android.package-archive",
    },
    customMetadata: { version, uploadedAt: new Date().toISOString() },
  });

  const meta: AndroidMeta = {
    version,
    size,
    uploadedAt: new Date().toISOString(),
    key: ANDROID_KEY,
  };
  await env.CACHE.put(META_KEY_ANDROID, JSON.stringify(meta));

  return json({ ok: true, version, size, key: ANDROID_KEY });
}

async function updateIosUrl(request: Request, env: Env): Promise<Response> {
  if (!isOwner(request, env)) {
    return unauthorized("Owner wallet required");
  }

  let body: { url?: string };
  try {
    body = (await request.json()) as { url?: string };
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!body.url || !body.url.startsWith("https://")) {
    return badRequest("url must be a valid HTTPS address");
  }

  await env.CACHE.put(IOS_URL_KEY, body.url);
  return json({ ok: true, url: body.url });
}

async function deleteAndroid(request: Request, env: Env): Promise<Response> {
  if (!isOwner(request, env)) {
    return unauthorized("Owner wallet required");
  }
  if (!env.APP_BUCKET) {
    return internalError("R2 bucket is not configured");
  }

  await Promise.all([
    env.APP_BUCKET.delete(ANDROID_KEY),
    env.CACHE.delete(META_KEY_ANDROID),
  ]);

  return json({ ok: true });
}

// ──────────────────────────────────────────
// router
// ──────────────────────────────────────────

export async function handleDownloads(
  request: Request,
  env: Env,
  pathParts: string[]
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const platform = pathParts[0]; // "android" | "ios" | undefined

    // GET /api/downloads  → list
    if (!platform && request.method === "GET") {
      return listDownloads(env);
    }

    if (platform === "android") {
      if (request.method === "GET")    return downloadAndroid(env);
      if (request.method === "PUT")    return uploadAndroid(request, env);
      if (request.method === "DELETE") return deleteAndroid(request, env);
    }

    if (platform === "ios") {
      if (request.method === "GET") return downloadIos(env);
      if (request.method === "PUT") return updateIosUrl(request, env);
    }

    return notFound("Download endpoint not found");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return internalError(message);
  }
}
