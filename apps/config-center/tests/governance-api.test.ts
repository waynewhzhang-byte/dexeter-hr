import { test, expect } from "bun:test";
import { buildApp } from "../src/app";

function makePack(version: string) {
  return {
    id: "delivery_ops",
    version,
    businessLine: "delivery_ops",
    roleProfiles: [],
    metricProxies: [],
    scorePolicies: [],
  };
}

test("approval endpoint enforces stage order", async () => {
  const app = buildApp();

  await app.inject({ method: "POST", url: "/packs", payload: { packCode: "delivery_ops", name: "Delivery Ops" } });
  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions",
    payload: {
      contentJson: makePack("1.0.0"),
      schemaVersion: "1.0.0",
      changeNote: "v1",
      createdBy: "tester",
    },
  });

  const res = (await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/approvals",
    payload: {
      stage: "business_review",
      decision: "approved",
      comment: "jump stage",
      reviewer: "bob",
    },
  })) as any;

  expect(res.statusCode).toBe(400);
  expect(res.json().message).toContain("expected hr_review");
});

test("release endpoint requires submit and full approvals", async () => {
  const app = buildApp();

  await app.inject({ method: "POST", url: "/packs", payload: { packCode: "delivery_ops", name: "Delivery Ops" } });
  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions",
    payload: {
      contentJson: makePack("1.0.0"),
      schemaVersion: "1.0.0",
      changeNote: "v1",
      createdBy: "tester",
    },
  });

  const denied = (await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/release",
    payload: { environment: "prod", releasedBy: "release-bot" },
  })) as any;

  expect(denied.statusCode).toBe(409);

  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/submit",
    payload: { submittedBy: "alice" },
  });

  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/approvals",
    payload: { stage: "hr_review", decision: "approved", comment: "ok", reviewer: "alice" },
  });
  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/approvals",
    payload: { stage: "business_review", decision: "approved", comment: "ok", reviewer: "bob" },
  });
  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/approvals",
    payload: { stage: "security_review", decision: "approved", comment: "ok", reviewer: "sec" },
  });

  const allowed = (await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/release",
    payload: { environment: "prod", releasedBy: "release-bot" },
  })) as any;

  expect(allowed.statusCode).toBe(200);
  expect(allowed.json().activeVersionNo).toBe(1);
});
