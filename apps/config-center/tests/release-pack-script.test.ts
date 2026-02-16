import { test, expect } from "bun:test";
import { runReleasePack } from "../scripts/release-pack";

test("release script validates then releases target version", async () => {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];

  const result = await runReleasePack(
    {
      baseUrl: "http://config-center.local",
      packCode: "delivery_ops",
      versionNo: 2,
      environment: "staging",
      releasedBy: "release-bot",
    },
    {
      fetchImpl: async (input, init) => {
        calls.push({
          url: String(input),
          method: init?.method ?? "GET",
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        });

        if (String(input).includes("/validate")) {
          return new Response(JSON.stringify({ valid: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({
            packCode: "delivery_ops",
            environment: "staging",
            activeVersionNo: 2,
            releasedBy: "release-bot",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    },
  );

  expect(calls).toEqual([
    {
      url: "http://config-center.local/packs/delivery_ops/versions/2/validate",
      method: "POST",
      body: undefined,
    },
    {
      url: "http://config-center.local/packs/delivery_ops/versions/2/release",
      method: "POST",
      body: { environment: "staging", releasedBy: "release-bot" },
    },
  ]);

  expect(result.activeVersionNo).toBe(2);
});
