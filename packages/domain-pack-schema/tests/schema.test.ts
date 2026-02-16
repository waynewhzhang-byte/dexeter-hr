import { test, expect } from "bun:test";
import { DomainPackSchema } from "../src";

test("valid domain pack passes schema", () => {
  const parsed = DomainPackSchema.parse({
    id: "delivery_ops",
    version: "1.0.0",
    businessLine: "delivery_ops",
    roleProfiles: [],
    metricProxies: [],
    scorePolicies: [],
  });

  expect(parsed.id).toBe("delivery_ops");
});
