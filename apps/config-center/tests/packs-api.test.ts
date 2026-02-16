import { test, expect } from "bun:test";
import { buildApp } from "../src/app";

test("POST /packs creates a pack", async () => {
  const app = buildApp();

  const res = (await app.inject({
    method: "POST",
    url: "/packs",
    payload: {
      packCode: "delivery_ops",
      name: "Delivery Ops",
    },
  })) as any;

  expect(res.statusCode).toBe(201);
  expect(res.json()).toEqual({
    packCode: "delivery_ops",
    name: "Delivery Ops",
    status: "draft",
  });
});

test("POST /packs/:code/versions creates draft version", async () => {
  const app = buildApp();

  await app.inject({
    method: "POST",
    url: "/packs",
    payload: {
      packCode: "delivery_ops",
      name: "Delivery Ops",
    },
  });

  const createVersionRes = (await app.inject({
    method: "POST",
    url: "/packs/delivery_ops/versions",
    payload: {
      contentJson: { id: "delivery_ops" },
      schemaVersion: "1.0.0",
      changeNote: "initial draft",
      createdBy: "tester",
    },
  })) as any;

  expect(createVersionRes.statusCode).toBe(201);
  expect(createVersionRes.json()).toEqual({
    packCode: "delivery_ops",
    versionNo: 1,
    schemaVersion: "1.0.0",
    changeNote: "initial draft",
    createdBy: "tester",
    contentJson: { id: "delivery_ops" },
  });

  const getVersionRes = (await app.inject({
    method: "GET",
    url: "/packs/delivery_ops/versions/1",
  })) as any;

  expect(getVersionRes.statusCode).toBe(200);
  expect(getVersionRes.json()).toEqual(createVersionRes.json());
});
