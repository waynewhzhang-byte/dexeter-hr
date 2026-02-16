import { test, expect } from "bun:test";
import { buildApp } from "../src/app";

test("GET /health returns ok", async () => {
  const app = buildApp();
  const res = await app.inject({ method: "GET", url: "/health" });
  const response = res as any;

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: "ok" });
});
