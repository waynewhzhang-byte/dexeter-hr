# HR Config Center & Domain Pack Platform Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在一期直接落地“配置中心 + 数据库 + 发布治理 + 运行时加载SDK”，让 `业务线/岗位能力要求/产出代理指标` 完全配置化，不进入硬编码。

**Architecture:** 以 Dexter 的 Agent/Tool/Scratchpad 运行时为基座，新增独立 `Config Center` 服务管理 Domain Pack 版本；Agent 在每次任务执行前通过 `Config SDK` 拉取并缓存已发布配置，然后驱动 `hr_search` 与四大分析工具统一计算与解释。配置发布采用“草稿-评审-发布”流程，所有 Case 绑定 `pack_version`，保证审计与可回放。

**Tech Stack:** TypeScript, Bun, Fastify, PostgreSQL 16, Drizzle ORM, Zod, Redis(可选缓存), OpenAPI, Bun Test

## 1. Core Architecture Design (架构设计书)

### 1.1 设计原则

1. 配置驱动优先：业务线、岗位、指标、评分、建议策略全部配置化。
2. 版本不可变：已发布版本只读，历史 Case 不可被新版本污染。
3. 审计可追溯：每次输出必须携带 `pack_id + pack_version`。
4. 双角色同口径：业务视图与 HR 视图共享同一评分引擎和证据链。
5. 渐进扩展：一期先单业务线，但数据结构支持多业务线并行。

### 1.2 逻辑分层

1. `Config Center API`
- 负责 Domain Pack 的创建、编辑、校验、发布、回滚。
- 提供按 `business_line + env` 拉取当前生效版本的接口。

2. `Config Registry DB (Postgres)`
- 存储配置实体、版本快照、发布记录、审批记录、审计日志。

3. `Config SDK`
- 给 Agent Runtime 使用。
- 支持缓存、ETag/版本对比、失败降级（回退最近可用版本）。

4. `Agent Runtime (Dexter-HR)`
- 在工具执行前加载配置上下文。
- `hr_search` 依据配置路由并计算四大评分。

### 1.3 数据模型（一期最小可用）

1. `domain_pack`
- `id (uuid)` 主键
- `pack_code (text unique)` 如 `delivery_ops`
- `name`
- `status` (`draft|published|archived`)
- `created_at/updated_at`

2. `domain_pack_version`
- `id (uuid)`
- `pack_id`
- `version_no (int)` 递增
- `content_json (jsonb)` 完整不可变快照
- `schema_version (text)`
- `change_note`
- `created_by/created_at`

3. `release_binding`
- `id`
- `pack_id`
- `environment (dev|staging|prod)`
- `active_version_id`
- `released_by/released_at`

4. `approval_record`
- `id`
- `pack_version_id`
- `stage` (`hr_review|business_review|security_review`)
- `decision` (`approved|rejected`)
- `comment`
- `reviewer`
- `reviewed_at`

5. `config_audit_log`
- `id`
- `actor`
- `action`
- `resource_type`
- `resource_id`
- `before_json/after_json`
- `created_at`

### 1.4 Domain Pack JSON Schema（核心）

```json
{
  "id": "delivery_ops",
  "version": "1.0.0",
  "businessLine": "delivery_ops",
  "roleProfiles": [
    {
      "roleCode": "ops_manager",
      "skills": [
        { "code": "process_optimization", "weight": 0.25, "requiredLevel": 4 },
        { "code": "cross_team_collaboration", "weight": 0.2, "requiredLevel": 4 }
      ]
    }
  ],
  "metricProxies": [
    {
      "metricCode": "delivery_on_time_rate",
      "definition": "按期交付单量/总交付单量",
      "source": "dwd_delivery_order_daily",
      "refreshCron": "0 6 * * *"
    }
  ],
  "scorePolicies": [
    {
      "scoreType": "job_fit_score",
      "formula": "0.5*skill_match + 0.3*experience_match + 0.2*behavior_match",
      "thresholds": { "high": 0.8, "medium": 0.6 }
    }
  ]
}
```

