// ─── Asana Integration Types & Helpers ───

const ASANA_BASE = "https://app.asana.com/api/1.0";

export const INTEGRATIONS_STORAGE_KEY = "mpaios_integrations";

/* ---------- Types ---------- */

export interface AsanaWorkspace {
  gid: string;
  name: string;
}

export interface AsanaUser {
  gid: string;
  name: string;
  email: string;
}

export interface AsanaProject {
  gid: string;
  name: string;
  notes?: string;
  color?: string;
  archived?: boolean;
}

export interface AsanaTask {
  gid: string;
  name: string;
  notes?: string;
  completed: boolean;
  due_on?: string | null;
  assignee?: { gid: string; name: string } | null;
}

export interface AsanaConfig {
  pat: string;
  workspace: AsanaWorkspace | null;
  connected: boolean;
  connectedAt: string | null;
}

export interface GAConfig {
  accessToken: string;
  propertyId: string;
  propertyName: string;
  connected: boolean;
  connectedAt: string | null;
}

export interface GSCConfig {
  accessToken: string;
  siteUrl: string;
  connected: boolean;
  connectedAt: string | null;
}

export interface IntegrationsConfig {
  asana: AsanaConfig;
  googleAnalytics: GAConfig;
  googleSearchConsole: GSCConfig;
}

// Keep old type as alias for backwards compat
export type AsanaIntegrationConfig = IntegrationsConfig;

export function defaultIntegrations(): IntegrationsConfig {
  return {
    asana: {
      pat: "",
      workspace: null,
      connected: false,
      connectedAt: null,
    },
    googleAnalytics: {
      accessToken: "",
      propertyId: "",
      propertyName: "",
      connected: false,
      connectedAt: null,
    },
    googleSearchConsole: {
      accessToken: "",
      siteUrl: "",
      connected: false,
      connectedAt: null,
    },
  };
}

/* ---------- Fetch helper ---------- */

export async function asanaFetch<T = unknown>(
  pat: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; errors?: { message: string }[] }> {
  const url = `${ASANA_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    let message = `Asana API error (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed.errors?.[0]?.message) {
        message = parsed.errors[0].message;
      }
    } catch {
      if (body) message = body;
    }
    throw new Error(message);
  }

  return res.json();
}
