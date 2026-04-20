"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Facebook,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Unplug,
  DollarSign,
  Eye,
  MousePointerClick,
  TrendingUp,
  Users,
  Target,
  Layers,
  Image as ImageIcon,
  Plus,
  Info,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import {
  INTEGRATIONS_STORAGE_KEY,
  defaultIntegrations,
  type IntegrationsConfig,
  type MetaAdsIntegrationConfig,
} from "@/lib/asana";
import type {
  MetaAdAccount,
  MetaCampaign,
  MetaAdSet,
  MetaAd,
  MetaInsight,
  MetaCustomAudience,
  CreateCampaignInput,
} from "@/lib/metaAds";
import { META_OAUTH_SCOPES } from "@/lib/metaAds";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";

type Tab = "overview" | "campaigns" | "adsets" | "ads" | "insights" | "audiences" | "create";

const OBJECTIVES = [
  { value: "OUTCOME_AWARENESS", label: "Awareness" },
  { value: "OUTCOME_TRAFFIC", label: "Traffic" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engagement" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_APP_PROMOTION", label: "App promotion" },
  { value: "OUTCOME_SALES", label: "Sales" },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "text-brand-green bg-brand-green/10",
  PAUSED: "text-gray-500 bg-gray-100",
  DELETED: "text-red-500 bg-red-50",
  ARCHIVED: "text-gray-400 bg-gray-50",
  PENDING_REVIEW: "text-yellow-600 bg-yellow-50",
  DISAPPROVED: "text-red-600 bg-red-50",
  WITH_ISSUES: "text-orange-600 bg-orange-50",
};

