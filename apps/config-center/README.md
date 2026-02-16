# Config Center

Config Center provides Domain Pack version management and runtime retrieval APIs.

## Run locally

1. Start infra:
   - `docker compose -f infra/docker/docker-compose.yml up -d`
2. Start app (if not started by compose):
   - `bun run config-center:dev`
3. Smoke test:
   - `bun run config-center:smoke`

## Release a pack version

- `bun run release:pack --pack delivery_ops --version 1 --env staging`
- `bun run release:pack --pack delivery_ops --version 1 --env prod`
