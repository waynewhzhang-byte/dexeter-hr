import Fastify from "fastify";
import { registerApprovalRoutes } from "./routes/approval";
import { registerPackRoutes } from "./routes/packs";
import { registerReleaseRoutes } from "./routes/release";
import { AuditService } from "./services/audit-service";
import { PackService } from "./services/pack-service";
import { ReleaseService } from "./services/release-service";

export function buildApp() {
  const app = Fastify();
  const packService = new PackService();
  const auditService = new AuditService();
  const releaseService = new ReleaseService(packService);

  app.get("/health", async () => ({ status: "ok" }));
  registerPackRoutes(app, { packService });
  registerReleaseRoutes(app, { releaseService });
  registerApprovalRoutes(app, { packService, auditService });

  return app;
}
