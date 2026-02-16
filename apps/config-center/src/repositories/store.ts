import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";

export type Environment = "dev" | "staging" | "prod";

export type ApprovalStage = "hr_review" | "business_review" | "security_review";

export type ApprovalDecision = "approved" | "rejected";

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

export type SubmittedPackVersion = {
  packCode: string;
  versionNo: number;
  submittedBy: string;
  status: "submitted";
};

export type ReleaseBinding = {
  packCode: string;
  environment: Environment;
  activeVersionNo: number;
  releasedBy: string;
};

export type ApprovalRecord = {
  stage: ApprovalStage;
  decision: ApprovalDecision;
  comment: string;
  reviewer: string;
  reviewedAt: string;
};

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

export type ConfigStore = {
  createPack(input: { packCode: string; name: string }): Promise<Pack>;
  getPack(packCode: string): Promise<Pack | null>;
  createPackVersion(input: {
    packCode: string;
    schemaVersion: string;
    changeNote: string;
    createdBy: string;
    contentJson: unknown;
  }): Promise<PackVersion>;
  getPackVersion(packCode: string, versionNo: number): Promise<PackVersion | null>;
  submitPackVersion(input: {
    packCode: string;
    versionNo: number;
    submittedBy: string;
  }): Promise<SubmittedPackVersion>;
  setReleaseBinding(input: {
    packCode: string;
    versionNo: number;
    environment: Environment;
    releasedBy: string;
  }): Promise<ReleaseBinding>;
  getReleaseBinding(packCode: string, environment: Environment): Promise<ReleaseBinding | null>;
  createApproval(input: {
    packCode: string;
    versionNo: number;
    stage: ApprovalStage;
    decision: ApprovalDecision;
    comment: string;
    reviewer: string;
  }): Promise<ApprovalRecord>;
  listApprovals(packCode: string, versionNo: number): Promise<ApprovalRecord[]>;
  writeAudit(input: Omit<AuditLogRecord, "id" | "createdAt">): Promise<AuditLogRecord>;
  listAudit(): Promise<AuditLogRecord[]>;
};

class InMemoryConfigStore implements ConfigStore {
  private packs = new Map<string, Pack>();

  private versions = new Map<string, PackVersion[]>();

  private submittedVersions = new Map<string, SubmittedPackVersion>();

  private releaseBindings = new Map<string, ReleaseBinding>();

  private approvals = new Map<string, ApprovalRecord[]>();

  private auditLogs: AuditLogRecord[] = [];

