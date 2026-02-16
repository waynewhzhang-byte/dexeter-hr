import { test, expect } from "bun:test";
import { runSmokeCheck } from "../scripts/smoke";

test("smoke check succeeds when /health returns ok", async () => {
  const result = await runSmokeCheck({
    baseUrl: "http://config-center.local",
    fetchImpl: async () =>
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });

  expect(result.ok).toBe(true);
});

test("smoke check fails when service is unhealthy", async () => {
  const result = await runSmokeCheck({
    baseUrl: "http://config-center.local",
    fetchImpl: async () =>
      new Response(JSON.stringify({ status: "down" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
  });

  expect(result.ok).toBe(false);
  expect(result.message).toContain("health check failed");
});