### 1.5 关键 API（一期）

1. `POST /packs` 创建业务线包
2. `POST /packs/:packCode/versions` 创建新版本草稿
3. `POST /packs/:packCode/versions/:versionNo/validate` 结构校验+业务规则校验
4. `POST /packs/:packCode/versions/:versionNo/submit` 提交审批
5. `POST /packs/:packCode/versions/:versionNo/release` 发布到环境
6. `GET /runtime/packs/:businessLine?env=prod` 运行时拉取生效版本
7. `GET /runtime/packs/:businessLine/:versionNo` 回放指定版本

### 1.6 运行时流程（Agent 侧）

1. 接收请求，解析 `businessLine`。
2. `Config SDK` 拉取当前 `active_version`（本地缓存命中则直接用）。
3. `hr_search` 注入 `DomainPackContext`。
4. 四大工具按配置执行并输出统一契约。
5. 最终答案与 `pack_version` 一并写入 Scratchpad 与 Case。

### 1.7 非功能要求

1. 可用性：Config API SLO 99.9%（工作时段）。
2. 性能：运行时配置读取 P95 < 100ms（含缓存）。
3. 安全：配置修改必须鉴权并记录审计日志。
4. 可观测：发布事件、校验失败、运行时回退都必须有日志指标。

## 2. Project Design (项目设计)

### 2.1 仓库结构（建议）

```txt
apps/
  config-center/
    src/
      app.ts
      routes/
      services/
      repositories/
      validators/
    tests/
packages/
  domain-pack-schema/
    src/
  config-sdk/
    src/
infra/
  db/
    migrations/
  docker/
```

### 2.2 一期边界

1. 做 API + DB + SDK，不做复杂可视化后台（先用 Swagger + 脚本）。
2. 审批流程先“顺序审批”实现，不上复杂工作流引擎。
3. 公式先支持线性表达式，复杂模型在二期引入。

## 3. Implementation Plan (实施规划书)

### Task 1: 初始化配置中心工程骨架

**Files:**
- Create: `apps/config-center/src/app.ts`
- Create: `apps/config-center/src/main.ts`
- Create: `apps/config-center/tests/health.test.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "bun:test";
import { buildApp } from "../src/app";

test("GET /health returns ok", async () => {
  const app = buildApp();
  const res = await app.inject({ method: "GET", url: "/health" });
  expect(res.statusCode).toBe(200);
  expect(res.json().status).toBe("ok");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/config-center/tests/health.test.ts`  
Expected: FAIL with `Cannot find module ../src/app`

**Step 3: Write minimal implementation**

```ts
import Fastify from "fastify";
export function buildApp() {
  const app = Fastify();
  app.get("/health", async () => ({ status: "ok" }));
  return app;
}
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/config-center/tests/health.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/config-center
git commit -m "feat(config-center): bootstrap fastify app with health route"
```

### Task 2: 建立 Domain Pack Zod Schema

**Files:**
- Create: `packages/domain-pack-schema/src/index.ts`
- Create: `packages/domain-pack-schema/tests/schema.test.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "bun:test";
import { DomainPackSchema } from "../src";

test("valid domain pack passes schema", () => {
  const parsed = DomainPackSchema.parse({
    id: "delivery_ops",
    version: "1.0.0",
    businessLine: "delivery_ops",
    roleProfiles: [],
    metricProxies: [],
    scorePolicies: []
  });
  expect(parsed.id).toBe("delivery_ops");
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/domain-pack-schema/tests/schema.test.ts`  
Expected: FAIL with missing export `DomainPackSchema`

**Step 3: Write minimal implementation**

```ts
import { z } from "zod";
export const DomainPackSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  businessLine: z.string().min(1),
  roleProfiles: z.array(z.any()),
  metricProxies: z.array(z.any()),
  scorePolicies: z.array(z.any())
});
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/domain-pack-schema/tests/schema.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/domain-pack-schema
git commit -m "feat(schema): add domain pack zod schema"
```

