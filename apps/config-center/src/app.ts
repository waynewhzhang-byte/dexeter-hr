import Fastify from "fastify";
import { registerPackRoutes } from "./routes/packs";
import { PackService } from "./services/pack-service";

export function buildApp() {
  const app = Fastify();
  const packService = new PackService();

  app.get("/health", async () => ({ status: "ok" }));
  registerPackRoutes(app, { packService });

  return app;
}
