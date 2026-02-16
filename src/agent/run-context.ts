import type { ConfigClient } from "@config-sdk";

type ConfigClientLike = Pick<ConfigClient, "getActivePack">;

export type RunContext = {
  configClient: ConfigClientLike;
  packVersion: string | null;
};

export function createRunContext(input: { configClient: ConfigClientLike }): RunContext {
  return {
    configClient: input.configClient,
    packVersion: null,
  };
}
