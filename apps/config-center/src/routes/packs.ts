import type { FastifyInstance } from "fastify";
import type { PackService } from "../services/pack-service";

type RegisterPackRoutesOptions = {
  packService: PackService;
};

export function registerPackRoutes(
  app: FastifyInstance,
  { packService }: RegisterPackRoutesOptions,
) {
  app.post<{ Body: { packCode: string; name: string } }>("/packs", async (request, reply) => {
    try {
      const pack = await packService.createPack(request.body);
      reply.code(201);
      return pack;
    } catch (error) {
      if (error instanceof Error && error.message === "pack_exists") {
        reply.code(409);
        return { message: "pack already exists" };
      }

      throw error;
    }
  });

  app.post<{
    Params: { packCode: string };
    Body: {
      schemaVersion: string;
      changeNote: string;
      createdBy: string;
      contentJson: unknown;
    };
  }>("/packs/:packCode/versions", async (request, reply) => {
    try {
      const version = await packService.createPackVersion({
        packCode: request.params.packCode,
        schemaVersion: request.body.schemaVersion,
        changeNote: request.body.changeNote,
        createdBy: request.body.createdBy,
        contentJson: request.body.contentJson,
      });
      reply.code(201);
      return version;
    } catch (error) {
      if (error instanceof Error && error.message === "pack_not_found") {
        reply.code(404);
        return { message: "pack not found" };
      }

      throw error;
    }
  });

  app.get<{ Params: { packCode: string; versionNo: string } }>(
    "/packs/:packCode/versions/:versionNo",
    async (request, reply) => {
      const versionNo = Number(request.params.versionNo);
      if (!Number.isInteger(versionNo) || versionNo < 1) {
        reply.code(400);
        return { message: "invalid version number" };
      }

      const version = await packService.getPackVersion(request.params.packCode, versionNo);
      if (!version) {
        reply.code(404);
        return { message: "version not found" };
      }

      return version;
    },
  );
}
