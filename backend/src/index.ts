import { internalError, json, notFound } from "./lib/response";
import { handleAnnouncements } from "./routes/announcements";
import { runScheduledTasks } from "./lib/scheduled";
import { handleAdmin } from "./routes/admin";
import { handleClaims } from "./routes/claims";
import { handleDevices } from "./routes/devices";
import { handleDownloads } from "./routes/downloads";
import { handleGas } from "./routes/gas";
import { handleOperations } from "./routes/operations";
import { handleOwner } from "./routes/owner";
import { handleSystem } from "./routes/system";
import { handleUsers } from "./routes/users";
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

      if (scope === "system") return await handleSystem(request, env, pathParts);
      if (scope === "announcements") return await handleAnnouncements(request, env, pathParts);
      if (scope === "admin") return await handleAdmin(request, env, pathParts);
      if (scope === "owner") return await handleOwner(request, env, pathParts);

      if (scope === "users") return await handleUsers(request, env, pathParts);
      if (scope === "devices") return await handleDevices(request, env, pathParts);
      if (scope === "claims") return await handleClaims(request, env, pathParts);
      if (scope === "downloads") return await handleDownloads(request, env, pathParts);
      if (scope === "gas") return await handleGas(request, env, pathParts);
      if (scope === "operations") return await handleOperations(request, env, pathParts);

      return notFound("API route not found");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return internalError(message);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledTasks(env).then(() => undefined));
  }
};
