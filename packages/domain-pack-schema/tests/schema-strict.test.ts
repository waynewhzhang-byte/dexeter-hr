import { test, expect } from "bun:test";
import { DomainPackSchema } from "../src";

test("strict domain pack schema accepts structured payload", () => {
  const parsed = DomainPackSchema.parse({
    id: "delivery_ops",
    version: "1.0.0",
    businessLine: "delivery_ops",
    roleProfiles: [
      {
        roleCode: "ops_manager",
        skills: [
          { code: "process_optimization", weight: 0.25, requiredLevel: 4 },
          { code: "cross_team_collaboration", weight: 0.2, requiredLevel: 4 },
        ],
      },
    ],
    metricProxies: [
      {
        metricCode: "delivery_on_time_rate",
        definition: "on time delivery ratio",
        source: "dwd_delivery_order_daily",
        refreshCron: "0 6 * * *",
      },
    ],
    scorePolicies: [
      {
        scoreType: "job_fit_score",
        formula: "0.5*skill_match + 0.3*experience_match + 0.2*behavior_match",
        thresholds: { high: 0.8, medium: 0.6 },
      },
    ],
  });

  expect(parsed.roleProfiles[0]?.roleCode).toBe("ops_manager");
});

test("strict domain pack schema rejects malformed role profile", () => {
  const result = DomainPackSchema.safeParse({
    id: "delivery_ops",
    version: "1.0.0",
    businessLine: "delivery_ops",
    roleProfiles: [{ wrongField: "ops_manager" }],
    metricProxies: [],
    scorePolicies: [],
  });

  expect(result.success).toBe(false);
});
