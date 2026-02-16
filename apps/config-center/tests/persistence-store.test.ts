import { test, expect } from "bun:test";
import { createConfigStore } from "../src/repositories/store";

test("memory config store supports pack/version/release/approval/audit flow", async () => {
  const { store } = createConfigStore();

  const pack = await store.createPack({ packCode: "delivery_ops", name: "Delivery Ops" });
  expect(pack.packCode).toBe("delivery_ops");

  const version = await store.createPackVersion({
    packCode: "delivery_ops",
    schemaVersion: "1.0.0",
    changeNote: "init",
    createdBy: "tester",
    contentJson: {
      id: "delivery_ops",
      version: "1.0.0",
      businessLine: "delivery_ops",
      roleProfiles: [],
      metricProxies: [],
      scorePolicies: [],
    },
  });
  expect(version.versionNo).toBe(1);

  const release = await store.setReleaseBinding({
    packCode: "delivery_ops",
    versionNo: 1,
    environment: "prod",
    releasedBy: "release-bot",
  });
  expect(release.activeVersionNo).toBe(1);

  await store.createApproval({
    packCode: "delivery_ops",
    versionNo: 1,
    stage: "hr_review",
    decision: "approved",
    comment: "ok",
    reviewer: "alice",
  });

  const approvals = await store.listApprovals("delivery_ops", 1);
  expect(approvals).toHaveLength(1);
  expect(approvals[0]?.reviewer).toBe("alice");

  await store.writeAudit({
    actor: "alice",
    action: "approval_record.created",
    resourceType: "approval_record",
    resourceId: "delivery_ops:1:1",
    beforeJson: null,
    afterJson: approvals[0],
  });

  const logs = await store.listAudit();
  expect(logs).toHaveLength(1);
  expect(logs[0]?.action).toBe("approval_record.created");
});
