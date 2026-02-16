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

test("validate endpoint rejects invalid schema", async () => {
  const app = buildApp();

  await app.inject({
    method: "POST",
    url: "/packs",
    payload: {
      packCode: "delivery_ops",
      name: "Delivery Ops",
    },
  });

  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions",
    payload: {
      contentJson: { id: "delivery_ops" },
      schemaVersion: "1.0.0",
      changeNote: "invalid draft",
      createdBy: "tester",
    },
  });

  const res = (await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/validate",
  })) as any;

  expect(res.statusCode).toBe(400);
  expect(res.json().message).toBe("invalid domain pack schema");
});

test("release endpoint updates active version for env", async () => {
  const app = buildApp();

  await app.inject({
    method: "POST",
    url: "/packs",
    payload: {
      packCode: "delivery_ops",
      name: "Delivery Ops",
    },
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

  await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions",
    payload: {
      contentJson: makeValidDomainPack("1.1.0"),
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

  const first = (await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/1/release",
    payload: {
      environment: "prod",
      releasedBy: "release-bot",
    },
  })) as any;

  expect(first.statusCode).toBe(200);
  expect(first.json()).toEqual({
    packCode: "delivery_ops",
    environment: "prod",
    activeVersionNo: 1,
    releasedBy: "release-bot",
  });

  const second = (await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions/2/release",
    payload: {
      environment: "prod",
      releasedBy: "release-bot",
    },
  })) as any;

  expect(second.statusCode).toBe(200);
  expect(second.json()).toEqual({
    packCode: "delivery_ops",
    environment: "prod",
    activeVersionNo: 2,
    releasedBy: "release-bot",
  });
});
