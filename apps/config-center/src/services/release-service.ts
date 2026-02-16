import { DomainPackSchema } from "../../../../packages/domain-pack-schema/src";
import type { ConfigStore, Environment, ReleaseBinding } from "../repositories/store";

export type { ReleaseBinding };

export class ReleaseService {
  constructor(private readonly store: ConfigStore) {}

  async validateVersion(packCode: string, versionNo: number) {
    const version = await this.store.getPackVersion(packCode, versionNo);
    if (!version) {
      throw new Error("version_not_found");
    }

    const parsed = DomainPackSchema.safeParse(version.contentJson);
    if (!parsed.success) {
      return {
        valid: false,
        issues: parsed.error.issues.map((issue) => issue.message),
      };
    }

    return { valid: true, issues: [] as string[] };
  }

  async releaseVersion(input: {
    packCode: string;
    versionNo: number;
    environment: Environment;
    releasedBy: string;
  }): Promise<ReleaseBinding> {
    return this.store.setReleaseBinding(input);
  }

  async getActiveVersionNo(packCode: string, environment: Environment): Promise<number | null> {
    const binding = await this.store.getReleaseBinding(packCode, environment);
    return binding?.activeVersionNo ?? null;
  }
}
