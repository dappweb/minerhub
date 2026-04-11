import { handleClaims } from "./routes/claims";
import { handleDevices } from "./routes/devices";
import { handleUsers } from "./routes/users";
import { internalError, json, notFound } from "./lib/response";
import type { Env } from "./types/env";

function getPathParts(url: string): string[] {
  const { pathname } = new URL(url);
  return pathname.split("/").filter(Boolean);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    try {
      const parts = getPathParts(request.url);
      if (parts.length === 0) {
        return json({ service: "coin-planet-api", status: "ok", timestamp: new Date().toISOString() });
      }

      if (parts[0] !== "api") return notFound();

      const scope = parts[1];
      const pathParts = parts.slice(2);

      if (scope === "health" && request.method === "GET") {
        return json({ status: "healthy", chainId: env.CHAIN_ID, timestamp: new Date().toISOString() });
      }

      if (scope === "users") return handleUsers(request, env, pathParts);
      if (scope === "devices") return handleDevices(request, env, pathParts);
      if (scope === "claims") return handleClaims(request, env, pathParts);

      return notFound("API route not found");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return internalError(message);
    }
  }
};
