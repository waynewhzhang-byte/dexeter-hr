import Fastify from "fastify";
import { createConfigStore, type ConfigStore } from "./repositories/store";
import { registerApprovalRoutes } from "./routes/approval";
import { registerPackRoutes } from "./routes/packs";
import { registerReleaseRoutes } from "./routes/release";
import { registerRuntimeRoutes } from "./routes/runtime";
import { registerSubmitRoutes } from "./routes/submit";
import { ApprovalService } from "./services/approval-service";
import { AuditService } from "./services/audit-service";
import { PackService } from "./services/pack-service";
import { ReleaseService } from "./services/release-service";

export function buildApp(options?: { databaseUrl?: string; store?: ConfigStore; apiKey?: string }) {
  const app = Fastify();
  const startedAt = Date.now();
  const metrics = {
    requestsTotal: 0,
    unauthorizedRequests: 0,
  };
  const configuredApiKey = options?.apiKey ?? process.env.CONFIG_CENTER_API_KEY;

  const storeResult = options?.store
    ? { mode: "memory" as const, store: options.store }
    : createConfigStore({ databaseUrl: options?.databaseUrl ?? process.env.DATABASE_URL });

  if (storeResult.dispose) {
    app.addHook("onClose", async () => {
      await storeResult.dispose?.();
    });
  }

  const packService = new PackService(storeResult.store);
  const releaseService = new ReleaseService(storeResult.store);
  const approvalService = new ApprovalService(storeResult.store);
  const auditService = new AuditService(storeResult.store);

  app.addHook("onRequest", async () => {
    metrics.requestsTotal += 1;
  });

  app.addHook("preHandler", async (request, reply) => {
    const mutatingMethod = request.method === "POST" || request.method === "PUT" || request.method === "PATCH" || request.method === "DELETE";
    const guardedPath = request.url.startsWith("/packs");

    if (!configuredApiKey || !mutatingMethod || !guardedPath) {
      return;
    }

    const incomingKey = request.headers["x-api-key"];
    if (incomingKey !== configuredApiKey) {
      metrics.unauthorizedRequests += 1;
      return reply.code(401).send({ message: "unauthorized" });
    }
  });

  app.get("/health", async () => ({ status: "ok" }));
  app.get("/metrics", async () => ({
    requestsTotal: metrics.requestsTotal,
    unauthorizedRequests: metrics.unauthorizedRequests,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  }));
  app.get("/openapi.json", async () => ({
    openapi: "3.0.0",
    info: {
      title: "Config Center API",
      version: "1.0.0",
    },
    paths: {
      "/health": { get: {} },
      "/metrics": { get: {} },
      "/packs": { post: {} },
      "/packs/{packCode}/versions": { post: {} },
      "/packs/{packCode}/versions/{versionNo}": { get: {} },
      "/packs/{packCode}/versions/{versionNo}/submit": { post: {} },
      "/packs/{packCode}/versions/{versionNo}/validate": { post: {} },
      "/packs/{packCode}/versions/{versionNo}/release": { post: {} },
      "/packs/{packCode}/versions/{versionNo}/approvals": { get: {}, post: {} },
      "/runtime/packs/{businessLine}": { get: {} },
      "/runtime/packs/{businessLine}/{versionNo}": { get: {} },
      "/audit-logs": { get: {} },
    },
  }));
  registerPackRoutes(app, { packService });
  registerSubmitRoutes(app, { packService });
  registerReleaseRoutes(app, { releaseService });
  registerRuntimeRoutes(app, { packService, releaseService });
  registerApprovalRoutes(app, { approvalService, auditService });

  return app;
}
