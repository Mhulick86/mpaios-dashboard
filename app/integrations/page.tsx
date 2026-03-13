"use client";

import { useState, useEffect } from "react";
import {
  Plug,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Unplug,
  MessageSquare as SlackIcon,
  Users,
  Search,
  HardDrive,
} from "lucide-react";

import {
  INTEGRATIONS_STORAGE_KEY,
  type IntegrationsConfig,
  type AsanaWorkspace,
  defaultIntegrations,
} from "@/lib/asana";

interface AsanaTestResult {
  user: { gid: string; name: string; email: string };
  workspaces: AsanaWorkspace[];
}

interface GATestResult {
  success: boolean;
  propertyId: string;
  propertyName: string;
  hasData: boolean;
}

interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

interface GSCTestResult {
  success: boolean;
  siteUrl?: string;
  sites?: GSCSite[];
  needsSiteSelection: boolean;
}

export default function IntegrationsPage() {
  const [config, setConfig] = useState<IntegrationsConfig>(defaultIntegrations());
  const [saved, setSaved] = useState(false);

  // Asana state
  const [patInput, setPatInput] = useState("");
  const [showPat, setShowPat] = useState(false);
  const [asanaTesting, setAsanaTesting] = useState(false);
  const [asanaTestResult, setAsanaTestResult] = useState<AsanaTestResult | null>(null);
  const [asanaError, setAsanaError] = useState<string | null>(null);

  // GA state
  const [gaToken, setGaToken] = useState("");
  const [gaPropertyId, setGaPropertyId] = useState("");
  const [showGaToken, setShowGaToken] = useState(false);
  const [gaTesting, setGaTesting] = useState(false);
  const [gaError, setGaError] = useState<string | null>(null);

  // GSC state
  const [gscToken, setGscToken] = useState("");
  const [gscSiteUrl, setGscSiteUrl] = useState("");
  const [showGscToken, setShowGscToken] = useState(false);
  const [gscTesting, setGscTesting] = useState(false);
  const [gscError, setGscError] = useState<string | null>(null);
  const [gscSites, setGscSites] = useState<GSCSite[]>([]);

  // Google Drive state
  const [driveToken, setDriveToken] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [showDriveToken, setShowDriveToken] = useState(false);
  const [driveTesting, setDriveTesting] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveUser, setDriveUser] = useState<{ displayName: string; emailAddress: string } | null>(null);

  // Load config from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const merged = { ...defaultIntegrations(), ...parsed };
        setConfig(merged);
        if (merged.asana?.pat) setPatInput(merged.asana.pat);
        if (merged.googleAnalytics?.accessToken) setGaToken(merged.googleAnalytics.accessToken);
        if (merged.googleAnalytics?.propertyId) setGaPropertyId(merged.googleAnalytics.propertyId);
        if (merged.googleSearchConsole?.accessToken) setGscToken(merged.googleSearchConsole.accessToken);
        if (merged.googleSearchConsole?.siteUrl) setGscSiteUrl(merged.googleSearchConsole.siteUrl);
        if (merged.googleDrive?.accessToken) setDriveToken(merged.googleDrive.accessToken);
        if (merged.googleDrive?.folderId) setDriveFolderId(merged.googleDrive.folderId);
      }
    } catch {
      // ignore
    }
  }, []);

  function saveConfig(newConfig: IntegrationsConfig) {
    setConfig(newConfig);
    localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(newConfig));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Count active integrations
  const activeCount = [
    config.asana?.connected && config.asana?.workspace,
    config.googleAnalytics?.connected,
    config.googleSearchConsole?.connected,
    config.googleDrive?.connected,
  ].filter(Boolean).length;

  /* ─── Asana Handlers ─── */
  async function handleAsanaTest() {
    if (!patInput.trim()) return;
    setAsanaTesting(true);
    setAsanaError(null);
    setAsanaTestResult(null);
    try {
      const res = await fetch("/api/asana/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: patInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      setAsanaTestResult(data);
      if (data.workspaces?.length === 1) {
        saveConfig({
          ...config,
          asana: {
            pat: patInput.trim(),
            workspace: data.workspaces[0],
            connected: true,
            connectedAt: new Date().toISOString(),
          },
        });
      }
    } catch (err: unknown) {
      setAsanaError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setAsanaTesting(false);
    }
  }

  function handleAsanaSelectWorkspace(ws: AsanaWorkspace) {
    saveConfig({
      ...config,
      asana: {
        pat: patInput.trim(),
        workspace: ws,
        connected: true,
        connectedAt: new Date().toISOString(),
      },
    });
  }

  function handleAsanaDisconnect() {
    const updated = { ...config, asana: defaultIntegrations().asana };
    saveConfig(updated);
    setPatInput("");
    setAsanaTestResult(null);
    setAsanaError(null);
  }

  /* ─── Google Analytics Handlers ─── */
  async function handleGATest() {
    if (!gaToken.trim() || !gaPropertyId.trim()) return;
    setGaTesting(true);
    setGaError(null);
    try {
      const res = await fetch("/api/google-analytics/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: gaToken.trim(),
          propertyId: gaPropertyId.trim().replace(/^properties\//, ""),
        }),
      });
      const data: GATestResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error || "Connection failed");
      saveConfig({
        ...config,
        googleAnalytics: {
          accessToken: gaToken.trim(),
          propertyId: gaPropertyId.trim().replace(/^properties\//, ""),
          propertyName: data.propertyName || `Property ${gaPropertyId}`,
          connected: true,
          connectedAt: new Date().toISOString(),
        },
      });
    } catch (err: unknown) {
      setGaError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setGaTesting(false);
    }
  }

  function handleGADisconnect() {
    const updated = { ...config, googleAnalytics: defaultIntegrations().googleAnalytics };
    saveConfig(updated);
    setGaToken("");
    setGaPropertyId("");
    setGaError(null);
  }

  /* ─── Google Search Console Handlers ─── */
  async function handleGSCTest() {
    if (!gscToken.trim()) return;
    setGscTesting(true);
    setGscError(null);
    setGscSites([]);
    try {
      const res = await fetch("/api/google-search-console/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: gscToken.trim(),
          siteUrl: gscSiteUrl.trim() || undefined,
        }),
      });
      const data: GSCTestResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error || "Connection failed");

      if (data.needsSiteSelection && data.sites) {
        setGscSites(data.sites);
        if (data.sites.length === 1) {
          handleGSCSelectSite(data.sites[0].siteUrl);
        }
      } else if (data.siteUrl) {
        saveConfig({
          ...config,
          googleSearchConsole: {
            accessToken: gscToken.trim(),
            siteUrl: data.siteUrl,
            connected: true,
            connectedAt: new Date().toISOString(),
          },
        });
      }
    } catch (err: unknown) {
      setGscError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setGscTesting(false);
    }
  }

  function handleGSCSelectSite(siteUrl: string) {
    setGscSiteUrl(siteUrl);
    saveConfig({
      ...config,
      googleSearchConsole: {
        accessToken: gscToken.trim(),
        siteUrl,
        connected: true,
        connectedAt: new Date().toISOString(),
      },
    });
    setGscSites([]);
  }

  function handleGSCDisconnect() {
    const updated = { ...config, googleSearchConsole: defaultIntegrations().googleSearchConsole };
    saveConfig(updated);
    setGscToken("");
    setGscSiteUrl("");
    setGscError(null);
    setGscSites([]);
  }

  /* ─── Google Drive Handlers ─── */
  async function handleDriveTest() {
    if (!driveToken.trim()) return;
    setDriveTesting(true);
    setDriveError(null);
    setDriveUser(null);
    try {
      const res = await fetch("/api/google-drive/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: driveToken.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      setDriveUser(data.user);
      saveConfig({
        ...config,
        googleDrive: {
          accessToken: driveToken.trim(),
          folderId: driveFolderId.trim(),
          connected: true,
          connectedAt: new Date().toISOString(),
        },
      });
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setDriveTesting(false);
    }
  }

  function handleDriveDisconnect() {
    const updated = { ...config, googleDrive: defaultIntegrations().googleDrive };
    saveConfig(updated);
    setDriveToken("");
    setDriveFolderId("");
    setDriveError(null);
    setDriveUser(null);
  }

  const asanaConnected = config.asana?.connected && config.asana?.workspace;
  const gaConnected = config.googleAnalytics?.connected;
  const gscConnected = config.googleSearchConsole?.connected;
  const driveConnected = config.googleDrive?.connected;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 md:mb-8 gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] md:text-[24px] font-semibold">Integrations</h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Connect external tools for data push & pull
          </p>
        </div>
        {saved && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-green/10 text-brand-green text-[12px] font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Saved
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="bg-surface-raised rounded-xl border border-border p-3 md:p-4 mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Plug className="w-5 h-5 text-brand-blue shrink-0" />
          <div>
            <p className="text-[13px] font-medium">
              {activeCount > 0
                ? `${activeCount} integration${activeCount > 1 ? "s" : ""} active`
                : "No integrations connected"}
            </p>
            <p className="text-[11px] text-text-muted">
              Credentials are stored locally in your browser
            </p>
          </div>
        </div>
        {activeCount > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-green" />
            <span className="text-[11px] font-medium text-brand-green">Connected</span>
          </div>
        )}
      </div>

      {/* ─── Asana Card ─── */}
      <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${asanaConnected ? "bg-brand-green/10" : "bg-gray-100"}`}>
              <svg viewBox="0 0 24 24" className={`w-6 h-6 ${asanaConnected ? "text-brand-green" : "text-gray-500"}`} fill="currentColor">
                <circle cx="12" cy="6" r="4" />
                <circle cx="6" cy="18" r="4" />
                <circle cx="18" cy="18" r="4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold">Asana</h3>
                {asanaConnected && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Connected</span>
                )}
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">Project management — push tasks, read projects, sync workflows</p>
            </div>
          </div>
          <a href="https://app.asana.com/0/my-apps" target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium flex items-center gap-1 shrink-0">
            Get PAT <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {asanaConnected ? (
          <div className="space-y-3">
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-brand-green">Connected to {config.asana.workspace?.name}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Connected {config.asana.connectedAt ? new Date(config.asana.connectedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <button onClick={handleAsanaDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">
                <span className="font-medium text-text-secondary">How it works:</span> The orchestrator sees your Asana projects and tasks when you chat. Agent 15 can create tasks and coordinate work.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Personal Access Token</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type={showPat ? "text" : "password"} value={patInput} onChange={(e) => setPatInput(e.target.value)} placeholder="Enter your Asana Personal Access Token" className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                  <button type="button" onClick={() => setShowPat(!showPat)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                    {showPat ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={handleAsanaTest} disabled={!patInput.trim() || asanaTesting} className="px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0">
                  {asanaTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : "Test Connection"}
                </button>
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                Create a PAT at <a href="https://app.asana.com/0/my-apps" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">app.asana.com/0/my-apps</a>
              </p>
            </div>
            {asanaError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {asanaError}
              </div>
            )}
            {asanaTestResult && asanaTestResult.workspaces.length > 1 && (
              <div>
                <p className="text-[12px] font-medium text-text-secondary mb-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-green inline mr-1" />
                  Connected as <strong>{asanaTestResult.user.name}</strong>. Select a workspace:
                </p>
                <div className="space-y-2">
                  {asanaTestResult.workspaces.map((ws) => (
                    <button key={ws.gid} onClick={() => handleAsanaSelectWorkspace(ws)} className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[13px] font-medium">
                      {ws.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {asanaTestResult && asanaTestResult.workspaces.length === 1 && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-brand-green/10 border border-brand-green/20 text-[12px] text-brand-green">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Connected as <strong className="mx-1">{asanaTestResult.user.name}</strong> to <strong>{asanaTestResult.workspaces[0].name}</strong>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Google Analytics Card ─── */}
      <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${gaConnected ? "bg-brand-green/10" : "bg-gray-100"}`}>
              {/* GA icon */}
              <svg viewBox="0 0 24 24" className={`w-6 h-6 ${gaConnected ? "text-brand-green" : "text-gray-500"}`} fill="currentColor">
                <path d="M22 3.2c0-.66-.54-1.2-1.2-1.2h-1.6c-.66 0-1.2.54-1.2 1.2v17.6c0 .66.54 1.2 1.2 1.2h1.6c.66 0 1.2-.54 1.2-1.2V3.2z" />
                <path d="M15 8.2c0-.66-.54-1.2-1.2-1.2h-1.6c-.66 0-1.2.54-1.2 1.2v12.6c0 .66.54 1.2 1.2 1.2h1.6c.66 0 1.2-.54 1.2-1.2V8.2z" />
                <circle cx="5" cy="19.5" r="2.5" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold">Google Analytics</h3>
                {gaConnected && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Connected</span>
                )}
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">GA4 performance data, traffic sources, page views & attribution</p>
            </div>
          </div>
          <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium flex items-center gap-1 shrink-0">
            Get Token <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {gaConnected ? (
          <div className="space-y-3">
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-brand-green">
                    Connected to {config.googleAnalytics.propertyName || config.googleAnalytics.propertyId}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Property ID: {config.googleAnalytics.propertyId} — Connected {config.googleAnalytics.connectedAt ? new Date(config.googleAnalytics.connectedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <button onClick={handleGADisconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">
                <span className="font-medium text-text-secondary">How it works:</span> The orchestrator pulls GA4 traffic, sessions, top pages, and traffic sources into every chat. Agent 13 can analyze this data in depth.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">OAuth Access Token</label>
              <div className="relative">
                <input type={showGaToken ? "text" : "password"} value={gaToken} onChange={(e) => setGaToken(e.target.value)} placeholder="Enter your Google OAuth access token" className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                <button type="button" onClick={() => setShowGaToken(!showGaToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                  {showGaToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">GA4 Property ID</label>
              <div className="flex gap-2">
                <input type="text" value={gaPropertyId} onChange={(e) => setGaPropertyId(e.target.value)} placeholder="e.g. 123456789" className="flex-1 px-3 py-2.5 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                <button onClick={handleGATest} disabled={!gaToken.trim() || !gaPropertyId.trim() || gaTesting} className="px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0">
                  {gaTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : "Test Connection"}
                </button>
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                Find your Property ID in GA4 → Admin → Property Settings. Use the <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">OAuth Playground</a> with scope <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">analytics.readonly</code> to get a token.
              </p>
            </div>
            {gaError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {gaError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Google Search Console Card ─── */}
      <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${gscConnected ? "bg-brand-green/10" : "bg-gray-100"}`}>
              <Search className={`w-6 h-6 ${gscConnected ? "text-brand-green" : "text-gray-500"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold">Google Search Console</h3>
                {gscConnected && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Connected</span>
                )}
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">Search queries, impressions, CTR, rankings & indexing data</p>
            </div>
          </div>
          <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium flex items-center gap-1 shrink-0">
            Get Token <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {gscConnected ? (
          <div className="space-y-3">
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-brand-green">Connected to {config.googleSearchConsole.siteUrl}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Connected {config.googleSearchConsole.connectedAt ? new Date(config.googleSearchConsole.connectedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <button onClick={handleGSCDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">
                <span className="font-medium text-text-secondary">How it works:</span> The orchestrator pulls top search queries, CTR, impressions, and ranking data into every chat. Agent 10 (SEO) uses this for keyword analysis and optimization.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">OAuth Access Token</label>
              <div className="relative">
                <input type={showGscToken ? "text" : "password"} value={gscToken} onChange={(e) => setGscToken(e.target.value)} placeholder="Enter your Google OAuth access token" className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                <button type="button" onClick={() => setShowGscToken(!showGscToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                  {showGscToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Site URL (optional — leave blank to list all sites)</label>
              <div className="flex gap-2">
                <input type="text" value={gscSiteUrl} onChange={(e) => setGscSiteUrl(e.target.value)} placeholder="e.g. https://example.com or sc-domain:example.com" className="flex-1 px-3 py-2.5 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                <button onClick={handleGSCTest} disabled={!gscToken.trim() || gscTesting} className="px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0">
                  {gscTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : "Test Connection"}
                </button>
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                Use the <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">OAuth Playground</a> with scope <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">webmasters.readonly</code> to get a token.
              </p>
            </div>
            {gscError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {gscError}
              </div>
            )}
            {/* Site selector */}
            {gscSites.length > 0 && (
              <div>
                <p className="text-[12px] font-medium text-text-secondary mb-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-green inline mr-1" />
                  Token verified. Select a site:
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {gscSites.map((site) => (
                    <button key={site.siteUrl} onClick={() => handleGSCSelectSite(site.siteUrl)} className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[13px] font-medium">
                      {site.siteUrl}
                      <span className="text-[10px] text-text-muted ml-2">({site.permissionLevel})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Google Drive Card ─── */}
      <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${driveConnected ? "bg-brand-green/10" : "bg-gray-100"}`}>
              <HardDrive className={`w-6 h-6 ${driveConnected ? "text-brand-green" : "text-gray-500"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold">Google Drive</h3>
                {driveConnected && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Connected</span>
                )}
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">File storage & sharing — pipeline outputs, reports, deliverables</p>
            </div>
          </div>
          <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium flex items-center gap-1 shrink-0">
            Get Token <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {driveConnected ? (
          <div className="space-y-3">
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-brand-green">
                    Connected{driveUser ? ` as ${driveUser.displayName}` : ""}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {driveUser?.emailAddress ? `${driveUser.emailAddress} — ` : ""}
                    {config.googleDrive.folderId ? `Folder: ${config.googleDrive.folderId}` : "Root folder"}
                    {config.googleDrive.connectedAt ? ` — Connected ${new Date(config.googleDrive.connectedAt).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <button onClick={handleDriveDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">
                <span className="font-medium text-text-secondary">How it works:</span> Pipeline runs create a project folder in your Drive and upload each agent&apos;s output as a shareable document. Use sharing to collaborate with your team.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">OAuth Access Token</label>
              <div className="relative">
                <input type={showDriveToken ? "text" : "password"} value={driveToken} onChange={(e) => setDriveToken(e.target.value)} placeholder="Enter your Google OAuth access token" className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                <button type="button" onClick={() => setShowDriveToken(!showDriveToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                  {showDriveToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Root Folder ID (optional — leave blank for Drive root)</label>
              <div className="flex gap-2">
                <input type="text" value={driveFolderId} onChange={(e) => setDriveFolderId(e.target.value)} placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2wtIs" className="flex-1 px-3 py-2.5 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                <button onClick={handleDriveTest} disabled={!driveToken.trim() || driveTesting} className="px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0">
                  {driveTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : "Test Connection"}
                </button>
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                Use the <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">OAuth Playground</a> with scope <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">drive.file</code> to get a token. The folder ID is in the Drive URL after <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">folders/</code>.
              </p>
            </div>
            {driveError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {driveError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Coming Soon cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-6">
        {[
          { name: "Slack", desc: "Notifications & team updates", icon: SlackIcon },
          { name: "HubSpot", desc: "CRM & lead management", icon: Users },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.name} className="bg-surface-raised rounded-xl border border-border p-5 opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-gray-500">{item.name}</h3>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Coming Soon</span>
                  </div>
                  <p className="text-[11px] text-gray-400">{item.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
