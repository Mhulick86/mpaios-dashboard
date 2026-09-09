/**
 * Lazy provider loader: one module per platform, imported only when needed so
 * an unconfigured platform costs nothing at runtime.
 */
import "server-only";
import type { IntegrationId } from "../registry";
import type { IntegrationProvider } from "../types";

const loaders: Record<IntegrationId, () => Promise<IntegrationProvider | null>> = {
  google_ads: () => import("./google_ads").then((m) => m.provider),
  google_business_profile: () => import("./google_business_profile").then((m) => m.provider),
  linkedin_ads: () => import("./linkedin_ads").then((m) => m.provider),
  tiktok_ads: () => import("./tiktok_ads").then((m) => m.provider),
  pinterest_ads: () => import("./pinterest_ads").then((m) => m.provider),
  hubspot: () => import("./hubspot").then((m) => m.provider),
  slack: () => import("./slack").then((m) => m.provider),
  semrush: () => import("./semrush").then((m) => m.provider),
  // Managed by its own page (app/meta-ads) for now.
  meta_ads: async () => null,
  // Awaiting X Ads API approval.
  x_ads: async () => null,
};

export async function loadProvider(id: IntegrationId): Promise<IntegrationProvider | null> {
  const loader = loaders[id];
  return loader ? loader() : null;
}
