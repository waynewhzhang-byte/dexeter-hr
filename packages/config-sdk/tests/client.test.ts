import { test, expect } from "bun:test";
import { ConfigClient } from "../src/client";

function makeDomainPack(version: string) {
  return {
    id: "delivery_ops",
    version,
    businessLine: "delivery_ops",
    roleProfiles: [],
    metricProxies: [],
    scorePolicies: [],
  };
}

test("sdk returns active pack for business line", async () => {
  let callCount = 0;
  const client = new ConfigClient({
    baseUrl: "http://config-center.local",
    fetchImpl: async () => {
      callCount += 1;
      return new Response(JSON.stringify({ pack: makeDomainPack("1.0.0") }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const pack = await client.getActivePack("delivery_ops", "prod");

  expect(pack.id).toBe("delivery_ops");
  expect(pack.version).toBe("1.0.0");
  expect(callCount).toBe(1);
});

test("sdk falls back to last known version on fetch failure", async () => {
  let callCount = 0;
  const client = new ConfigClient({
    baseUrl: "http://config-center.local",
    cacheTtlMs: 0,
    fetchImpl: async () => {
      callCount += 1;
      if (callCount === 1) {
        return new Response(JSON.stringify({ pack: makeDomainPack("1.0.0") }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error("network error");
    },
  });

  const first = await client.getActivePack("delivery_ops", "prod");
  const second = await client.getActivePack("delivery_ops", "prod");

  expect(first.version).toBe("1.0.0");
  expect(second.version).toBe("1.0.0");
  expect(callCount).toBe(2);
});
