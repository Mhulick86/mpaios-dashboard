/**
 * Integration catalogue for MAIOS.
 *
 * Client-safe: this file only carries public metadata and the NAMES of the
 * environment variables each platform needs. Token exchange, refresh and the
 * actual API calls live server-side in lib/integrations/providers/*.
 *
 * Adding a platform = one entry here + one provider module + (for OAuth apps)
 * the developer-console setup documented in docs/integrations.md.
 */

export type IntegrationId =
  | "google_ads"
  | "google_business_profile"
  | "meta_ads"
  | "linkedin_ads"
  | "tiktok_ads"
  | "pinterest_ads"
  | "x_ads"
  | "hubspot"
  | "slack"
  | "semrush";

export type IntegrationCategory = "Paid media" | "Local & SEO" | "CRM & sales" | "Messaging";
export type IntegrationAuth = "oauth2" | "api_key";
/** available = connect from the Platforms grid; legacy = has its own page; coming_soon = catalogue entry only. */
export type IntegrationAvailability = "available" | "legacy" | "coming_soon";

export interface OAuth2Config {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Separator used when joining scopes into the `scope` parameter. */
  scopeSeparator: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Extra query params appended to the authorize URL (e.g. Google's access_type/prompt). */
  extraAuthorizeParams?: Record<string, string>;
  /** How client credentials are sent to the token endpoint. */
  tokenAuth: "body" | "basic";
  /** Whether the platform issues refresh tokens we can use unattended. */
  refreshSupported: boolean;
}

export interface IntegrationDefinition {
  id: IntegrationId;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** Which MAIOS agent primarily consumes this platform (informational). */
  agent?: string;
  docsUrl: string;
  brandColor: string;
  auth: IntegrationAuth;
  availability: IntegrationAvailability;
  oauth?: OAuth2Config;
  /** For api_key platforms: env var that can hold the key instead of entering it in the UI. */
  apiKeyEnv?: string;
  /** Env vars that must be set on the server before Connect works. */
  requiredEnv: string[];
  /** Read-only action names exposed at /api/integrations/<id>/<action>. */
  actions: string[];
  /** For legacy integrations that keep their own page. */
  legacyPath?: string;
}

const GOOGLE_OAUTH = {
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopeSeparator: " ",
  clientIdEnv: "GOOGLE_CLIENT_ID",
  clientSecretEnv: "GOOGLE_CLIENT_SECRET",
  extraAuthorizeParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  tokenAuth: "body" as const,
  refreshSupported: true,
};

export const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: "google_ads",
    name: "Google Ads",
    category: "Paid media",
    description: "Search, Performance Max and Display accounts: campaigns, spend and conversion metrics.",
    agent: "Agent 08 · Paid Search",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    brandColor: "#4285F4",
    auth: "oauth2",
    availability: "available",
    oauth: { ...GOOGLE_OAUTH, scopes: ["https://www.googleapis.com/auth/adwords"] },
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"],
    actions: ["test", "accounts", "campaigns", "metrics"],
  },
  {
    id: "google_business_profile",
    name: "Google Business Profile",
    category: "Local & SEO",
    description: "Locations, reviews and profile performance for the local SEO agents.",
    agent: "Agents 31-33 · Local Growth",
    docsUrl: "https://developers.google.com/my-business/content/overview",
    brandColor: "#34A853",
    auth: "oauth2",
    availability: "available",
    oauth: { ...GOOGLE_OAUTH, scopes: ["https://www.googleapis.com/auth/business.manage"] },
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    actions: ["test", "accounts", "locations", "reviews", "performance"],
  },
  {
    id: "meta_ads",
    name: "Meta Ads",
    category: "Paid media",
    description: "Facebook and Instagram campaigns, ad sets, ads, insights and audiences.",
    agent: "Agent 07 · Meta Ads",
    docsUrl: "https://developers.facebook.com/docs/marketing-apis/",
    brandColor: "#1877F2",
    auth: "oauth2",
    availability: "legacy",
    legacyPath: "/meta-ads",
    oauth: {
      authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
      scopes: ["ads_read", "ads_management", "business_management", "read_insights", "pages_show_list"],
      scopeSeparator: ",",
      clientIdEnv: "META_APP_ID",
      clientSecretEnv: "META_APP_SECRET",
      tokenAuth: "body",
      refreshSupported: false,
    },
    requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
    actions: [],
  },
  {
    id: "linkedin_ads",
    name: "LinkedIn Ads",
    category: "Paid media",
    description: "Ad accounts, campaigns and campaign analytics for B2B paid social.",
    agent: "Agent 09 · Paid Social",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
    brandColor: "#0A66C2",
    auth: "oauth2",
    availability: "available",
    oauth: {
      authorizeUrl: "https://www.linkedin.com/oauth/v2/authorization",
      tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
      scopes: ["r_ads", "r_ads_reporting", "rw_ads"],
      scopeSeparator: " ",
      clientIdEnv: "LINKEDIN_CLIENT_ID",
      clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
      tokenAuth: "body",
      refreshSupported: true,
    },
    requiredEnv: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    actions: ["test", "accounts", "campaigns", "analytics"],
  },
  {
    id: "tiktok_ads",
    name: "TikTok Ads",
    category: "Paid media",
    description: "Advertiser accounts, campaigns and integrated performance reports.",
    agent: "Agent 09 · Paid Social",
    docsUrl: "https://business-api.tiktok.com/portal/docs",
    brandColor: "#000000",
    auth: "oauth2",
    availability: "available",
    oauth: {
      authorizeUrl: "https://business-api.tiktok.com/portal/auth",
      tokenUrl: "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/",
      scopes: [],
      scopeSeparator: ",",
      clientIdEnv: "TIKTOK_APP_ID",
      clientSecretEnv: "TIKTOK_APP_SECRET",
      tokenAuth: "body",
      refreshSupported: false,
    },
    requiredEnv: ["TIKTOK_APP_ID", "TIKTOK_APP_SECRET"],
    actions: ["test", "accounts", "campaigns", "report"],
  },
  {
    id: "pinterest_ads",
    name: "Pinterest Ads",
    category: "Paid media",
    description: "Ad accounts, campaigns and daily analytics.",
    agent: "Agent 09 · Paid Social",
    docsUrl: "https://developers.pinterest.com/docs/api/v5/",
    brandColor: "#E60023",
    auth: "oauth2",
    availability: "available",
    oauth: {
      authorizeUrl: "https://www.pinterest.com/oauth/",
      tokenUrl: "https://api.pinterest.com/v5/oauth/token",
      scopes: ["ads:read", "user_accounts:read"],
      scopeSeparator: ",",
      clientIdEnv: "PINTEREST_APP_ID",
      clientSecretEnv: "PINTEREST_APP_SECRET",
      tokenAuth: "basic",
      refreshSupported: true,
    },
    requiredEnv: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"],
    actions: ["test", "accounts", "campaigns", "analytics"],
  },
  {
    id: "x_ads",
    name: "X Ads",
    category: "Paid media",
    description: "X (Twitter) Ads API access requires an approved developer application; coming once approved.",
    agent: "Agent 09 · Paid Social",
    docsUrl: "https://developer.x.com/en/docs/x-ads-api",
    brandColor: "#000000",
    auth: "oauth2",
    availability: "coming_soon",
    requiredEnv: [],
    actions: [],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "CRM & sales",
    description: "Contacts, companies and deals so the client-success agents see pipeline context.",
    agent: "Agents 25-27 · Client Success",
    docsUrl: "https://developers.hubspot.com/docs/api/oauth-quickstart-guide",
    brandColor: "#FF7A59",
    auth: "oauth2",
    availability: "available",
    oauth: {
      authorizeUrl: "https://app.hubspot.com/oauth/authorize",
      tokenUrl: "https://api.hubapi.com/oauth/v1/token",
      scopes: ["oauth", "crm.objects.contacts.read", "crm.objects.companies.read", "crm.objects.deals.read"],
      scopeSeparator: " ",
      clientIdEnv: "HUBSPOT_CLIENT_ID",
      clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
      tokenAuth: "body",
      refreshSupported: true,
    },
    requiredEnv: ["HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET"],
    actions: ["test", "account", "contacts", "companies", "deals"],
  },
  {
    id: "slack",
    name: "Slack",
    category: "Messaging",
    description: "Post agent and workflow updates into channels; list channels for routing.",
    agent: "Agent 15 · Operations",
    docsUrl: "https://api.slack.com/authentication/oauth-v2",
    brandColor: "#4A154B",
    auth: "oauth2",
    availability: "available",
    oauth: {
      authorizeUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      scopes: ["chat:write", "channels:read", "groups:read", "channels:join"],
      scopeSeparator: ",",
      clientIdEnv: "SLACK_CLIENT_ID",
      clientSecretEnv: "SLACK_CLIENT_SECRET",
      tokenAuth: "body",
      refreshSupported: false,
    },
    requiredEnv: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
    actions: ["test", "channels", "post"],
  },
  {
    id: "semrush",
    name: "Semrush",
    category: "Local & SEO",
    description: "Domain and keyword overview data from the Semrush Analytics API (API-unit based).",
    agent: "Agents 10-12 · Organic & Authority",
    docsUrl: "https://developer.semrush.com/api/",
    brandColor: "#FF642D",
    auth: "api_key",
    availability: "available",
    apiKeyEnv: "SEMRUSH_API_KEY",
    requiredEnv: [],
    actions: ["test", "domain_overview", "keyword_overview"],
  },
];

export function getIntegration(id: string): IntegrationDefinition | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

export function isIntegrationId(id: string): id is IntegrationId {
  return INTEGRATIONS.some((i) => i.id === id);
}

/** Callback URL registered in each platform's developer console. */
export function integrationCallbackPath(id: IntegrationId): string {
  return `/api/integrations/${id}/callback`;
}