### Task 3: 建立 PostgreSQL 基础表与迁移

**Files:**
- Create: `infra/db/migrations/0001_config_center_init.sql`
- Create: `apps/config-center/tests/migration.test.ts`

**Step 1: Write the failing test**

```ts
import { test, expect } from "bun:test";
test("placeholder migration smoke test", () => {
  expect(true).toBe(true);
});
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/config-center/tests/migration.test.ts`  
Expected: FAIL after adding DB assertion (table not exists)

**Step 3: Write minimal implementation**

```sql
create table if not exists domain_pack (...);
create table if not exists domain_pack_version (...);
create table if not exists release_binding (...);
create table if not exists approval_record (...);
create table if not exists config_audit_log (...);
```

**Step 4: Run migration + test**

Run: `bun run db:migrate && bun test apps/config-center/tests/migration.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add infra/db/migrations apps/config-center/tests/migration.test.ts
git commit -m "feat(db): add config center core schema migration"
```

### Task 4: 实现 Pack 版本创建与查询 API

**Files:**
- Create: `apps/config-center/src/routes/packs.ts`
- Create: `apps/config-center/src/services/pack-service.ts`
- Create: `apps/config-center/tests/packs-api.test.ts`

**Step 1: Write the failing test**

```ts
test("POST /packs creates a pack", async () => { /* ... */ });
test("POST /packs/:code/versions creates draft version", async () => { /* ... */ });
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/config-center/tests/packs-api.test.ts`  
Expected: FAIL with route not found

**Step 3: Write minimal implementation**

```ts
app.post("/packs", handlerCreatePack);
app.post("/packs/:packCode/versions", handlerCreatePackVersion);
app.get("/packs/:packCode/versions/:versionNo", handlerGetVersion);
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/config-center/tests/packs-api.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/config-center/src/routes apps/config-center/src/services apps/config-center/tests
git commit -m "feat(api): add pack and version draft endpoints"
```

### Task 5: 实现校验与发布绑定 API

**Files:**
- Create: `apps/config-center/src/routes/release.ts`
- Create: `apps/config-center/src/services/release-service.ts`
- Create: `apps/config-center/tests/release-api.test.ts`

**Step 1: Write the failing test**

```ts
test("validate endpoint rejects invalid schema", async () => { /* ... */ });
test("release endpoint updates active version for env", async () => { /* ... */ });
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/config-center/tests/release-api.test.ts`  
Expected: FAIL with 404

**Step 3: Write minimal implementation**

```ts
app.post("/packs/:packCode/versions/:versionNo/validate", handlerValidate);
app.post("/packs/:packCode/versions/:versionNo/release", handlerRelease);
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/config-center/tests/release-api.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/config-center/src/routes/release.ts apps/config-center/src/services/release-service.ts apps/config-center/tests/release-api.test.ts
git commit -m "feat(api): add validate and release endpoints"
```

### Task 6: 接入审批与审计日志

**Files:**
- Create: `apps/config-center/src/routes/approval.ts`
- Create: `apps/config-center/src/services/audit-service.ts`
- Create: `apps/config-center/tests/approval-audit.test.ts`

**Step 1: Write the failing test**

```ts
test("approval decision is persisted", async () => { /* ... */ });
test("config change writes audit log", async () => { /* ... */ });
```

**Step 2: Run test to verify it fails**

Run: `bun test apps/config-center/tests/approval-audit.test.ts`  
Expected: FAIL with missing endpoint/data

**Step 3: Write minimal implementation**

```ts
app.post("/packs/:packCode/versions/:versionNo/approvals", handlerApprove);
```

**Step 4: Run test to verify it passes**

Run: `bun test apps/config-center/tests/approval-audit.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add apps/config-center/src/routes/approval.ts apps/config-center/src/services/audit-service.ts apps/config-center/tests/approval-audit.test.ts
git commit -m "feat(governance): add approval and audit logging"
```

