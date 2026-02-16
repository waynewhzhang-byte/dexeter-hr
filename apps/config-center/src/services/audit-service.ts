export type AuditLogRecord = {
  id: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeJson?: unknown;
  afterJson?: unknown;
  createdAt: string;
};

export class AuditService {
  private logs: AuditLogRecord[] = [];

  write(input: Omit<AuditLogRecord, "id" | "createdAt">): AuditLogRecord {
    const record: AuditLogRecord = {
      id: `audit-${this.logs.length + 1}`,
      createdAt: new Date().toISOString(),
      ...input,
    };

    this.logs.push(record);

    return record;
  }

  list(): AuditLogRecord[] {
    return [...this.logs];
  }
}
