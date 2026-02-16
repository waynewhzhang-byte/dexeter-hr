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

export function buildApp(options?: { databaseUrl?: string; store?: ConfigStore }) {
  const app = Fastify();

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

  app.get("/health", async () => ({ status: "ok" }));
  registerPackRoutes(app, { packService });
  registerSubmitRoutes(app, { packService });
  registerReleaseRoutes(app, { releaseService });
  registerRuntimeRoutes(app, { packService, releaseService });
  registerApprovalRoutes(app, { approvalService, auditService });

  return app;
}
