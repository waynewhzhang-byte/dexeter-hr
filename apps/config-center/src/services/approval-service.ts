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
    return this.store.createApproval(input);
  }

  async listApprovals(packCode: string, versionNo: number): Promise<ApprovalRecord[]> {
    return this.store.listApprovals(packCode, versionNo);
  }
}
