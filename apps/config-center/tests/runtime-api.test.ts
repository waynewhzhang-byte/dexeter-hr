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

test("submit endpoint marks version as submitted", async () => {
  const app = buildApp();

  await app.inject({
    method: "POST",
    url: "/packs",
    payload: { packCode: "delivery_ops", name: "Delivery Ops" },
  });

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

  const submitRes = (await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/submit",
    payload: { submittedBy: "alice" },
  })) as any;

  expect(submitRes.statusCode).toBe(200);
  expect(submitRes.json()).toEqual({
    packCode: "delivery_ops",
    versionNo: 1,
    submittedBy: "alice",
    status: "submitted",
  });
});

test("runtime endpoints return active and historical packs", async () => {
  const app = buildApp();

  await app.inject({
    method: "POST",
    url: "/packs",
    payload: { packCode: "delivery_ops", name: "Delivery Ops" },
  });

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

  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions",
    payload: {
      contentJson: makePack("1.1.0"),
      schemaVersion: "1.0.0",
      changeNote: "v2",
      createdBy: "tester",
    },
  });

  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/2/submit",
    payload: { submittedBy: "alice" },
  });
  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/2/approvals",
    payload: { stage: "hr_review", decision: "approved", comment: "ok", reviewer: "alice" },
  });
  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/2/approvals",
    payload: { stage: "business_review", decision: "approved", comment: "ok", reviewer: "bob" },
  });
  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/2/approvals",
    payload: { stage: "security_review", decision: "approved", comment: "ok", reviewer: "sec" },
  });

  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/2/release",
    payload: { environment: "prod", releasedBy: "release-bot" },
  });

  const activeRes = (await app.inject({
    method: "GET",
    url: "/runtime/packs/delivery_ops?env=prod",
  })) as any;

  expect(activeRes.statusCode).toBe(200);
  expect(activeRes.json()).toEqual({ pack: makePack("1.1.0"), versionNo: 2, environment: "prod" });

  const replayRes = (await app.inject({
    method: "GET",
    url: "/runtime/packs/delivery_ops/1",
  })) as any;

  expect(replayRes.statusCode).toBe(200);
  expect(replayRes.json()).toEqual({ pack: makePack("1.0.0"), versionNo: 1 });
});
