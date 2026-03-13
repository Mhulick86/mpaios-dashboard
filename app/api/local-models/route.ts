export async function POST(req: Request) {
  const { url, apiKey } = (await req.json()) as {
    url: string;
    apiKey?: string;
  };

  if (!url) {
    return new Response(JSON.stringify({ error: "URL is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const base = url.replace(/\/+$/, "");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    // Extract origin (scheme + host + port) for building alternative paths
    let origin = base;
    try { const u = new URL(base); origin = u.origin; } catch {}

    // Build list of URLs to try (covers various server configs):
    const urlsToTry: string[] = [];
    if (base.endsWith("/models")) urlsToTry.push(base);       // user gave direct URL
    urlsToTry.push(`${origin}/v1/models`);                     // OpenAI-compatible
    urlsToTry.push(`${origin}/api/v1/models`);                 // LM Studio native
    urlsToTry.push(`${origin}/models`);                        // bare /models
    if (base !== origin && !base.endsWith("/models")) {
      urlsToTry.push(`${base}/models`);                        // custom path e.g. /v2/models
    }
    // Deduplicate
    const uniqueUrls = [...new Set(urlsToTry)];

    let models: Array<{ id: string; object?: string }> = [];
    let lastError = "";

    for (const modelsUrl of uniqueUrls) {
      try {
        console.log(`[local-models] Trying: ${modelsUrl}`);
        const resp = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(5000) });

        if (!resp.ok) {
          lastError = `${modelsUrl} returned ${resp.status}`;
          console.log(`[local-models] ${lastError}`);
          continue;
        }

        const data = await resp.json();

        // OpenAI-compatible: { data: [{ id: "model-name", ... }] }
        // LM Studio native: { data: [{ id, type, path, ... }] }
        // Some servers: { models: [...] } or just [...]
        let list: Array<Record<string, string>> = [];

        if (data.data && Array.isArray(data.data)) {
          list = data.data;
        } else if (data.models && Array.isArray(data.models)) {
          list = data.models;
        } else if (Array.isArray(data)) {
          list = data;
        }

        if (list.length > 0) {
          models = list.map((m) => ({
            id: m.id || m.model || m.path || "unknown",
            object: m.object || m.type || "model",
          }));
          console.log(`[local-models] Found ${models.length} models from ${modelsUrl}`);
          break;
        } else {
          lastError = `${modelsUrl} returned empty model list`;
          console.log(`[local-models] ${lastError}`);
        }
      } catch (e) {
        lastError = `${modelsUrl}: ${e instanceof Error ? e.message : "Connection failed"}`;
        console.log(`[local-models] ${lastError}`);
      }
    }

    if (models.length === 0) {
      return new Response(
        JSON.stringify({
          error: `No models found. Make sure the server is running and a model is loaded. Last error: ${lastError}`,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        models: models.map((m) => ({
          id: m.id,
          object: m.object || "model",
        })),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Failed to connect";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
