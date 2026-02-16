import type { z } from "zod";
import { DomainPackSchema } from "@domain-pack-schema";
import { MemoryCache } from "./cache";

export type DomainPack = z.infer<typeof DomainPackSchema>;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type ConfigClientOptions = {
  baseUrl: string;
  cacheTtlMs?: number;
  fetchImpl?: FetchLike;
};

export class ConfigClient {
  private readonly baseUrl: string;

  private readonly cacheTtlMs: number;

  private readonly fetchImpl: FetchLike;

  private readonly cache = new MemoryCache<DomainPack>();

  private readonly lastKnown = new Map<string, DomainPack>();

  constructor(options: ConfigClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.cacheTtlMs = options.cacheTtlMs ?? 60_000;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  async getActivePack(businessLine: string, env = "prod"): Promise<DomainPack> {
    const key = `${businessLine}:${env}`;
    const cached = this.cache.get(key);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.fetchImpl(
        `${this.baseUrl}/runtime/packs/${businessLine}?env=${env}`,
      );

      if (!response.ok) {
        throw new Error(`fetch_failed_${response.status}`);
      }

      const payload = (await response.json()) as { pack?: unknown } | unknown;
      const parsed = DomainPackSchema.parse(
        typeof payload === "object" && payload !== null && "pack" in payload
          ? payload.pack
          : payload,
      );

      this.cache.set(key, parsed, this.cacheTtlMs);
      this.lastKnown.set(key, parsed);

      return parsed;
    } catch (error) {
      const fallback = this.lastKnown.get(key);
      if (fallback) {
        return fallback;
      }

      throw error;
    }
  }
}