### Task 7: 实现运行时 Config SDK（缓存+回退）

**Files:**
- Create: `packages/config-sdk/src/client.ts`
- Create: `packages/config-sdk/src/cache.ts`
- Create: `packages/config-sdk/tests/client.test.ts`

**Step 1: Write the failing test**

```ts
test("sdk returns active pack for business line", async () => { /* ... */ });
test("sdk falls back to last known version on fetch failure", async () => { /* ... */ });
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/config-sdk/tests/client.test.ts`  
Expected: FAIL with module/function missing

**Step 3: Write minimal implementation**

```ts
export class ConfigClient {
  async getActivePack(businessLine: string, env = "prod") { /* ... */ }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/config-sdk/tests/client.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add packages/config-sdk
git commit -m "feat(runtime): add config sdk with cache and fallback"
```

### Task 8: 与 Dexter-HR Agent 集成（只接配置上下文）

**Files:**
- Modify: `src/tools/hr/hr-search.ts`
- Modify: `src/agent/run-context.ts`
- Test: `src/tools/hr/hr-search.test.ts`

**Step 1: Write the failing test**

```ts
test("hr_search loads config by businessLine and tags pack_version", async () => { /* ... */ });
```

**Step 2: Run test to verify it fails**

Run: `bun test src/tools/hr/hr-search.test.ts`  
Expected: FAIL with missing config context

**Step 3: Write minimal implementation**

```ts
const pack = await configClient.getActivePack(input.businessLine);
ctx.packVersion = pack.version;
```

**Step 4: Run test to verify it passes**

Run: `bun test src/tools/hr/hr-search.test.ts`  
Expected: PASS

**Step 5: Commit**

```bash
git add src/tools/hr/hr-search.ts src/agent/run-context.ts src/tools/hr/hr-search.test.ts
git commit -m "feat(agent): inject domain pack context into hr_search"
```

### Task 9: 交付脚本与运维基线

**Files:**
- Create: `infra/docker/docker-compose.yml`
- Create: `apps/config-center/.env.example`
- Create: `apps/config-center/README.md`

**Step 1: Write failing smoke check**

```bash
bun run config-center:smoke
```

**Step 2: Run check to verify it fails**

Expected: FAIL with service not available

**Step 3: Write minimal implementation**

```yaml
services:
  postgres:
  config-center:
```

**Step 4: Run smoke check**

Run: `docker compose -f infra/docker/docker-compose.yml up -d && bun run config-center:smoke`  
Expected: PASS

**Step 5: Commit**

```bash
git add infra/docker apps/config-center/.env.example apps/config-center/README.md
git commit -m "chore(infra): add local runtime stack and smoke check"
```

### Task 10: 上线前验证与里程碑验收

**Files:**
- Create: `docs/release/config-center-mvp-checklist.md`

**Step 1: Define verification checklist**

```md
- schema validation
- release binding switch
- sdk fallback
- audit completeness
```

**Step 2: Run full verification**

Run: `bun test && bun run typecheck && bun run config-center:smoke`  
Expected: PASS all

**Step 3: Dry-run release**

Run: `bun run release:pack --pack delivery_ops --version 1 --env staging`  
Expected: release record created

**Step 4: Production cutover rehearsal**

Run: `bun run release:pack --pack delivery_ops --version 1 --env prod`  
Expected: runtime reads version 1

**Step 5: Commit**

```bash
git add docs/release/config-center-mvp-checklist.md
git commit -m "docs(release): add mvp verification and cutover checklist"
```

## 4. 实施路线建议（按你当前诉求）

1. 先完成 Task 1-7（配置中心与数据库闭环）再做 Agent 集成，确保“架构先行”。
2. 先发布 `delivery_ops` 单包，稳定后复制新业务线包，不改代码只发新配置版本。
3. 二期优先建设“配置后台UI + 差异对比 + 灰度发布”。

