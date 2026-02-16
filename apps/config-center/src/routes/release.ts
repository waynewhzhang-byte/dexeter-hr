import type { FastifyInstance } from "fastify";
import type { ReleaseService } from "../services/release-service";

type RegisterReleaseRoutesOptions = {
  releaseService: ReleaseService;
};

export function registerReleaseRoutes(
  app: FastifyInstance,
  { releaseService }: RegisterReleaseRoutesOptions,
) {
  app.post<{ Params: { packCode: string; versionNo: string } }>(
    "/packs/:packCode/versions/:versionNo/validate",
    async (request, reply) => {
      const versionNo = Number(request.params.versionNo);
      if (!Number.isInteger(versionNo) || versionNo < 1) {
        reply.code(400);
        return { message: "invalid version number" };
      }

      try {
        const result = await releaseService.validateVersion(request.params.packCode, versionNo);

        if (!result.valid) {
          reply.code(400);
          return { message: "invalid domain pack schema", issues: result.issues };
        }

        return { valid: true };
      } catch (error) {
        if (error instanceof Error && error.message === "version_not_found") {
          reply.code(404);
          return { message: "version not found" };
        }

        throw error;
      }
    },
  );

  app.post<{
    Params: { packCode: string; versionNo: string };
    Body: { environment: "dev" | "staging" | "prod"; releasedBy: string };
  }>("/packs/:packCode/versions/:versionNo/release", async (request, reply) => {
    const versionNo = Number(request.params.versionNo);
    if (!Number.isInteger(versionNo) || versionNo < 1) {
      reply.code(400);
      return { message: "invalid version number" };
    }

    try {
      return await releaseService.releaseVersion({
        packCode: request.params.packCode,
        versionNo,
        environment: request.body.environment,
        releasedBy: request.body.releasedBy,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "version_not_found") {
        reply.code(404);
        return { message: "version not found" };
      }

      if (error instanceof Error && error.message.startsWith("release_not_ready:")) {
        reply.code(409);
        return { message: "release not ready", reason: error.message.split(":")[1] };
      }

      throw error;
    }
  });
}
