import type { AuditLogRecord, ConfigStore } from "../repositories/store";

export type { AuditLogRecord };

export class AuditService {
  constructor(private readonly store: ConfigStore) {}

  async write(input: Omit<AuditLogRecord, "id" | "createdAt">): Promise<AuditLogRecord> {
    return this.store.writeAudit(input);
  }

  async list(): Promise<AuditLogRecord[]> {
    return this.store.listAudit();
  }
}
