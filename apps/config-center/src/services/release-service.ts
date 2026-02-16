import { DomainPackSchema } from "../../../../packages/domain-pack-schema/src";
import type { ApprovalStage, ConfigStore, Environment, ReleaseBinding } from "../repositories/store";

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
    const submitted = await this.store.getSubmittedPackVersion(input.packCode, input.versionNo);
    if (!submitted) {
      throw new Error("release_not_ready:submission_required");
    }

    const approvals = await this.store.listApprovals(input.packCode, input.versionNo);
    const requiredStages: ApprovalStage[] = [
      "hr_review",
      "business_review",
      "security_review",
    ];

    for (let i = 0; i < requiredStages.length; i += 1) {
      const approval = approvals[i];
      if (!approval || approval.stage !== requiredStages[i] || approval.decision !== "approved") {
        throw new Error("release_not_ready:approval_incomplete");
      }
    }

    return this.store.setReleaseBinding(input);
  }

  async getActiveVersionNo(packCode: string, environment: Environment): Promise<number | null> {
    const binding = await this.store.getReleaseBinding(packCode, environment);
    return binding?.activeVersionNo ?? null;
  }
}
