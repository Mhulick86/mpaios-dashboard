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

  // Ahrefs state
  const [ahrefsKey, setAhrefsKey] = useState("");
  const [showAhrefsKey, setShowAhrefsKey] = useState(false);
  const [ahrefsTesting, setAhrefsTesting] = useState(false);
  const [ahrefsError, setAhrefsError] = useState<string | null>(null);
  const [ahrefsResult, setAhrefsResult] = useState<{ domainRating?: number; ahrefsRank?: number } | null>(null);

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
        if (merged.ahrefs?.apiKey) setAhrefsKey(merged.ahrefs.apiKey);
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
    config.ahrefs?.connected,
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

  /* ─── Google OAuth Popup Helper ─── */
  function openGoogleOAuth(
    scopes: string[],
    onSuccess: (data: { accessToken: string; refreshToken: string }) => void,
    onError: (message: string) => void = (m) => console.error("Google OAuth error:", m)
  ) {
    const redirectUri = `${window.location.origin}/auth/google/callback`;
    let popup: Window | null = null;
    let closedPoll: ReturnType<typeof setInterval> | null = null;
    let settled = false;

    function cleanup() {
      window.removeEventListener("message", handleMessage);
      if (closedPoll) clearInterval(closedPoll);
    }
    function fail(msg: string) {
      if (settled) return;
      settled = true;
      cleanup();
      onError(msg);
    }
    function succeed(data: { accessToken: string; refreshToken: string }) {
      if (settled) return;
      settled = true;
      cleanup();
      onSuccess(data);
    }

    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "GOOGLE_OAUTH_SUCCESS") {
        succeed({
          accessToken: event.data.accessToken,
          refreshToken: event.data.refreshToken,
        });
      } else if (event.data?.type === "GOOGLE_OAUTH_ERROR") {
        fail(event.data.error || "Google sign-in failed in the popup window.");
      }
    }
    window.addEventListener("message", handleMessage);

    fetch("/api/google/auth-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scopes, redirectUri }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          throw new Error(
            data.error ||
              (res.status === 401
                ? "You must be signed in to MPAIOS before connecting Google. Sign in and try again."
                : `Failed to start Google sign-in (HTTP ${res.status}).`)
          );
        }
        const w = 500;
        const h = 600;
        const left = window.screenX + (window.innerWidth - w) / 2;
        const top = window.screenY + (window.innerHeight - h) / 2;
        popup = window.open(
          data.url,
          "google_oauth",
          `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
        );
        if (!popup) {
          throw new Error(
            "Popup was blocked. Allow popups for this site and try again."
          );
        }
        // Detect if the user closes the popup without completing sign-in.
        closedPoll = setInterval(() => {
          if (popup && popup.closed) {
            fail("Sign-in window closed before completing. Please try again.");
          }
        }, 500);
      })
      .catch((err) => {
        fail(err instanceof Error ? err.message : String(err));
      });
  }

  /* ─── Google Analytics Handlers ─── */
  function handleGASignIn() {
    setGaTesting(true);
    setGaError(null);
    openGoogleOAuth(
      ["https://www.googleapis.com/auth/analytics.readonly"],
      async ({ accessToken, refreshToken }) => {
        setGaToken(accessToken);
        // Auto-detect the GA4 property
        try {
          // First, list available GA4 properties
          const acctRes = await fetch(
            "https://analyticsadmin.googleapis.com/v1beta/accountSummaries",
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (acctRes.ok) {
            const acctData = await acctRes.json();
            const summaries = acctData.accountSummaries || [];
            // Find first GA4 property
            for (const acct of summaries) {
              const props = acct.propertySummaries || [];
              if (props.length > 0) {
                const prop = props[0];
                const propId = prop.property?.replace("properties/", "") || "";
                const propName = prop.displayName || `Property ${propId}`;
                setGaPropertyId(propId);
                saveConfig({
                  ...config,
                  googleAnalytics: {
                    accessToken,
                    propertyId: propId,
                    propertyName: propName,
                    connected: true,
                    connectedAt: new Date().toISOString(),
                  },
                });
                // Also save refresh token for auto-renewal
                try {
                  const stored = localStorage.getItem("mpaios_google_tokens") || "{}";
                  const tokens = JSON.parse(stored);
                  tokens.ga = { refreshToken, accessToken };
                  localStorage.setItem("mpaios_google_tokens", JSON.stringify(tokens));
                } catch {}
                setGaTesting(false);
                return;
              }
            }
            setGaError("No GA4 properties found in your Google account. Create one at analytics.google.com first.");
          } else {
            setGaError("Could not fetch GA4 properties. The token may lack the correct scope.");
          }
        } catch (err) {
          setGaError(err instanceof Error ? err.message : "Failed to detect GA4 property");
        }
        setGaTesting(false);
      },
      (msg) => {
        setGaError(msg);
        setGaTesting(false);
      }
    );
  }

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
    try {
      const stored = localStorage.getItem("mpaios_google_tokens") || "{}";
      const tokens = JSON.parse(stored);
      delete tokens.ga;
      localStorage.setItem("mpaios_google_tokens", JSON.stringify(tokens));
    } catch {}
  }

  /* ─── Google Search Console Handlers ─── */
  function handleGSCSignIn() {
    setGscTesting(true);
    setGscError(null);
    openGoogleOAuth(
      ["https://www.googleapis.com/auth/webmasters.readonly"],
      async ({ accessToken, refreshToken }) => {
        setGscToken(accessToken);
        try {
          // Auto-detect sites
          const sitesRes = await fetch(
            "https://www.googleapis.com/webmasters/v3/sites",
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (sitesRes.ok) {
            const sitesData = await sitesRes.json();
            const sites = (sitesData.siteEntry || []).map((s: { siteUrl: string; permissionLevel: string }) => ({
              siteUrl: s.siteUrl,
              permissionLevel: s.permissionLevel,
            }));
            if (sites.length === 1) {
              setGscSiteUrl(sites[0].siteUrl);
              saveConfig({
                ...config,
                googleSearchConsole: {
                  accessToken,
                  siteUrl: sites[0].siteUrl,
                  connected: true,
                  connectedAt: new Date().toISOString(),
                },
              });
            } else if (sites.length > 1) {
              setGscSites(sites);
              setGscToken(accessToken);
            } else {
              setGscError("No sites found in your Search Console account.");
            }
            // Save refresh token
            try {
              const stored = localStorage.getItem("mpaios_google_tokens") || "{}";
              const tokens = JSON.parse(stored);
              tokens.gsc = { refreshToken, accessToken };
              localStorage.setItem("mpaios_google_tokens", JSON.stringify(tokens));
            } catch {}
          } else {
            setGscError("Could not fetch Search Console sites.");
          }
        } catch (err) {
          setGscError(err instanceof Error ? err.message : "Failed to detect sites");
        }
        setGscTesting(false);
      },
      (msg) => {
        setGscError(msg);
        setGscTesting(false);
      }
    );
  }

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
    try {
      const stored = localStorage.getItem("mpaios_google_tokens") || "{}";
      const tokens = JSON.parse(stored);
      delete tokens.gsc;
      localStorage.setItem("mpaios_google_tokens", JSON.stringify(tokens));
    } catch {}
  }

  /* ─── Google Drive Handlers ─── */
  function handleDriveSignIn() {
    setDriveTesting(true);
    setDriveError(null);
    openGoogleOAuth(
      ["https://www.googleapis.com/auth/drive.file"],
      async ({ accessToken, refreshToken }) => {
        setDriveToken(accessToken);
        try {
          // Get user info
          const userRes = await fetch(
            "https://www.googleapis.com/drive/v3/about?fields=user",
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          if (userRes.ok) {
            const userData = await userRes.json();
            setDriveUser(userData.user || null);
          }
          saveConfig({
            ...config,
            googleDrive: {
              accessToken,
              folderId: driveFolderId,
              connected: true,
              connectedAt: new Date().toISOString(),
            },
          });
          try {
            const stored = localStorage.getItem("mpaios_google_tokens") || "{}";
            const tokens = JSON.parse(stored);
            tokens.drive = { refreshToken, accessToken };
            localStorage.setItem("mpaios_google_tokens", JSON.stringify(tokens));
          } catch {}
        } catch (err) {
          setDriveError(err instanceof Error ? err.message : "Failed to connect");
        }
        setDriveTesting(false);
      },
      (msg) => {
        setDriveError(msg);
        setDriveTesting(false);
      }
    );
  }

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

  /* ─── Ahrefs Handlers ─── */
  async function handleAhrefsTest() {
    if (!ahrefsKey.trim()) return;
    setAhrefsTesting(true);
    setAhrefsError(null);
    setAhrefsResult(null);
    try {
      const res = await fetch("/api/ahrefs/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: ahrefsKey.trim(), target: "marketingpowered.ai" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      // Parse DR from the markdown response
      const drMatch = data.markdown?.match(/Domain Rating:\*\*\s*(\d+)/);
      const rankMatch = data.markdown?.match(/Ahrefs Rank:\*\*\s*([\d,]+)/);
      setAhrefsResult({
        domainRating: drMatch ? parseInt(drMatch[1]) : undefined,
        ahrefsRank: rankMatch ? parseInt(rankMatch[1].replace(/,/g, "")) : undefined,
      });
      saveConfig({
        ...config,
        ahrefs: {
          apiKey: ahrefsKey.trim(),
          connected: true,
          connectedAt: new Date().toISOString(),
        },
      });
      // Also save to mpaios_api_keys for orchestrator compatibility
      try {
        const stored = localStorage.getItem("mpaios_api_keys");
        const keys = stored ? JSON.parse(stored) : {};
        keys.ahrefs = ahrefsKey.trim();
        localStorage.setItem("mpaios_api_keys", JSON.stringify(keys));
      } catch {}
    } catch (err: unknown) {
      setAhrefsError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setAhrefsTesting(false);
    }
  }

  function handleAhrefsDisconnect() {
    const updated = { ...config, ahrefs: defaultIntegrations().ahrefs };
    saveConfig(updated);
    setAhrefsKey("");
    setAhrefsError(null);
    setAhrefsResult(null);
    // Also remove from mpaios_api_keys
    try {
      const stored = localStorage.getItem("mpaios_api_keys");
      if (stored) {
        const keys = JSON.parse(stored);
        delete keys.ahrefs;
        localStorage.setItem("mpaios_api_keys", JSON.stringify(keys));
      }
    } catch {}
  }

  const asanaConnected = config.asana?.connected && config.asana?.workspace;
  const gaConnected = config.googleAnalytics?.connected;
  const gscConnected = config.googleSearchConsole?.connected;
  const driveConnected = config.googleDrive?.connected;
  const ahrefsConnected = config.ahrefs?.connected;

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
            <button
              onClick={handleGASignIn}
              disabled={gaTesting}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[14px] font-medium disabled:opacity-50"
            >
              {gaTesting ? (
                <Loader2 className="w-5 h-5 animate-spin text-brand-blue" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {gaTesting ? "Connecting..." : "Sign in with Google"}
            </button>
            <p className="text-[11px] text-text-muted text-center">
              We&apos;ll auto-detect your GA4 property. Read-only access to analytics data.
            </p>
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
            <button
              onClick={handleGSCSignIn}
              disabled={gscTesting}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[14px] font-medium disabled:opacity-50"
            >
              {gscTesting ? (
                <Loader2 className="w-5 h-5 animate-spin text-brand-blue" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {gscTesting ? "Connecting..." : "Sign in with Google"}
            </button>
            <p className="text-[11px] text-text-muted text-center">
              We&apos;ll auto-detect your verified sites. Read-only access to search data.
            </p>
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
            <button
              onClick={handleDriveSignIn}
              disabled={driveTesting}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[14px] font-medium disabled:opacity-50"
            >
              {driveTesting ? (
                <Loader2 className="w-5 h-5 animate-spin text-brand-blue" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              )}
              {driveTesting ? "Connecting..." : "Sign in with Google"}
            </button>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Root Folder ID (optional — leave blank for Drive root)</label>
              <input type="text" value={driveFolderId} onChange={(e) => setDriveFolderId(e.target.value)} placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2wtIs" className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
              <p className="text-[11px] text-text-muted mt-1.5">
                Set a folder ID to organize pipeline outputs. Find it in the Drive URL after <code className="text-[10px] bg-gray-100 px-1 py-0.5 rounded">folders/</code>.
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

      {/* ─── Ahrefs ─── */}
      <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
        <button
          className="w-full flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50/50 transition-colors"
          onClick={() => {
            const el = document.getElementById("ahrefs-panel");
            if (el) el.classList.toggle("hidden");
          }}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${ahrefsConnected ? "bg-orange-100" : "bg-gray-100"}`}>
              <Search className={`w-5 h-5 ${ahrefsConnected ? "text-orange-600" : "text-gray-400"}`} />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-semibold">Ahrefs</h3>
                {ahrefsConnected ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-100 text-green-700"><CheckCircle2 className="w-3 h-3" /> Connected</span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">Not Connected</span>
                )}
              </div>
              <p className="text-[11px] text-text-muted">SEO data — backlinks, keywords, domain rating, competitors (Agents 03, 10, 21, 30, 31)</p>
            </div>
          </div>
        </button>

        <div id="ahrefs-panel" className={ahrefsConnected ? "hidden" : ""}>
          <div className="border-t border-border p-5 space-y-3">
            {ahrefsConnected ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-green-700">Ahrefs API Connected</p>
                    {ahrefsResult?.domainRating !== undefined && (
                      <p className="text-[11px] text-text-muted mt-0.5">
                        DR: {ahrefsResult.domainRating} | Ahrefs Rank: {ahrefsResult.ahrefsRank?.toLocaleString() || "N/A"}
                      </p>
                    )}
                    <p className="text-[10px] text-text-muted mt-0.5">Connected {config.ahrefs?.connectedAt ? new Date(config.ahrefs.connectedAt).toLocaleDateString() : ""}</p>
                  </div>
                  <button onClick={handleAhrefsDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                    <Unplug className="w-3.5 h-3.5" /> Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-muted mb-1">Ahrefs API Key</label>
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type={showAhrefsKey ? "text" : "password"}
                        value={ahrefsKey}
                        onChange={(e) => setAhrefsKey(e.target.value)}
                        placeholder="Enter your Ahrefs API token"
                        className="w-full px-3 py-2 border border-border rounded-lg text-[12px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue pr-10"
                      />
                      <button
                        onClick={() => setShowAhrefsKey(!showAhrefsKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                      >
                        {showAhrefsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      onClick={handleAhrefsTest}
                      disabled={!ahrefsKey.trim() || ahrefsTesting}
                      className="px-4 py-2 bg-brand-blue text-white rounded-lg text-[12px] font-medium hover:bg-brand-blue/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                      {ahrefsTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plug className="w-3.5 h-3.5" />}
                      Test & Connect
                    </button>
                  </div>
                  <p className="text-[11px] text-text-muted mt-1.5">
                    Get your API key from <a href="https://app.ahrefs.com/user/api" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Ahrefs → User → API <ExternalLink className="w-3 h-3 inline" /></a>. Powers SEO agents with live backlink, keyword, and competitor data.
                  </p>
                </div>
              </div>
            )}
            {ahrefsError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {ahrefsError}
              </div>
            )}
          </div>
        </div>
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
