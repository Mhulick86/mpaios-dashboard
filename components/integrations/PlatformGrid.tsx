"use client";

/**
 * Platforms grid for /integrations — the UI for the server-side integrations
 * framework (lib/integrations/*).
 *
 *   GET  /api/integrations                     catalogue + connection status
 *   GET  /api/integrations/<id>/auth-url       starts OAuth (browser redirect)
 *   GET  /api/integrations/<id>/callback       returns to /integrations?connected=…|?error=…
 *   POST /api/integrations/<id>/connect        {apiKey} for api_key platforms
 *   POST /api/integrations/<id>/disconnect     {accountId?}
 *   GET  /api/integrations/<id>/test           read-only health check
 *
 * Tokens never reach the browser: the API returns account names and dates only.
 * Setup for every platform is documented in docs/integrations.md.
 */

import { useCallback, useEffect, useId, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Facebook,
  Hash,
  Linkedin,
  Loader2,
  MapPin,
  Megaphone,
  Music2,
  Pin,
  Plug,
  RefreshCw,
  Twitter,
  Unplug,
  Users,
  X,
} from "lucide-react";
import type { IntegrationCategory, IntegrationDefinition, IntegrationId } from "@/lib/integrations/registry";

/* ─── Types (mirror the JSON returned by GET /api/integrations) ─── */

