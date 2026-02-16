import type { FastifyInstance } from "fastify";
import type { AuditService } from "../services/audit-service";
import type { PackService } from "../services/pack-service";

type ApprovalRecord = {
  stage: "hr_review" | "business_review" | "security_review";
  decision: "approved" | "rejected";
  comment: string;
  reviewer: string;
  reviewedAt: string;
};

type RegisterApprovalRoutesOptions = {
  packService: PackService;
  auditService: AuditService;
};

export function registerApprovalRoutes(
  app: FastifyInstance,
  { packService, auditService }: RegisterApprovalRoutesOptions,
) {
  const approvalsByVersion = new Map<string, ApprovalRecord[]>();

  app.post<{
    Params: { packCode: string; versionNo: string };
    Body: {
      stage: ApprovalRecord["stage"];
      decision: ApprovalRecord["decision"];
      comment: string;
      reviewer: string;
    };
  }>("/packs/:packCode/versions/:versionNo/approvals", async (request, reply) => {
    const versionNo = Number(request.params.versionNo);
    if (!Number.isInteger(versionNo) || versionNo < 1) {
      reply.code(400);
      return { message: "invalid version number" };
    }

    const version = packService.getPackVersion(request.params.packCode, versionNo);
    if (!version) {
      reply.code(404);
      return { message: "version not found" };
    }

    const approval: ApprovalRecord = {
      stage: request.body.stage,
      decision: request.body.decision,
      comment: request.body.comment,
      reviewer: request.body.reviewer,
      reviewedAt: new Date().toISOString(),
    };

    const key = `${request.params.packCode}:${versionNo}`;
    const list = approvalsByVersion.get(key) ?? [];
    list.push(approval);
    approvalsByVersion.set(key, list);

    auditService.write({
      actor: request.body.reviewer,
      action: "approval_record.created",
      resourceType: "approval_record",
      resourceId: `${request.params.packCode}:${versionNo}:${list.length}`,
      beforeJson: null,
      afterJson: approval,
    });

    reply.code(201);
    return approval;
  });

  app.get<{ Params: { packCode: string; versionNo: string } }>(
    "/packs/:packCode/versions/:versionNo/approvals",
    async (request, reply) => {
      const versionNo = Number(request.params.versionNo);
      if (!Number.isInteger(versionNo) || versionNo < 1) {
        reply.code(400);
        return { message: "invalid version number" };
      }

      const key = `${request.params.packCode}:${versionNo}`;
      return approvalsByVersion.get(key) ?? [];
    },
  );

  app.get("/audit-logs", async () => auditService.list());
}
