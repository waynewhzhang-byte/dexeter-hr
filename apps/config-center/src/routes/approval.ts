import type { FastifyInstance } from "fastify";
import type { ApprovalService } from "../services/approval-service";
import type { AuditService } from "../services/audit-service";

type RegisterApprovalRoutesOptions = {
  approvalService: ApprovalService;
  auditService: AuditService;
};

export function registerApprovalRoutes(
  app: FastifyInstance,
  { approvalService, auditService }: RegisterApprovalRoutesOptions,
) {
  app.post<{
    Params: { packCode: string; versionNo: string };
    Body: {
      stage: "hr_review" | "business_review" | "security_review";
      decision: "approved" | "rejected";
      comment: string;
      reviewer: string;
    };
  }>("/packs/:packCode/versions/:versionNo/approvals", async (request, reply) => {
    const versionNo = Number(request.params.versionNo);
    if (!Number.isInteger(versionNo) || versionNo < 1) {
      reply.code(400);
      return { message: "invalid version number" };
    }

    try {
      const approval = await approvalService.createApproval({
        packCode: request.params.packCode,
        versionNo,
        stage: request.body.stage,
        decision: request.body.decision,
        comment: request.body.comment,
        reviewer: request.body.reviewer,
      });

      await auditService.write({
        actor: request.body.reviewer,
        action: "approval_record.created",
        resourceType: "approval_record",
        resourceId: `${request.params.packCode}:${versionNo}`,
        beforeJson: null,
        afterJson: approval,
      });

      reply.code(201);
      return approval;
    } catch (error) {
      if (error instanceof Error && error.message === "version_not_found") {
        reply.code(404);
        return { message: "version not found" };
      }

      if (error instanceof Error && error.message.startsWith("invalid_approval_stage:")) {
        const expected = error.message.split(":")[1] ?? "unknown";
        reply.code(400);
        return { message: `invalid approval stage, expected ${expected}` };
      }

      if (error instanceof Error && error.message === "approval_blocked_by_rejection") {
        reply.code(409);
        return { message: "approval workflow blocked by rejection" };
      }

      if (error instanceof Error && error.message === "approval_workflow_completed") {
        reply.code(409);
        return { message: "approval workflow already completed" };
      }

      throw error;
    }
  });

  app.get<{ Params: { packCode: string; versionNo: string } }>(
    "/packs/:packCode/versions/:versionNo/approvals",
    async (request, reply) => {
      const versionNo = Number(request.params.versionNo);
      if (!Number.isInteger(versionNo) || versionNo < 1) {
        reply.code(400);
        return { message: "invalid version number" };
      }

      return approvalService.listApprovals(request.params.packCode, versionNo);
    },
  );

  app.get("/audit-logs", async () => auditService.list());
}
