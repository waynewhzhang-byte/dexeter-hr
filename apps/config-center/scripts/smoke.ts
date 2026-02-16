type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function runSmokeCheck(input?: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
}) {
  const baseUrl = (input?.baseUrl ?? process.env.CONFIG_CENTER_BASE_URL ?? "http://127.0.0.1:4010").replace(/\/$/, "");
  const fetchImpl = input?.fetchImpl ?? ((url: string, init?: RequestInit) => fetch(url, init));

  try {
    const response = await fetchImpl(`${baseUrl}/health`);
    const body = (await response.json()) as { status?: string };

    if (response.ok && body.status === "ok") {
      return { ok: true as const, message: "smoke passed" };
    }

    return { ok: false as const, message: `health check failed with status ${response.status}` };
  } catch (error) {
    return { ok: false as const, message: `health check failed: ${String(error)}` };
  }
}

if (import.meta.main) {
  const result = await runSmokeCheck();
  if (result.ok) {
    console.log(result.message);
  } else {
    console.error(result.message);
    process.exit(1);
  }
}