  async createPack(input: { packCode: string; name: string }): Promise<Pack> {
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

  async getPack(packCode: string): Promise<Pack | null> {
    return this.packs.get(packCode) ?? null;
  }

  async createPackVersion(input: {
    packCode: string;
    schemaVersion: string;
    changeNote: string;
    createdBy: string;
    contentJson: unknown;
  }): Promise<PackVersion> {
    const pack = await this.getPack(input.packCode);
    if (!pack) {
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

  async getPackVersion(packCode: string, versionNo: number): Promise<PackVersion | null> {
    const versions = this.versions.get(packCode) ?? [];
    return versions.find((version) => version.versionNo === versionNo) ?? null;
  }

  async submitPackVersion(input: {
    packCode: string;
    versionNo: number;
    submittedBy: string;
  }): Promise<SubmittedPackVersion> {
    const version = await this.getPackVersion(input.packCode, input.versionNo);
    if (!version) {
      throw new Error("version_not_found");
    }

    const submitted: SubmittedPackVersion = {
      packCode: input.packCode,
      versionNo: input.versionNo,
      submittedBy: input.submittedBy,
      status: "submitted",
    };

    this.submittedVersions.set(`${input.packCode}:${input.versionNo}`, submitted);

    await this.writeAudit({
      actor: input.submittedBy,
      action: "pack_version.submitted",
      resourceType: "pack_version",
      resourceId: `${input.packCode}:${input.versionNo}`,
      beforeJson: null,
      afterJson: submitted,
    });

    return submitted;
  }

  async setReleaseBinding(input: {
    packCode: string;
    versionNo: number;
    environment: Environment;
    releasedBy: string;
  }): Promise<ReleaseBinding> {
    const version = await this.getPackVersion(input.packCode, input.versionNo);
    if (!version) {
      throw new Error("version_not_found");
    }

    const binding: ReleaseBinding = {
      packCode: input.packCode,
      environment: input.environment,
      activeVersionNo: input.versionNo,
      releasedBy: input.releasedBy,
    };

    this.releaseBindings.set(`${input.packCode}:${input.environment}`, binding);

    return binding;
  }

  async getReleaseBinding(packCode: string, environment: Environment): Promise<ReleaseBinding | null> {
    return this.releaseBindings.get(`${packCode}:${environment}`) ?? null;
  }

  async createApproval(input: {
    packCode: string;
    versionNo: number;
    stage: ApprovalStage;
    decision: ApprovalDecision;
    comment: string;
    reviewer: string;
  }): Promise<ApprovalRecord> {
    const version = await this.getPackVersion(input.packCode, input.versionNo);
    if (!version) {
      throw new Error("version_not_found");
    }

    const approval: ApprovalRecord = {
      stage: input.stage,
      decision: input.decision,
      comment: input.comment,
      reviewer: input.reviewer,
      reviewedAt: new Date().toISOString(),
    };

    const key = `${input.packCode}:${input.versionNo}`;
    const approvals = this.approvals.get(key) ?? [];
    approvals.push(approval);
    this.approvals.set(key, approvals);

    return approval;
  }

  async listApprovals(packCode: string, versionNo: number): Promise<ApprovalRecord[]> {
    return [...(this.approvals.get(`${packCode}:${versionNo}`) ?? [])];
  }

  async writeAudit(input: Omit<AuditLogRecord, "id" | "createdAt">): Promise<AuditLogRecord> {
    const log: AuditLogRecord = {
      id: `audit-${this.auditLogs.length + 1}`,
      createdAt: new Date().toISOString(),
      ...input,
    };

    this.auditLogs.push(log);
    return log;
  }

  async listAudit(): Promise<AuditLogRecord[]> {
    return [...this.auditLogs];
  }
}

class PostgresConfigStore implements ConfigStore {
  constructor(private readonly client: PoolClient | Pool) {}

  private async findPackRow(packCode: string): Promise<{ id: string; pack_code: string; name: string } | null> {
    const res = await this.client.query<{
      id: string;
      pack_code: string;
      name: string;
      status: string;
    }>("select id, pack_code, name, status from domain_pack where pack_code = $1", [packCode]);

    return res.rows[0] ?? null;
  }

  private async findVersionRow(packCode: string, versionNo: number): Promise<{
    id: string;
    version_no: number;
    schema_version: string;
    change_note: string | null;
    created_by: string;
    content_json: unknown;
  } | null> {
    const res = await this.client.query<{
      id: string;
      version_no: number;
      schema_version: string;
      change_note: string | null;
      created_by: string;
      content_json: unknown;
    }>(
      `select v.id, v.version_no, v.schema_version, v.change_note, v.created_by, v.content_json
       from domain_pack_version v
       join domain_pack p on p.id = v.pack_id
       where p.pack_code = $1 and v.version_no = $2`,
      [packCode, versionNo],
    );

    return res.rows[0] ?? null;
  }

  async createPack(input: { packCode: string; name: string }): Promise<Pack> {
    try {
      await this.client.query(
        "insert into domain_pack (id, pack_code, name, status, created_at, updated_at) values ($1, $2, $3, 'draft', now(), now())",
        [randomUUID(), input.packCode, input.name],
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") {
        throw new Error("pack_exists");
      }
      throw error;
    }

    return {
      packCode: input.packCode,
      name: input.name,
      status: "draft",
    };
  }

  async getPack(packCode: string): Promise<Pack | null> {
    const row = await this.findPackRow(packCode);
    if (!row) {
      return null;
    }

    return {
      packCode: row.pack_code,
      name: row.name,
      status: "draft",
    };
  }

  async createPackVersion(input: {
    packCode: string;
    schemaVersion: string;
    changeNote: string;
    createdBy: string;
    contentJson: unknown;
  }): Promise<PackVersion> {
    const pack = await this.findPackRow(input.packCode);
    if (!pack) {
      throw new Error("pack_not_found");
    }

    const versionRes = await this.client.query<{ next_version: string | number }>(
      "select coalesce(max(version_no), 0) + 1 as next_version from domain_pack_version where pack_id = $1",
      [pack.id],
    );

    const versionNo = Number(versionRes.rows[0]?.next_version ?? 1);

    await this.client.query(
      `insert into domain_pack_version
      (id, pack_id, version_no, content_json, schema_version, change_note, created_by, created_at)
      values ($1, $2, $3, $4::jsonb, $5, $6, $7, now())`,
      [
        randomUUID(),
        pack.id,
        versionNo,
        JSON.stringify(input.contentJson),
        input.schemaVersion,
        input.changeNote,
        input.createdBy,
      ],
    );

    return {
      packCode: input.packCode,
      versionNo,
      schemaVersion: input.schemaVersion,
      changeNote: input.changeNote,
      createdBy: input.createdBy,
      contentJson: input.contentJson,
    };
  }

  async getPackVersion(packCode: string, versionNo: number): Promise<PackVersion | null> {
    const row = await this.findVersionRow(packCode, versionNo);
    if (!row) {
      return null;
    }

    return {
      packCode,
      versionNo: row.version_no,
      schemaVersion: row.schema_version,
      changeNote: row.change_note ?? "",
      createdBy: row.created_by,
      contentJson: row.content_json,
    };
  }

  async submitPackVersion(input: {
    packCode: string;
    versionNo: number;
    submittedBy: string;
  }): Promise<SubmittedPackVersion> {
    const version = await this.findVersionRow(input.packCode, input.versionNo);
    if (!version) {
      throw new Error("version_not_found");
    }

    const submitted: SubmittedPackVersion = {
      packCode: input.packCode,
      versionNo: input.versionNo,
      submittedBy: input.submittedBy,
      status: "submitted",
    };

    await this.writeAudit({
      actor: input.submittedBy,
      action: "pack_version.submitted",
      resourceType: "pack_version",
      resourceId: `${input.packCode}:${input.versionNo}`,
      beforeJson: null,
      afterJson: submitted,
    });

    return submitted;
  }

  async setReleaseBinding(input: {
    packCode: string;
    versionNo: number;
    environment: Environment;
    releasedBy: string;
  }): Promise<ReleaseBinding> {
    const idsRes = await this.client.query<{ pack_id: string; version_id: string }>(
      `select p.id as pack_id, v.id as version_id
       from domain_pack p
       join domain_pack_version v on v.pack_id = p.id
       where p.pack_code = $1 and v.version_no = $2`,
      [input.packCode, input.versionNo],
    );

    const ids = idsRes.rows[0];
    if (!ids) {
      throw new Error("version_not_found");
    }

    await this.client.query(
      `insert into release_binding
      (id, pack_id, environment, active_version_id, released_by, released_at)
      values ($1, $2, $3, $4, $5, now())
      on conflict (pack_id, environment)
      do update set
        active_version_id = excluded.active_version_id,
        released_by = excluded.released_by,
        released_at = excluded.released_at`,
      [randomUUID(), ids.pack_id, input.environment, ids.version_id, input.releasedBy],
    );

    return {
      packCode: input.packCode,
      environment: input.environment,
      activeVersionNo: input.versionNo,
      releasedBy: input.releasedBy,
    };
  }

  async getReleaseBinding(packCode: string, environment: Environment): Promise<ReleaseBinding | null> {
    const res = await this.client.query<{
      pack_code: string;
      environment: Environment;
      active_version_no: number;
      released_by: string;
    }>(
      `select p.pack_code, rb.environment, v.version_no as active_version_no, rb.released_by
       from release_binding rb
       join domain_pack p on p.id = rb.pack_id
       join domain_pack_version v on v.id = rb.active_version_id
       where p.pack_code = $1 and rb.environment = $2`,
      [packCode, environment],
    );

    const row = res.rows[0];
    if (!row) {
      return null;
    }

    return {
      packCode: row.pack_code,
      environment: row.environment,
      activeVersionNo: Number(row.active_version_no),
      releasedBy: row.released_by,
    };
  }

  async createApproval(input: {
    packCode: string;
    versionNo: number;
    stage: ApprovalStage;
    decision: ApprovalDecision;
    comment: string;
    reviewer: string;
  }): Promise<ApprovalRecord> {
    const version = await this.findVersionRow(input.packCode, input.versionNo);
    if (!version) {
      throw new Error("version_not_found");
    }

    const res = await this.client.query<{ reviewed_at: Date | string }>(
      `insert into approval_record
      (id, pack_version_id, stage, decision, comment, reviewer, reviewed_at)
      values ($1, $2, $3, $4, $5, $6, now())
      returning reviewed_at`,
      [randomUUID(), version.id, input.stage, input.decision, input.comment, input.reviewer],
    );

    const reviewedAt = res.rows[0]?.reviewed_at;

    return {
      stage: input.stage,
      decision: input.decision,
      comment: input.comment,
      reviewer: input.reviewer,
      reviewedAt: new Date(reviewedAt ?? Date.now()).toISOString(),
    };
  }

  async listApprovals(packCode: string, versionNo: number): Promise<ApprovalRecord[]> {
    const res = await this.client.query<{
      stage: ApprovalStage;
      decision: ApprovalDecision;
      comment: string | null;
      reviewer: string;
      reviewed_at: Date | string;
    }>(
      `select ar.stage, ar.decision, ar.comment, ar.reviewer, ar.reviewed_at
       from approval_record ar
       join domain_pack_version v on v.id = ar.pack_version_id
       join domain_pack p on p.id = v.pack_id
       where p.pack_code = $1 and v.version_no = $2
       order by ar.reviewed_at asc`,
      [packCode, versionNo],
    );

    return res.rows.map((row) => ({
      stage: row.stage,
      decision: row.decision,
      comment: row.comment ?? "",
      reviewer: row.reviewer,
      reviewedAt: new Date(row.reviewed_at).toISOString(),
    }));
  }

  async writeAudit(input: Omit<AuditLogRecord, "id" | "createdAt">): Promise<AuditLogRecord> {
    const id = randomUUID();

    const res = await this.client.query<{ created_at: Date | string }>(
      `insert into config_audit_log
      (id, actor, action, resource_type, resource_id, before_json, after_json, created_at)
      values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, now())
      returning created_at`,
      [
        id,
        input.actor,
        input.action,
        input.resourceType,
        input.resourceId,
        JSON.stringify(input.beforeJson ?? null),
        JSON.stringify(input.afterJson ?? null),
      ],
    );

    return {
      id,
      actor: input.actor,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      beforeJson: input.beforeJson,
      afterJson: input.afterJson,
      createdAt: new Date(res.rows[0]?.created_at ?? Date.now()).toISOString(),
    };
  }

  async listAudit(): Promise<AuditLogRecord[]> {
    const res = await this.client.query<{
      id: string;
      actor: string;
      action: string;
      resource_type: string;
      resource_id: string;
      before_json: unknown;
      after_json: unknown;
      created_at: Date | string;
    }>(
      `select id, actor, action, resource_type, resource_id, before_json, after_json, created_at
       from config_audit_log
       order by created_at asc`,
    );

    return res.rows.map((row) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      beforeJson: row.before_json,
      afterJson: row.after_json,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }
}

export function createConfigStore(options?: { databaseUrl?: string | null }): {
  mode: "memory" | "postgres";
  store: ConfigStore;
  dispose?: () => Promise<void>;
} {
  if (options?.databaseUrl) {
    const pool = new Pool({ connectionString: options.databaseUrl });
    return {
      mode: "postgres",
      store: new PostgresConfigStore(pool),
      dispose: async () => {
        await pool.end();
      },
    };
  }

  return {
    mode: "memory",
    store: new InMemoryConfigStore(),
  };
}
