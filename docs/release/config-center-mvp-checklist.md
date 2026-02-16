# Config Center MVP Checklist

- schema validation
- release binding switch
- sdk fallback
- audit completeness
- approval stage order (`hr_review -> business_review -> security_review`)
- release gate (`submitted + 3 approvals`)
- mutating API auth via `x-api-key` when `CONFIG_CENTER_API_KEY` is configured
- operational endpoints (`/openapi.json`, `/metrics`, `/health`)

## Verification Commands

- `bun test apps/config-center/tests packages/domain-pack-schema/tests packages/config-sdk/tests src/tools/hr/hr-search.test.ts`
- `bun run typecheck`
- `bun run config-center:smoke`

## Cutover Rehearsal

- `bun run release:pack --pack delivery_ops --version 1 --env staging`
- `bun run release:pack --pack delivery_ops --version 1 --env prod`