export default function MetaAdsPage() {
  const [config, setConfig] = useState<IntegrationsConfig>(defaultIntegrations());
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Load config
  useEffect(() => {
    try {
      const stored = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
      if (stored) {
        setConfig({ ...defaultIntegrations(), ...JSON.parse(stored) });
      }
    } catch {}
  }, []);

  const meta = config.metaAds;
  const connected = meta?.connected && meta?.accessToken && meta?.accountId;

  function saveConfig(next: IntegrationsConfig) {
    setConfig(next);
    localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(next));
  }

  function updateMeta(patch: Partial<MetaAdsIntegrationConfig>) {
    saveConfig({ ...config, metaAds: { ...config.metaAds, ...patch } });
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6 md:mb-8 gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1877F2]/10 flex items-center justify-center shrink-0">
              <Facebook className="w-5 h-5 text-[#1877F2]" />
            </div>
            <div>
              <h1 className="text-[20px] md:text-[24px] font-semibold">Meta Ads</h1>
              <p className="text-[12px] md:text-[14px] text-text-secondary mt-0.5">
                Facebook &amp; Instagram campaigns · full Marketing API integration
              </p>
            </div>
          </div>
        </div>
        {connected && (
          <AccountSwitcher meta={meta} updateMeta={updateMeta} />
        )}
      </div>

      {!connected && <ConnectPanel config={config} saveConfig={saveConfig} />}

      {connected && (
        <>
          <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
            {(
              [
                { id: "overview", label: "Overview" },
                { id: "campaigns", label: "Campaigns" },
                { id: "adsets", label: "Ad Sets" },
                { id: "ads", label: "Ads" },
                { id: "insights", label: "Insights" },
                { id: "audiences", label: "Audiences" },
                { id: "create", label: "Create Campaign" },
              ] as { id: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 py-2 rounded-lg text-[12px] md:text-[13px] font-medium whitespace-nowrap transition-colors ${
                  activeTab === t.id
                    ? "bg-[#1877F2] text-white"
                    : "bg-surface-raised border border-border text-text-secondary hover:text-text-primary"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && <OverviewTab meta={meta} />}
          {activeTab === "campaigns" && <CampaignsTab meta={meta} />}
          {activeTab === "adsets" && <AdSetsTab meta={meta} />}
          {activeTab === "ads" && <AdsTab meta={meta} />}
          {activeTab === "insights" && <InsightsTab meta={meta} />}
          {activeTab === "audiences" && <AudiencesTab meta={meta} />}
          {activeTab === "create" && <CreateCampaignTab meta={meta} />}
        </>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Connect panel                                                              */
/* ========================================================================== */

function ConnectPanel({
  config,
  saveConfig,
}: {
  config: IntegrationsConfig;
  saveConfig: (c: IntegrationsConfig) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<MetaAdAccount[]>([]);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<{ id: string; name: string } | null>(null);

  function startOAuth() {
    setConnecting(true);
    setError(null);
    setAccounts([]);
    const redirectUri = `${window.location.origin}/auth/meta/callback`;

    let popup: Window | null = null;
    let closedPoll: ReturnType<typeof setInterval> | null = null;
    let settled = false;

    function cleanup() {
      window.removeEventListener("message", onMessage);
      if (closedPoll) clearInterval(closedPoll);
    }
    function fail(msg: string) {
      if (settled) return;
      settled = true;
      cleanup();
      setError(msg);
      setConnecting(false);
    }
    async function succeed(accessToken: string, expiresIn: number | null) {
      if (settled) return;
      settled = true;
      cleanup();
      // Test the token + list ad accounts
      try {
        const res = await fetch("/api/meta-ads/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Connection test failed");

        setPendingToken(accessToken);
        setPendingUser(data.user);
        setAccounts(data.accounts || []);

        if (data.accounts?.length === 1) {
          const acc = data.accounts[0];
          saveConfig({
            ...config,
            metaAds: {
              accessToken,
              expiresAt: expiresIn ? Date.now() + expiresIn * 1000 : null,
              userId: data.user.id,
              userName: data.user.name,
              accountId: acc.id,
              accountName: acc.name,
              currency: acc.currency,
              connected: true,
              connectedAt: new Date().toISOString(),
            },
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to validate token");
      } finally {
        setConnecting(false);
      }
    }

    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "META_OAUTH_SUCCESS") {
        succeed(e.data.accessToken, e.data.expiresIn ?? null);
      } else if (e.data?.type === "META_OAUTH_ERROR") {
        fail(e.data.error || "Meta sign-in failed");
      }
    }
    window.addEventListener("message", onMessage);

    fetch("/api/meta-ads/auth-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopes: META_OAUTH_SCOPES, redirectUri }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          throw new Error(
            data.error ||
              (r.status === 401
                ? "You must be signed in to MPAIOS first."
                : `Failed to start Meta sign-in (HTTP ${r.status}).`)
          );
        }
        const w = 600;
        const h = 700;
        const left = window.screenX + (window.innerWidth - w) / 2;
        const top = window.screenY + (window.innerHeight - h) / 2;
        popup = window.open(
          data.url,
          "meta_oauth",
          `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
        );
        if (!popup) throw new Error("Popup was blocked. Allow popups and try again.");
        closedPoll = setInterval(() => {
          if (popup && popup.closed) fail("Sign-in window closed before completing.");
        }, 500);
      })
      .catch((err) => fail(err instanceof Error ? err.message : String(err)));
  }

  function pickAccount(acc: MetaAdAccount) {
    if (!pendingToken || !pendingUser) return;
    saveConfig({
      ...config,
      metaAds: {
        accessToken: pendingToken,
        expiresAt: null,
        userId: pendingUser.id,
        userName: pendingUser.name,
        accountId: acc.id,
        accountName: acc.name,
        currency: acc.currency,
        connected: true,
        connectedAt: new Date().toISOString(),
      },
    });
    setAccounts([]);
    setPendingToken(null);
    setPendingUser(null);
  }

  return (
    <div className="max-w-2xl bg-surface-raised rounded-xl border border-border p-6 md:p-8">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-[#1877F2]/10 flex items-center justify-center mx-auto mb-4">
          <Facebook className="w-8 h-8 text-[#1877F2]" />
        </div>
        <h2 className="text-[18px] font-semibold">Connect your Meta Ads account</h2>
        <p className="text-[13px] text-text-secondary mt-1.5 max-w-md mx-auto">
          Pull live Facebook &amp; Instagram campaign data, insights, audiences, and create
          draft campaigns for human review.
        </p>
      </div>

      {accounts.length > 1 ? (
        <div>
          <p className="text-[12px] font-medium text-text-secondary mb-2">
            <CheckCircle2 className="w-4 h-4 text-brand-green inline mr-1" />
            Connected as <strong>{pendingUser?.name}</strong>. Select an ad account:
          </p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => pickAccount(acc)}
                className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-[#1877F2]/40 hover:bg-[#1877F2]/5 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium truncate">{acc.name}</p>
                    <p className="text-[11px] text-text-muted">
                      {acc.id} · {acc.currency}
                      {acc.business?.name ? ` · ${acc.business.name}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      acc.account_status === 1 ? "bg-brand-green/10 text-brand-green" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {acc.account_status === 1 ? "Active" : `Status ${acc.account_status}`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={startOAuth}
          disabled={connecting}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white text-[14px] font-medium transition-colors disabled:opacity-60"
        >
          {connecting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Facebook className="w-5 h-5" />}
          {connecting ? "Connecting..." : "Continue with Facebook"}
        </button>
      )}

      {error && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="mt-6 rounded-lg bg-gray-50 border border-border p-3 text-[11px] text-text-muted leading-relaxed">
        <p className="font-medium text-text-secondary mb-1 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" /> What we request:
        </p>
        <ul className="list-disc list-inside space-y-0.5">
          <li><code>ads_read</code> — read campaigns, ad sets, ads, and insights</li>
          <li><code>ads_management</code> — create draft campaigns (never activated automatically)</li>
          <li><code>business_management</code> — access your business ad accounts</li>
          <li><code>read_insights</code> — performance data, attribution, breakdowns</li>
        </ul>
        <p className="mt-2">
          Tokens are stored locally in your browser. Any campaign we create is saved as
          <strong> PAUSED</strong> — you activate it manually after review.
        </p>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Account switcher                                                           */
/* ========================================================================== */

function AccountSwitcher({
  meta,
  updateMeta,
}: {
  meta: MetaAdsIntegrationConfig;
  updateMeta: (p: Partial<MetaAdsIntegrationConfig>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<MetaAdAccount[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await fetch("/api/meta-ads/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: meta.accessToken }),
      });
      const data = await res.json();
      if (res.ok) setAccounts(data.accounts || []);
    } catch {} finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    if (!confirm("Disconnect Meta Ads? You'll need to re-authenticate to reconnect.")) return;
    updateMeta({
      accessToken: "",
      expiresAt: null,
      userId: "",
      userName: "",
      accountId: "",
      accountName: "",
      currency: "",
      connected: false,
      connectedAt: null,
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && accounts.length === 0) loadAccounts();
        }}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface-raised hover:border-[#1877F2]/40 transition-colors text-[12px] font-medium"
      >
        <div className="w-6 h-6 rounded-full bg-[#1877F2]/10 flex items-center justify-center">
          <Facebook className="w-3.5 h-3.5 text-[#1877F2]" />
        </div>
        <div className="text-left min-w-0">
          <div className="truncate max-w-[180px]">{meta.accountName || meta.accountId}</div>
          <div className="text-[10px] text-text-muted">{meta.accountId} · {meta.currency}</div>
        </div>
        <ChevronDown className="w-4 h-4 text-text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-raised border border-border rounded-xl shadow-lg z-10 p-2">
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            Switch ad account
          </div>
          {loading && (
            <div className="flex items-center gap-2 px-3 py-4 text-[12px] text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          )}
          <div className="max-h-64 overflow-y-auto">
            {accounts.map((acc) => (
              <button
                key={acc.id}
                onClick={() => {
                  updateMeta({ accountId: acc.id, accountName: acc.name, currency: acc.currency });
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-[12px] hover:bg-gray-50 ${
                  acc.id === meta.accountId ? "bg-[#1877F2]/5" : ""
                }`}
              >
                <div className="font-medium truncate">{acc.name}</div>
                <div className="text-[10px] text-text-muted">{acc.id} · {acc.currency}</div>
              </button>
            ))}
          </div>
          <div className="border-t border-border mt-2 pt-2">
            <button
              onClick={handleDisconnect}
              className="w-full text-left px-3 py-2 rounded-lg text-[12px] text-red-600 hover:bg-red-50 flex items-center gap-2"
            >
              <Unplug className="w-3.5 h-3.5" /> Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Overview tab                                                               */
/* ========================================================================== */

function OverviewTab({ meta }: { meta: MetaAdsIntegrationConfig }) {
  const [insights, setInsights] = useState<MetaInsight[]>([]);
  const [daily, setDaily] = useState<MetaInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [totalsRes, dailyRes] = await Promise.all([
        fetch("/api/meta-ads/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: meta.accessToken,
            accountId: meta.accountId,
            options: { level: "account", datePreset: "last_30d" },
          }),
        }),
        fetch("/api/meta-ads/insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accessToken: meta.accessToken,
            accountId: meta.accountId,
            options: { level: "account", datePreset: "last_30d", timeIncrement: "1" },
          }),
        }),
      ]);

      const totalsData = await totalsRes.json();
      const dailyData = await dailyRes.json();
      if (!totalsRes.ok) throw new Error(totalsData.error || "Failed to load insights");
      setInsights(totalsData.insights || []);
      setDaily(dailyData.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, [meta.accessToken, meta.accountId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingBlock label="Loading performance data..." />;
  }
  if (error) {
    return <ErrorBlock error={error} onRetry={load} />;
  }

  const totals = insights[0] || {};
  const spend = Number(totals.spend || 0);
  const impressions = Number(totals.impressions || 0);
  const clicks = Number(totals.clicks || 0);
  const reach = Number(totals.reach || 0);
  const ctr = Number(totals.ctr || 0);
  const cpc = Number(totals.cpc || 0);
  const cpm = Number(totals.cpm || 0);

  const chartData = daily.map((d) => ({
    date: d.date_start?.slice(5) || "",
    spend: Number(d.spend || 0),
    clicks: Number(d.clicks || 0),
    impressions: Number(d.impressions || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-text-muted uppercase tracking-wider font-medium">Last 30 days</p>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface-raised hover:bg-gray-50 text-[12px] font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPIBlock icon={DollarSign} label="Spend" value={formatCurrency(spend, meta.currency)} />
        <KPIBlock icon={Eye} label="Impressions" value={formatNumber(impressions)} />
        <KPIBlock icon={MousePointerClick} label="Clicks" value={formatNumber(clicks)} />
        <KPIBlock icon={Users} label="Reach" value={formatNumber(reach)} />
        <KPIBlock icon={TrendingUp} label="CTR" value={`${ctr.toFixed(2)}%`} />
        <KPIBlock icon={DollarSign} label="CPC" value={formatCurrency(cpc, meta.currency)} />
        <KPIBlock icon={DollarSign} label="CPM" value={formatCurrency(cpm, meta.currency)} />
        <KPIBlock icon={Target} label="Frequency" value={Number(totals.frequency || 0).toFixed(2)} />
      </div>

      {chartData.length > 0 && (
        <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
          <h3 className="text-[14px] font-semibold mb-4">Daily spend &amp; clicks</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="left" type="monotone" dataKey="spend" stroke="#1877F2" strokeWidth={2} dot={false} name="Spend" />
                <Line yAxisId="right" type="monotone" dataKey="clicks" stroke="#08AE67" strokeWidth={2} dot={false} name="Clicks" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Campaigns / Ad sets / Ads                                                  */
/* ========================================================================== */

function CampaignsTab({ meta }: { meta: MetaAdsIntegrationConfig }) {
  const [items, setItems] = useState<MetaCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: meta.accessToken, accountId: meta.accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load campaigns");
      setItems(data.campaigns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [meta.accessToken, meta.accountId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading campaigns..." />;
  if (error) return <ErrorBlock error={error} onRetry={load} />;

  return (
    <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-text-muted" />
          <h3 className="text-[14px] font-semibold">{items.length} campaigns</h3>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-[12px] font-medium text-text-secondary"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Objective</Th>
            <Th>Budget</Th>
            <Th>Created</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="border-t border-border hover:bg-gray-50/50">
              <Td>
                <div className="font-medium text-[13px]">{c.name}</div>
                <div className="text-[10px] text-text-muted">{c.id}</div>
              </Td>
              <Td><StatusPill status={c.effective_status || c.status} /></Td>
              <Td className="text-[12px]">{c.objective?.replace("OUTCOME_", "")}</Td>
              <Td className="text-[12px]">{formatBudget(c.daily_budget, c.lifetime_budget, meta.currency)}</Td>
              <Td className="text-[12px] text-text-muted">
                {c.created_time ? new Date(c.created_time).toLocaleDateString() : "—"}
              </Td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><Td colSpan={5}><EmptyRow label="No campaigns yet" /></Td></tr>
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}

function AdSetsTab({ meta }: { meta: MetaAdsIntegrationConfig }) {
  const [items, setItems] = useState<MetaAdSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/adsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: meta.accessToken, accountId: meta.accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load ad sets");
      setItems(data.adsets || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [meta.accessToken, meta.accountId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading ad sets..." />;
  if (error) return <ErrorBlock error={error} onRetry={load} />;

  return (
    <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
      <div className="px-4 md:px-5 py-3 border-b border-border flex items-center gap-2">
        <Target className="w-4 h-4 text-text-muted" />
        <h3 className="text-[14px] font-semibold">{items.length} ad sets</h3>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Optimization</Th>
            <Th>Billing</Th>
            <Th>Budget</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-border hover:bg-gray-50/50">
              <Td>
                <div className="font-medium text-[13px]">{a.name}</div>
                <div className="text-[10px] text-text-muted">{a.id} · in campaign {a.campaign_id}</div>
              </Td>
              <Td><StatusPill status={a.effective_status || a.status} /></Td>
              <Td className="text-[12px]">{a.optimization_goal || "—"}</Td>
              <Td className="text-[12px]">{a.billing_event || "—"}</Td>
              <Td className="text-[12px]">{formatBudget(a.daily_budget, a.lifetime_budget, meta.currency)}</Td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><Td colSpan={5}><EmptyRow label="No ad sets yet" /></Td></tr>
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}

function AdsTab({ meta }: { meta: MetaAdsIntegrationConfig }) {
  const [items, setItems] = useState<MetaAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: meta.accessToken, accountId: meta.accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load ads");
      setItems(data.ads || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [meta.accessToken, meta.accountId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading ads..." />;
  if (error) return <ErrorBlock error={error} onRetry={load} />;

  return (
    <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
      <div className="px-4 md:px-5 py-3 border-b border-border flex items-center gap-2">
        <ImageIcon className="w-4 h-4 text-text-muted" />
        <h3 className="text-[14px] font-semibold">{items.length} ads</h3>
      </div>
      <TableWrap>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Status</Th>
            <Th>Ad Set</Th>
            <Th>Campaign</Th>
            <Th>Updated</Th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-border hover:bg-gray-50/50">
              <Td>
                <div className="font-medium text-[13px]">{a.name}</div>
                <div className="text-[10px] text-text-muted">{a.id}</div>
              </Td>
              <Td><StatusPill status={a.effective_status || a.status} /></Td>
              <Td className="text-[12px] font-mono text-text-muted">{a.adset_id}</Td>
              <Td className="text-[12px] font-mono text-text-muted">{a.campaign_id}</Td>
              <Td className="text-[12px] text-text-muted">
                {a.updated_time ? new Date(a.updated_time).toLocaleDateString() : "—"}
              </Td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr><Td colSpan={5}><EmptyRow label="No ads yet" /></Td></tr>
          )}
        </tbody>
      </TableWrap>
    </div>
  );
}

/* ========================================================================== */
/* Insights                                                                    */
/* ========================================================================== */

function InsightsTab({ meta }: { meta: MetaAdsIntegrationConfig }) {
  const [level, setLevel] = useState<"campaign" | "adset" | "ad">("campaign");
  const [datePreset, setDatePreset] = useState("last_30d");
  const [insights, setInsights] = useState<MetaInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: meta.accessToken,
          accountId: meta.accountId,
          options: { level, datePreset, limit: 100 },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load insights");
      setInsights(data.insights || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [meta.accessToken, meta.accountId, level, datePreset]);

  useEffect(() => {
    load();
  }, [load]);

  const top = [...insights]
    .sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0))
    .slice(0, 10);
  const chartData = top.map((i) => ({
    name: (i.campaign_name || i.adset_name || i.ad_name || "").slice(0, 20),
    spend: Number(i.spend || 0),
    clicks: Number(i.clicks || 0),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value as typeof level)}
          className="px-3 py-2 rounded-lg border border-border bg-surface-raised text-[12px] font-medium"
        >
          <option value="campaign">Campaigns</option>
          <option value="adset">Ad sets</option>
          <option value="ad">Ads</option>
        </select>
        <select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-surface-raised text-[12px] font-medium"
        >
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="last_7d">Last 7 days</option>
          <option value="last_14d">Last 14 days</option>
          <option value="last_30d">Last 30 days</option>
          <option value="last_90d">Last 90 days</option>
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="this_quarter">This quarter</option>
          <option value="maximum">Maximum</option>
        </select>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-surface-raised hover:bg-gray-50 text-[12px] font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {loading && <LoadingBlock label="Loading insights..." />}
      {error && <ErrorBlock error={error} onRetry={load} />}
      {!loading && !error && (
        <>
          {chartData.length > 0 && (
            <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-5">
              <h3 className="text-[14px] font-semibold mb-4">Top 10 by spend</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: -10, right: 10, top: 5, bottom: 45 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={60} interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="spend" fill="#1877F2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Spend</Th>
                  <Th>Impressions</Th>
                  <Th>Clicks</Th>
                  <Th>CTR</Th>
                  <Th>CPC</Th>
                </tr>
              </thead>
              <tbody>
                {insights.map((i, idx) => (
                  <tr key={idx} className="border-t border-border hover:bg-gray-50/50">
                    <Td>
                      <div className="font-medium text-[13px]">
                        {i.campaign_name || i.adset_name || i.ad_name || "—"}
                      </div>
                    </Td>
                    <Td className="text-[12px]">{formatCurrency(Number(i.spend || 0), meta.currency)}</Td>
                    <Td className="text-[12px]">{formatNumber(Number(i.impressions || 0))}</Td>
                    <Td className="text-[12px]">{formatNumber(Number(i.clicks || 0))}</Td>
                    <Td className="text-[12px]">{Number(i.ctr || 0).toFixed(2)}%</Td>
                    <Td className="text-[12px]">{formatCurrency(Number(i.cpc || 0), meta.currency)}</Td>
                  </tr>
                ))}
                {insights.length === 0 && (
                  <tr><Td colSpan={6}><EmptyRow label="No insights for this range" /></Td></tr>
                )}
              </tbody>
            </TableWrap>
          </div>
        </>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Audiences                                                                   */
/* ========================================================================== */

function AudiencesTab({ meta }: { meta: MetaAdsIntegrationConfig }) {
  const [items, setItems] = useState<MetaCustomAudience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/audiences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: meta.accessToken, accountId: meta.accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load audiences");
      setItems(data.audiences || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }, [meta.accessToken, meta.accountId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock label="Loading audiences..." />;
  if (error) return <ErrorBlock error={error} onRetry={load} />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {items.map((a) => (
        <div key={a.id} className="bg-surface-raised rounded-xl border border-border p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="min-w-0">
              <h4 className="text-[13px] font-semibold truncate">{a.name}</h4>
              <p className="text-[10px] text-text-muted truncate">{a.subtype || "Custom"}</p>
            </div>
            <Users className="w-4 h-4 text-text-muted shrink-0" />
          </div>
          {a.description && (
            <p className="text-[11px] text-text-secondary line-clamp-2 mb-2">{a.description}</p>
          )}
          <div className="text-[11px] text-text-muted space-y-0.5">
            <div>
              Size:{" "}
              <span className="font-medium text-text-primary">
                {a.approximate_count_lower_bound != null
                  ? `${formatNumber(a.approximate_count_lower_bound)}–${formatNumber(a.approximate_count_upper_bound || 0)}`
                  : "—"}
              </span>
            </div>
            <div>
              Status: <span className="font-medium">{a.delivery_status?.description || "—"}</span>
            </div>
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div className="col-span-full text-center py-16 bg-surface-raised rounded-xl border border-border">
          <Users className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-[13px] font-medium">No custom audiences</p>
          <p className="text-[11px] text-text-muted mt-1">
            Create custom audiences in Meta Ads Manager to see them here.
          </p>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Create campaign (DRAFT)                                                     */
/* ========================================================================== */

function CreateCampaignTab({ meta }: { meta: MetaAdsIntegrationConfig }) {
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("OUTCOME_TRAFFIC");
  const [dailyBudget, setDailyBudget] = useState("");
  const [specialCategory, setSpecialCategory] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ id: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    const campaign: CreateCampaignInput = {
      name: name.trim(),
      objective,
      special_ad_categories: specialCategory ? [specialCategory] : [],
    };
    if (dailyBudget) {
      const dollars = parseFloat(dailyBudget);
      if (!isNaN(dollars) && dollars > 0) {
        campaign.daily_budget_cents = Math.round(dollars * 100);
      }
    }

    try {
      const res = await fetch("/api/meta-ads/campaigns", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: meta.accessToken,
          accountId: meta.accountId,
          campaign,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign");
      setResult({ id: data.id });
      setName("");
      setDailyBudget("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-5 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-yellow-700 shrink-0 mt-0.5" />
        <div className="text-[12px] text-yellow-900 leading-relaxed">
          <strong>Draft mode only.</strong> Campaigns are always created as <code>PAUSED</code>.
          After review, activate them manually in Meta Ads Manager. You&apos;ll still need to
          create at least one ad set and ad before you can launch.
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Campaign name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={400}
            placeholder="e.g. Q2 Lead Gen — Southeast"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
          />
        </Field>

        <Field label="Objective">
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
          >
            {OBJECTIVES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>

        <Field label={`Daily budget (${meta.currency}, optional)`}>
          <input
            type="number"
            min="0"
            step="0.01"
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
            placeholder="25.00"
            className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
          />
          <p className="text-[11px] text-text-muted mt-1">
            Can also be set at the ad-set level. Leave blank to defer.
          </p>
        </Field>

        <Field label="Special ad category">
          <select
            value={specialCategory}
            onChange={(e) => setSpecialCategory(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-[#1877F2]/30 focus:border-[#1877F2]"
          >
            <option value="">None</option>
            <option value="CREDIT">Credit</option>
            <option value="EMPLOYMENT">Employment</option>
            <option value="HOUSING">Housing</option>
            <option value="ISSUES_ELECTIONS_POLITICS">Issues, elections, or politics</option>
            <option value="ONLINE_GAMBLING_AND_GAMING">Online gambling &amp; gaming</option>
            <option value="FINANCIAL_PRODUCTS_SERVICES">Financial products &amp; services</option>
          </select>
          <p className="text-[11px] text-text-muted mt-1">
            Required by Meta for certain regulated categories.
          </p>
        </Field>

        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-[#1877F2] hover:bg-[#166FE5] text-white text-[14px] font-medium disabled:opacity-50"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {submitting ? "Creating draft..." : "Create draft campaign"}
        </button>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div className="flex items-start gap-2 px-3 py-3 rounded-lg bg-brand-green/5 border border-brand-green/30 text-[12px] text-green-800">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-brand-green" />
            <div>
              <p className="font-medium">Draft campaign created (PAUSED)</p>
              <p className="text-[11px] mt-0.5">
                ID: <code className="font-mono">{result.id}</code>
              </p>
              <a
                href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${meta.accountId.replace("act_", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-[11px] font-medium text-[#1877F2] hover:underline"
              >
                Open in Ads Manager <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/* ========================================================================== */
/* Small pieces                                                                */
/* ========================================================================== */

function KPIBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-raised rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] md:text-[11px] font-medium text-text-muted uppercase tracking-wider">{label}</p>
        <Icon className="w-3.5 h-3.5 text-text-muted" />
      </div>
      <p className="text-[18px] md:text-[22px] font-semibold">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] || "text-gray-600 bg-gray-100";
  return (
    <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">{children}</table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 md:px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border bg-gray-50/50">
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 md:px-5 py-3 align-top ${className}`}>
      {children}
    </td>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-text-secondary mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="bg-surface-raised rounded-xl border border-border p-12 text-center">
      <Loader2 className="w-6 h-6 text-[#1877F2] animate-spin mx-auto mb-2" />
      <p className="text-[12px] text-text-muted">{label}</p>
    </div>
  );
}

function ErrorBlock({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-red-900">Couldn&apos;t load data</p>
        <p className="text-[12px] text-red-700 mt-0.5 break-words">{error}</p>
      </div>
      <button
        onClick={onRetry}
        className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-red-200 hover:bg-red-50 text-[12px] font-medium text-red-700"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="text-center py-8 text-[12px] text-text-muted">{label}</div>;
}

/* ========================================================================== */
/* Formatters                                                                  */
/* ========================================================================== */

function formatNumber(n: number): string {
  if (!isFinite(n)) return "0";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.round(n).toLocaleString();
}

function formatCurrency(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function formatBudget(daily?: string, lifetime?: string, currency?: string): string {
  if (daily) return `${formatCurrency(Number(daily) / 100, currency || "USD")}/day`;
  if (lifetime) return `${formatCurrency(Number(lifetime) / 100, currency || "USD")} total`;
  return "—";
}
