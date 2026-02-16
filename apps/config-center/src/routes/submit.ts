import type { FastifyInstance } from "fastify";
import type { PackService } from "../services/pack-service";

type RegisterSubmitRoutesOptions = {
  packService: PackService;
};

export function registerSubmitRoutes(
  app: FastifyInstance,
  { packService }: RegisterSubmitRoutesOptions,
) {
  app.post<{
    Params: { packCode: string; versionNo: string };
    Body: { submittedBy: string };
  }>("/packs/:packCode/versions/:versionNo/submit", async (request, reply) => {
    const versionNo = Number(request.params.versionNo);
    if (!Number.isInteger(versionNo) || versionNo < 1) {
      reply.code(400);
      return { message: "invalid version number" };
    }

    try {
      return await packService.submitPackVersion({
        packCode: request.params.packCode,
        versionNo,
        submittedBy: request.body.submittedBy,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "version_not_found") {
        reply.code(404);
        return { message: "version not found" };
      }

      throw error;
    }
  });
}
