import { DomainPackSchema } from "../../../../packages/domain-pack-schema/src";
import type { PackService } from "./pack-service";

export type ReleaseBinding = {
  packCode: string;
  environment: "dev" | "staging" | "prod";
  activeVersionNo: number;
  releasedBy: string;
};

export class ReleaseService {
  private bindings = new Map<string, ReleaseBinding>();

  constructor(private readonly packService: PackService) {}

  validateVersion(packCode: string, versionNo: number) {
    const version = this.packService.getPackVersion(packCode, versionNo);
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

  releaseVersion(input: {
    packCode: string;
    versionNo: number;
    environment: "dev" | "staging" | "prod";
    releasedBy: string;
  }): ReleaseBinding {
    const version = this.packService.getPackVersion(input.packCode, input.versionNo);
    if (!version) {
      throw new Error("version_not_found");
    }

    const binding: ReleaseBinding = {
      packCode: input.packCode,
      environment: input.environment,
      activeVersionNo: input.versionNo,
      releasedBy: input.releasedBy,
    };

    this.bindings.set(`${input.packCode}:${input.environment}`, binding);

    return binding;
  }
}
