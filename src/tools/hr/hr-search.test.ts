import { test, expect } from "bun:test";
import { createRunContext } from "../../agent/run-context";
import { hrSearch } from "./hr-search";

test("hr_search loads config by businessLine and tags pack_version", async () => {
  const calls: Array<{ businessLine: string; env: string }> = [];
  const ctx = createRunContext({
    configClient: {
      async getActivePack(businessLine: string, env = "prod") {
        calls.push({ businessLine, env });
        return {
          id: "delivery_ops",
          version: "1.0.0",
          businessLine: "delivery_ops",
          roleProfiles: [],
          metricProxies: [],
          scorePolicies: [],
        };
      },
    },
  });

  const result = await hrSearch({ businessLine: "delivery_ops" }, ctx);

  expect(calls).toEqual([{ businessLine: "delivery_ops", env: "prod" }]);
  expect(ctx.packVersion).toBe("1.0.0");
  expect(result.packVersion).toBe("1.0.0");
});