/** Public view of a stored connection; mirrors ConnectionPublic in lib/integrations/store.ts (server-only, so not imported). */
export interface PlatformConnection {
  id: string;
  provider: IntegrationId;
  accountId: string;
  accountName: string | null;
  scopes: string[];
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  connectedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

/** One catalogue entry with its server-side status. */
export interface Platform extends IntegrationDefinition {
  callbackPath: string;
  missingEnv: string[];
  apiKeyFromEnv: boolean;
  connections: PlatformConnection[];
}

interface Catalogue {
  encryptionConfigured: boolean;
  integrations: Platform[];
}

interface Toast {
  kind: "success" | "error";
  /** Platform id from the query string; resolved to a display name at render time. */
  provider: string | null;
  message: string;
}

/* ─── Constants ─── */

const CATEGORY_ORDER: IntegrationCategory[] = ["Paid media", "Local & SEO", "CRM & sales", "Messaging"];

const ICONS: Record<IntegrationId, LucideIcon> = {
  google_ads: Megaphone,
  google_business_profile: MapPin,
  meta_ads: Facebook,
  linkedin_ads: Linkedin,
  tiktok_ads: Music2,
  pinterest_ads: Pin,
  x_ads: Twitter,
  hubspot: Users,
  slack: Hash,
  semrush: BarChart3,
};

const BUTTON_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-blue text-white text-[12px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 shrink-0";
const BUTTON_DANGER =
  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 shrink-0";
const BUTTON_QUIET =
  "inline-flex items-center gap-1 text-[11px] font-medium text-brand-blue hover:text-brand-blue-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 rounded disabled:opacity-40 disabled:cursor-not-allowed";
const BADGE = "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap";

/* ─── Helpers ─── */

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const data = (await res.json()) as unknown;
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function errorFrom(data: Record<string, unknown>, res: Response, fallback: string): string {
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  if (res.status === 401) return "Your session has expired. Sign in again and retry.";
  if (res.status === 403) return "Only administrators can manage platform connections.";
  return `${fallback} (HTTP ${res.status})`;
}

function humanize(id: string): string {
  return id
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString();
}

/** Brand-coloured icon tile: ~10% tint background, solid brand foreground. */
function tileStyle(hex: string, muted: boolean): CSSProperties {
  if (muted) return {};
  const ok = /^#[0-9a-f]{6}$/i.test(hex);
  return ok ? { backgroundColor: `${hex}1A`, color: hex } : {};
}

/** Turns whatever the provider's `test` action returned into one short line. */
function summarizeTest(data: unknown): string {
  if (!data || typeof data !== "object") return "Connection OK";
  const obj = data as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  const message = str(obj.message) ?? str(obj.summary) ?? str(obj.status);
  if (message && message.toLowerCase() !== "ok") return message;

  const nested = obj.account ?? obj.user ?? obj.team ?? obj.profile;
  const nestedName =
    nested && typeof nested === "object"
      ? str((nested as Record<string, unknown>).name) ?? str((nested as Record<string, unknown>).email)
      : str(nested);
  const who =
    str(obj.accountName) ?? str(obj.name) ?? nestedName ?? str(obj.email) ?? str(obj.domain) ?? str(obj.customerId) ?? str(obj.advertiserId);
  if (who) return `Connected as ${who}`;

  const list = Object.entries(obj).find(([, v]) => Array.isArray(v));
  if (list) return `OK · ${(list[1] as unknown[]).length} ${list[0]}`;

  const parts = Object.entries(obj)
    .filter(([k, v]) => k !== "ok" && (typeof v === "string" || typeof v === "number" || typeof v === "boolean"))
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.length ? `OK · ${parts.join(" · ")}` : "Connection OK";
}

/* ─── Component ─── */

export default function PlatformGrid() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/integrations", { cache: "no-store" });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorFrom(data, res, "Could not load platforms"));
      if (!Array.isArray(data.integrations)) throw new Error("Unexpected response from /api/integrations");
      setCatalogue({
        encryptionConfigured: data.encryptionConfigured !== false,
        integrations: data.integrations as Platform[],
      });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load platforms");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The OAuth callback lands on /integrations?connected=<id>&account=<name> or ?error=<msg>&provider=<id>.
  // Read it once (no useSearchParams: that would need a Suspense boundary) and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("error");
    if (!connected && !error) return;
    if (error) {
      setToast({ kind: "error", provider: params.get("provider"), message: error });
    } else if (connected) {
      const account = params.get("account");
      setToast({ kind: "success", provider: connected, message: account ? `connected as ${account}.` : "connected." });
    }
    ["connected", "account", "error", "provider"].forEach((k) => params.delete(k));
    const rest = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`
    );
  }, []);

  // Success toasts go away on their own; errors stay until dismissed.
  useEffect(() => {
    if (toast?.kind !== "success") return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const integrations = catalogue?.integrations ?? [];
  const nameFor = (id: string | null) => (id ? integrations.find((p) => p.id === id)?.name ?? humanize(id) : null);

  const known = new Set<string>(CATEGORY_ORDER);
  const groups: { category: string; platforms: Platform[] }[] = CATEGORY_ORDER.map((category) => ({
    category,
    platforms: integrations.filter((p) => p.category === category),
  })).filter((g) => g.platforms.length > 0);
  const other = integrations.filter((p) => !known.has(p.category));
  if (other.length) groups.push({ category: "Other", platforms: other });

  const connectable = integrations.filter((p) => p.availability === "available");
  const connectedCount = connectable.filter((p) => p.connections.length > 0).length;

  return (
    <div className="space-y-6">
      {toast && (
        <div
          role={toast.kind === "error" ? "alert" : "status"}
          className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border text-[12px] ${
            toast.kind === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-brand-green/10 border-brand-green/20 text-brand-green"
          }`}
        >
          {toast.kind === "error" ? (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <p className="flex-1 min-w-0 break-words">
            {toast.kind === "error" ? (
              <>
                {toast.provider ? <strong className="font-medium">{nameFor(toast.provider)}: </strong> : null}
                {toast.message}
              </>
            ) : (
              <>
                <strong className="font-medium">{nameFor(toast.provider)}</strong> {toast.message}
              </>
            )}
          </p>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="p-0.5 rounded hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-current shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {catalogue && !catalogue.encryptionConfigured && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium">INTEGRATIONS_ENCRYPTION_KEY is not set</p>
            <p className="mt-0.5 text-red-600">
              Platform credentials are encrypted before they are stored, so nothing can be connected until the key exists on the
              server. Generate one with{" "}
              <code className="text-[10px] bg-red-100 px-1 py-0.5 rounded break-all">
                node -e &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;base64&apos;))&quot;
              </code>{" "}
              and add it to Vercel (see docs/integrations.md).
            </p>
          </div>
        </div>
      )}

      {loading && !catalogue && (
        <div className="flex items-center gap-2 text-[12px] text-text-muted py-6" role="status">
          <Loader2 className="w-4 h-4 animate-spin text-brand-blue" /> Loading platforms…
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
          <span className="flex items-center gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{loadError}</span>
          </span>
          <button type="button" onClick={() => void load()} className={BUTTON_QUIET}>
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {catalogue && (
        <p className="text-[11px] text-text-muted">
          {connectedCount} of {connectable.length} connectable platforms connected · credentials are encrypted on the server and
          shared by every admin
        </p>
      )}

      {groups.map((group) => (
        <section key={group.category} aria-label={group.category}>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-text-muted mb-2">{group.category}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            {group.platforms.map((platform) => (
              <PlatformCard
                key={platform.id}
                platform={platform}
                encryptionConfigured={catalogue?.encryptionConfigured ?? true}
                onChanged={load}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/* ─── Card ─── */

interface PlatformCardProps {
  platform: Platform;
  encryptionConfigured: boolean;
  /** Re-fetches the catalogue after a connect/disconnect. */
  onChanged: () => Promise<void>;
}

function PlatformCard({ platform, encryptionConfigured, onChanged }: PlatformCardProps) {
  const Icon = (ICONS as Partial<Record<string, LucideIcon>>)[platform.id] ?? Plug;
  const inputId = useId();

  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  /** "connect" | "test:<connectionId>" | "disconnect:<connectionId>" */
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ connectionId: string; text: string } | null>(null);

  const connected = platform.connections.length > 0;
  const comingSoon = platform.availability === "coming_soon";
  const legacy = platform.availability === "legacy";
  const available = platform.availability === "available";
  const missingEnv = platform.missingEnv ?? [];
  const setupNeeded = available && missingEnv.length > 0;
  const canConnect = available && encryptionConfigured && !setupNeeded;
  const hasTest = platform.actions.includes("test");
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function startOAuth() {
    setError(null);
    setBusy("connect");
    window.location.href = `/api/integrations/${platform.id}/auth-url`;
  }

  async function connectWithKey(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const key = apiKey.trim();
    if (!key && !platform.apiKeyFromEnv) return;
    setBusy("connect");
    setError(null);
    try {
      const res = await fetch(`/api/integrations/${platform.id}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(key ? { apiKey: key } : {}),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorFrom(data, res, "Connect failed"));
      setApiKey("");
      setShowKey(false);
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(null);
    }
  }

  async function runTest(conn: PlatformConnection) {
    setBusy(`test:${conn.id}`);
    setError(null);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${platform.id}/test?account=${encodeURIComponent(conn.accountId)}`, {
        cache: "no-store",
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorFrom(data, res, "Test failed"));
      setTestResult({ connectionId: conn.id, text: summarizeTest(data) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(conn: PlatformConnection) {
    setBusy(`disconnect:${conn.id}`);
    setError(null);
    setTestResult(null);
    try {
      const res = await fetch(`/api/integrations/${platform.id}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: conn.accountId }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error(errorFrom(data, res, "Disconnect failed"));
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(null);
    }
  }

  const badge = connected ? (
    <span className={`${BADGE} bg-brand-green/10 text-brand-green`}>Connected</span>
  ) : comingSoon ? (
    <span className={`${BADGE} bg-gray-100 text-gray-400`}>Coming soon</span>
  ) : legacy ? (
    <span className={`${BADGE} bg-gray-100 text-gray-500`}>Separate page</span>
  ) : setupNeeded ? (
    <span className={`${BADGE} bg-amber-50 text-amber-700`}>Setup needed</span>
  ) : (
    <span className={`${BADGE} bg-gray-100 text-gray-400`}>Not connected</span>
  );

  const connectLabel = busy === "connect" ? "Connecting…" : "Connect";

  return (
    <div className={`bg-surface-raised rounded-xl border border-border p-4 md:p-6 flex flex-col gap-4 ${comingSoon ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${
              comingSoon ? "bg-gray-100 text-gray-400" : ""
            }`}
            style={tileStyle(platform.brandColor, comingSoon)}
            aria-hidden="true"
          >
            <Icon className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-[15px] md:text-[16px] font-semibold">{platform.name}</h4>
              {badge}
            </div>
            {platform.agent && (
              <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted mt-0.5">{platform.agent}</p>
            )}
            <p className="text-[12px] text-text-secondary mt-1">{platform.description}</p>
          </div>
        </div>
        <a
          href={platform.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium flex items-center gap-1 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40 rounded"
        >
          Docs <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Connected accounts */}
      {platform.connections.map((conn) => {
        const testing = busy === `test:${conn.id}`;
        const removing = busy === `disconnect:${conn.id}`;
        const showId = conn.accountName && conn.accountId !== "default" && conn.accountId !== conn.accountName;
        return (
          <div key={conn.id} className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-3 md:p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-brand-green break-words">{conn.accountName || conn.accountId}</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Connected {formatDate(conn.createdAt)}
                  {showId ? ` · ${conn.accountId}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasTest && (
                  <button type="button" onClick={() => void runTest(conn)} disabled={busy !== null} className={BUTTON_PRIMARY}>
                    {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                    {testing ? "Testing…" : "Test"}
                  </button>
                )}
                <button type="button" onClick={() => void disconnect(conn)} disabled={busy !== null} className={BUTTON_DANGER}>
                  {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                  Disconnect
                </button>
              </div>
            </div>
            {testResult?.connectionId === conn.id && (
              <p role="status" className="mt-2 flex items-start gap-1.5 text-[12px] text-brand-green break-words">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {testResult.text}
              </p>
            )}
          </div>
        );
      })}

      {/* Not connected / setup states */}
      {comingSoon && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] text-text-muted">Catalogue entry only. Connect will appear here once platform access is approved.</p>
        </div>
      )}

      {legacy && platform.legacyPath && (
        <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-lg p-3">
          <p className="text-[11px] text-text-muted">Managed on its own page for now; it will move into this grid later.</p>
          <Link href={platform.legacyPath} className={BUTTON_PRIMARY}>
            Open <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {setupNeeded && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium">Server setup needed</p>
            <p className="mt-0.5">
              Add these to Vercel:{" "}
              {missingEnv.map((name, i) => (
                <span key={name}>
                  {i > 0 ? ", " : ""}
                  <code className="text-[10px] bg-amber-100 px-1 py-0.5 rounded">{name}</code>
                </span>
              ))}
            </p>
            {platform.auth === "oauth2" && (
              <p className="mt-1 text-amber-700 break-all">
                Redirect URI to register:{" "}
                <code className="text-[10px] bg-amber-100 px-1 py-0.5 rounded">
                  {origin}
                  {platform.callbackPath}
                </code>
              </p>
            )}
          </div>
        </div>
      )}

      {available && platform.auth === "oauth2" && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-text-muted">
            {connected ? "Add another account through the platform's consent screen." : "Opens the platform's consent screen; tokens are stored encrypted on the server."}
          </p>
          <button
            type="button"
            onClick={startOAuth}
            disabled={!canConnect || busy !== null}
            title={
              !encryptionConfigured
                ? "Set INTEGRATIONS_ENCRYPTION_KEY first"
                : setupNeeded
                  ? `Missing: ${missingEnv.join(", ")}`
                  : undefined
            }
            className={connected ? BUTTON_QUIET : BUTTON_PRIMARY}
          >
            {busy === "connect" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
            {connected ? (busy === "connect" ? "Connecting…" : "Connect another account") : connectLabel}
          </button>
        </div>
      )}

      {available && platform.auth === "api_key" && !connected && (
        <form onSubmit={(e) => void connectWithKey(e)} className="space-y-2">
          <label htmlFor={inputId} className="block text-[12px] font-medium text-text-secondary">
            API key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <input
                id={inputId}
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                disabled={!canConnect || busy !== null}
                placeholder={
                  platform.apiKeyFromEnv && platform.apiKeyEnv
                    ? `Using ${platform.apiKeyEnv} from the server — or paste a key`
                    : `Paste your ${platform.name} API key`
                }
                className="w-full px-3 py-2 pr-10 border border-border rounded-lg text-[12px] font-mono bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? "Hide API key" : "Show API key"}
                aria-pressed={showKey}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue/40"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={!canConnect || busy !== null || (!apiKey.trim() && !platform.apiKeyFromEnv)}
              title={!encryptionConfigured ? "Set INTEGRATIONS_ENCRYPTION_KEY first" : undefined}
              className={BUTTON_PRIMARY}
            >
              {busy === "connect" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
              {connectLabel}
            </button>
          </div>
          <p className="text-[11px] text-text-muted">
            The key is validated with {platform.name}, then stored encrypted on the server
            {platform.apiKeyEnv ? (
              <>
                {" "}
                (or set <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">{platform.apiKeyEnv}</code> in Vercel and click
                Connect)
              </>
            ) : null}
            .
          </p>
        </form>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words min-w-0">{error}</span>
        </div>
      )}
    </div>
  );
}
