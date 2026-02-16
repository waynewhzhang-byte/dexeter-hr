import { test, expect } from "bun:test";
import { buildApp } from "../src/app";

function makeValidDomainPack(version: string) {
  return {
    id: "delivery_ops",
    version,
    businessLine: "delivery_ops",
    roleProfiles: [],
    metricProxies: [],
    scorePolicies: [],
  };
}

test("approval decision is persisted", async () => {
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
      contentJson: makeValidDomainPack("1.0.0"),
      schemaVersion: "1.0.0",
      changeNote: "v1",
      createdBy: "tester",
    },
  });

  const createApprovalRes = (await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/approvals",
    payload: {
      stage: "hr_review",
      decision: "approved",
      comment: "looks good",
      reviewer: "alice",
    },
  })) as any;

  expect(createApprovalRes.statusCode).toBe(201);

  const listRes = (await app.inject({
    method: "GET",
    url: "/packs/delivery_ops/versions/1/approvals",
  })) as any;

  expect(listRes.statusCode).toBe(200);
  expect(listRes.json()).toEqual([
    expect.objectContaining({
      stage: "hr_review",
      decision: "approved",
      reviewer: "alice",
    }),
  ]);
});

test("config change writes audit log", async () => {
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
      contentJson: makeValidDomainPack("1.0.0"),
      schemaVersion: "1.0.0",
      changeNote: "v1",
      createdBy: "tester",
    },
  });

  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/approvals",
    payload: {
      stage: "business_review",
      decision: "approved",
      comment: "ok",
      reviewer: "bob",
    },
  });

  const logsRes = (await app.inject({
    method: "GET",
    url: "/audit-logs",
  })) as any;

  expect(logsRes.statusCode).toBe(200);
  expect(logsRes.json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "approval_record.created",
        resourceType: "approval_record",
      }),
    ]),
  );
});
