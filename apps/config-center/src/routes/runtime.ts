import type { FastifyInstance } from "fastify";
import type { PackService } from "../services/pack-service";
import type { ReleaseService } from "../services/release-service";

type RegisterRuntimeRoutesOptions = {
  packService: PackService;
  releaseService: ReleaseService;
};

export function registerRuntimeRoutes(
  app: FastifyInstance,
  { packService, releaseService }: RegisterRuntimeRoutesOptions,
) {
  app.get<{ Params: { businessLine: string }; Querystring: { env?: "dev" | "staging" | "prod" } }>(
    "/runtime/packs/:businessLine",
    async (request, reply) => {
      const env = request.query.env ?? "prod";
      const activeVersionNo = await releaseService.getActiveVersionNo(request.params.businessLine, env);

      if (!activeVersionNo) {
        reply.code(404);
        return { message: "active version not found" };
      }

      const version = await packService.getPackVersion(request.params.businessLine, activeVersionNo);
      if (!version) {
        reply.code(404);
        return { message: "active version payload not found" };
      }

      return { pack: version.contentJson, versionNo: version.versionNo, environment: env };
    },
  );

  app.get<{ Params: { businessLine: string; versionNo: string } }>(
    "/runtime/packs/:businessLine/:versionNo",
    async (request, reply) => {
      const versionNo = Number(request.params.versionNo);
      if (!Number.isInteger(versionNo) || versionNo < 1) {
        reply.code(400);
        return { message: "invalid version number" };
      }

      const version = await packService.getPackVersion(request.params.businessLine, versionNo);
      if (!version) {
        reply.code(404);
        return { message: "version not found" };
      }

      return { pack: version.contentJson, versionNo: version.versionNo };
    },
  );
}
