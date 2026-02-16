import type { RunContext } from "../../agent/run-context";

export async function hrSearch(
  input: { businessLine: string; env?: "dev" | "staging" | "prod" },
  ctx: RunContext,
) {
  const pack = await ctx.configClient.getActivePack(input.businessLine, input.env ?? "prod");
  ctx.packVersion = pack.version;

  return {
    businessLine: input.businessLine,
    packVersion: pack.version,
    pack,
  };
}
