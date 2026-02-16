import { test, expect } from "bun:test";
import { buildApp } from "../src/app";

test("mutating endpoints require api key when configured", async () => {
  const app = buildApp({ apiKey: "secret-key" });

  const denied = (await app.inject({
    method: "POST",
    url: "/packs",
    payload: { packCode: "delivery_ops", name: "Delivery Ops" },
  })) as any;

  expect(denied.statusCode).toBe(401);

  const allowed = (await app.inject({
    method: "POST",
    url: "/packs",
    headers: { "x-api-key": "secret-key" },
    payload: { packCode: "delivery_ops", name: "Delivery Ops" },
  })) as any;

  expect(allowed.statusCode).toBe(201);
});

test("openapi and metrics endpoints are exposed", async () => {
  const app = buildApp();

  const openapiRes = (await app.inject({ method: "GET", url: "/openapi.json" })) as any;
  expect(openapiRes.statusCode).toBe(200);
  expect(openapiRes.json().openapi).toBe("3.0.0");

  const metricsRes = (await app.inject({ method: "GET", url: "/metrics" })) as any;
  expect(metricsRes.statusCode).toBe(200);
  expect(metricsRes.json().requestsTotal).toBeGreaterThan(0);
});
