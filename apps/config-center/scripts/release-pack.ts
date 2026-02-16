type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type ReleasePackInput = {
  baseUrl: string;
  packCode: string;
  versionNo: number;
  environment: "dev" | "staging" | "prod";
  releasedBy: string;
};

function parseFlag(argv: string[], name: string): string | null {
  const index = argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return argv[index + 1] ?? null;
}

export async function runReleasePack(
  input: ReleasePackInput,
  deps?: { fetchImpl?: FetchLike },
) {
  const fetchImpl = deps?.fetchImpl ?? ((url: string, init?: RequestInit) => fetch(url, init));
  const baseUrl = input.baseUrl.replace(/\/$/, "");

  const validateRes = await fetchImpl(
    `${baseUrl}/packs/${input.packCode}/versions/${input.versionNo}/validate`,
    { method: "POST" },
  );

  if (!validateRes.ok) {
    throw new Error(`validate failed with status ${validateRes.status}`);
  }

  const releaseRes = await fetchImpl(
    `${baseUrl}/packs/${input.packCode}/versions/${input.versionNo}/release`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        environment: input.environment,
        releasedBy: input.releasedBy,
      }),
    },
  );

  if (!releaseRes.ok) {
    throw new Error(`release failed with status ${releaseRes.status}`);
  }

  return releaseRes.json();
}

if (import.meta.main) {
  const packCode = parseFlag(Bun.argv, "--pack");
  const versionText = parseFlag(Bun.argv, "--version");
  const environmentText = parseFlag(Bun.argv, "--env");
  const releasedBy = parseFlag(Bun.argv, "--released-by") ?? "release-bot";

  if (!packCode || !versionText || !environmentText) {
    console.error("Usage: bun run release:pack --pack <packCode> --version <versionNo> --env <dev|staging|prod> [--released-by <name>]");
    process.exit(1);
  }

  const versionNo = Number(versionText);
  if (!Number.isInteger(versionNo) || versionNo < 1) {
    console.error("--version must be a positive integer");
    process.exit(1);
  }

  if (environmentText !== "dev" && environmentText !== "staging" && environmentText !== "prod") {
    console.error("--env must be one of: dev, staging, prod");
    process.exit(1);
  }

  const baseUrl = process.env.CONFIG_CENTER_BASE_URL ?? "http://127.0.0.1:4010";

  const result = await runReleasePack({
    baseUrl,
    packCode,
    versionNo,
    environment: environmentText,
    releasedBy,
  });

  console.log(JSON.stringify(result, null, 2));
}
