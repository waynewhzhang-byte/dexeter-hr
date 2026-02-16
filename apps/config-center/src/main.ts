import { buildApp } from "./app";

const app = buildApp();
const port = Number(process.env.CONFIG_CENTER_PORT ?? 4010);
const host = process.env.CONFIG_CENTER_HOST ?? "0.0.0.0";

try {
  await app.listen({ host, port });
  console.log(`config-center listening on http://${host}:${port}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
