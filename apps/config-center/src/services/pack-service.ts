export type Pack = {
  packCode: string;
  name: string;
  status: "draft";
};

export type PackVersion = {
  packCode: string;
  versionNo: number;
  schemaVersion: string;
  changeNote: string;
  createdBy: string;
  contentJson: unknown;
};

export class PackService {
  private packs = new Map<string, Pack>();

  private versions = new Map<string, PackVersion[]>();

  createPack(input: { packCode: string; name: string }): Pack {
    if (this.packs.has(input.packCode)) {
      throw new Error("pack_exists");
    }

    const pack: Pack = {
      packCode: input.packCode,
      name: input.name,
      status: "draft",
    };

    this.packs.set(pack.packCode, pack);
    this.versions.set(pack.packCode, []);

    return pack;
  }

  createPackVersion(input: {
    packCode: string;
    schemaVersion: string;
    changeNote: string;
    createdBy: string;
    contentJson: unknown;
  }): PackVersion {
    const existingPack = this.packs.get(input.packCode);
    if (!existingPack) {
      throw new Error("pack_not_found");
    }

    const versions = this.versions.get(input.packCode) ?? [];
    const version: PackVersion = {
      packCode: input.packCode,
      versionNo: versions.length + 1,
      schemaVersion: input.schemaVersion,
      changeNote: input.changeNote,
      createdBy: input.createdBy,
      contentJson: input.contentJson,
    };

    versions.push(version);
    this.versions.set(input.packCode, versions);

    return version;
  }

  getPackVersion(packCode: string, versionNo: number): PackVersion | null {
    const versions = this.versions.get(packCode) ?? [];
    return versions.find((version) => version.versionNo === versionNo) ?? null;
  }
}
