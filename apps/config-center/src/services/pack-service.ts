import type { ConfigStore, Pack, PackVersion, SubmittedPackVersion } from "../repositories/store";

export type { Pack, PackVersion, SubmittedPackVersion };

export class PackService {
  constructor(private readonly store: ConfigStore) {}

  async createPack(input: { packCode: string; name: string }): Promise<Pack> {
    return this.store.createPack(input);
  }

  async createPackVersion(input: {
    packCode: string;
    schemaVersion: string;
    changeNote: string;
    createdBy: string;
    contentJson: unknown;
  }): Promise<PackVersion> {
    return this.store.createPackVersion(input);
  }

  async getPackVersion(packCode: string, versionNo: number): Promise<PackVersion | null> {
    return this.store.getPackVersion(packCode, versionNo);
  }

  async submitPackVersion(input: {
    packCode: string;
    versionNo: number;
    submittedBy: string;
  }): Promise<SubmittedPackVersion> {
    return this.store.submitPackVersion(input);
  }
}
