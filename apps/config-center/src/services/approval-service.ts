import type {
  ApprovalDecision,
  ApprovalRecord,
  ApprovalStage,
  ConfigStore,
} from "../repositories/store";

export class ApprovalService {
  constructor(private readonly store: ConfigStore) {}

  async createApproval(input: {
    packCode: string;
    versionNo: number;
    stage: ApprovalStage;
    decision: ApprovalDecision;
    comment: string;
    reviewer: string;
  }): Promise<ApprovalRecord> {
    const existing = await this.store.listApprovals(input.packCode, input.versionNo);
    const stageOrder: ApprovalStage[] = ["hr_review", "business_review", "security_review"];

    if (existing.some((record) => record.decision !== "approved")) {
      throw new Error("approval_blocked_by_rejection");
    }

    const expectedStage = stageOrder[existing.length];
    if (!expectedStage) {
      throw new Error("approval_workflow_completed");
    }

    if (input.stage !== expectedStage) {
      throw new Error(`invalid_approval_stage:${expectedStage}`);
    }

    return this.store.createApproval(input);
  }

  async listApprovals(packCode: string, versionNo: number): Promise<ApprovalRecord[]> {
    return this.store.listApprovals(packCode, versionNo);
  }
}
