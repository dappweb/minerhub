import { internalError, json, notFound } from "../lib/response";
import type { Env } from "../types/env";

// 默认上游 RPC 列表——按稳定性排序。可通过环境变量 BSC_RPC_UPSTREAMS 覆盖（逗号分隔）。
const DEFAULT_BSC_UPSTREAMS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc-dataseed1.ninicoin.io/",
  "https://bsc.publicnode.com",
  "https://rpc.ankr.com/bsc",
];

const UPSTREAM_TIMEOUT_MS = 6_000;

function parseUpstreams(env: Env): string[] {
  const raw = (env as Env & { BSC_RPC_UPSTREAMS?: string }).BSC_RPC_UPSTREAMS;
  if (!raw) return DEFAULT_BSC_UPSTREAMS;
  const list = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  return list.length > 0 ? list : DEFAULT_BSC_UPSTREAMS;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function corsHeaders(): Record<string, string> {
  return {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "cache-control": "no-store",
  };
}

/**
 * BSC JSON-RPC 代理：接收 JSON-RPC 请求体，按顺序尝试上游节点，第一个成功即返回。
 * 目的：
 *  1. 为中国大陆用户提供统一回源入口（走自有域名 + Cloudflare 边缘），规避上游不稳定；
 *  2. 在多家公共节点之间做服务端 failover，避免单点丢包导致前端签名/余额查询卡住。
 */
export async function handleRpc(request: Request, env: Env, pathParts: string[]): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // 仅支持 BSC 链代理：POST /api/rpc/bsc
  if (pathParts[0] !== "bsc") return notFound();
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: string;
  try {
    body = await request.text();
    if (!body) {
      return json({ error: "empty body" }, 400);
    }
    // 轻量校验：必须是合法 JSON，且体积不超过 256KB
    if (body.length > 256 * 1024) {
      return json({ error: "payload too large" }, 413);
    }
    JSON.parse(body);
  } catch {
    return json({ error: "invalid json-rpc body" }, 400);
  }

  const upstreams = parseUpstreams(env);
  let lastErr: string = "no upstream";

  for (const upstream of upstreams) {
    try {
      const upstreamRes = await fetchWithTimeout(
        upstream,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
        },
        UPSTREAM_TIMEOUT_MS,
      );

      if (!upstreamRes.ok) {
        lastErr = `upstream ${upstream} status ${upstreamRes.status}`;
        continue;
      }

      const text = await upstreamRes.text();
      return new Response(text, { status: 200, headers: corsHeaders() });
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err);
      continue;
    }
  }

  return internalError(`All BSC upstreams failed: ${lastErr}`);
}
