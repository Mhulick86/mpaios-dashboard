"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
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
  FolderOpen,
  Sparkles,
  Mail,
  LogIn,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import {
  INTEGRATIONS_STORAGE_KEY,
  type IntegrationsConfig,
  type AsanaWorkspace,
  type AsanaProject,
  defaultIntegrations,
} from "@/lib/asana";
import type { DriveFolder } from "@/lib/googleDrive";

interface GSCSite {
  siteUrl: string;
  permissionLevel: string;
}

interface GATestResult {
  success: boolean;
  propertyId: string;
  propertyName: string;
  hasData: boolean;
}

interface GSCTestResult {
  success: boolean;
  siteUrl?: string;
  sites?: GSCSite[];
  needsSiteSelection: boolean;
}

function IntegrationsContent() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<IntegrationsConfig>(defaultIntegrations());
  const [saved, setSaved] = useState(false);

  // Asana state
  const [patInput, setPatInput] = useState("");
  const [showPat, setShowPat] = useState(false);
  const [asanaTesting, setAsanaTesting] = useState(false);
  const [asanaError, setAsanaError] = useState<string | null>(null);
  const [asanaWorkspaces, setAsanaWorkspaces] = useState<AsanaWorkspace[]>([]);
  const [showAsanaManual, setShowAsanaManual] = useState(false);

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
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Gemini state
  const [geminiKey, setGeminiKey] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiTesting, setGeminiTesting] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  // Mail Automation state
  const [asanaProjects, setAsanaProjects] = useState<AsanaProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

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
        if (merged.gemini?.apiKey) setGeminiKey(merged.gemini.apiKey);
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

  // ─── Handle OAuth callbacks from URL params ───
  const handleOAuthCallback = useCallback(() => {
    // Google OAuth callback
    const googleToken = searchParams.get("google_access_token");
    const googleRefresh = searchParams.get("google_refresh_token");
    const googleError = searchParams.get("google_error");

    if (googleError) {
      setDriveError(googleError);
    }

    if (googleToken) {
      // Store Google tokens — load current config from storage to avoid stale state
      const stored = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
      const current = stored ? { ...defaultIntegrations(), ...JSON.parse(stored) } : defaultIntegrations();

      const updated = {
        ...current,
        googleDrive: {
          ...current.googleDrive,
          accessToken: googleToken,
          refreshToken: googleRefresh || current.googleDrive?.refreshToken || "",
          connected: false, // not fully connected until folder selected
          connectedAt: null,
        },
        // Also update GA and GSC with the same Google token if they need it
        googleAnalytics: {
          ...current.googleAnalytics,
          accessToken: googleToken,
          refreshToken: googleRefresh || current.googleAnalytics?.refreshToken || "",
        },
        googleSearchConsole: {
          ...current.googleSearchConsole,
          accessToken: googleToken,
          refreshToken: googleRefresh || current.googleSearchConsole?.refreshToken || "",
        },
      };

      setConfig(updated);
      localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated));
      setGaToken(googleToken);
      setGscToken(googleToken);

      // Auto-load Drive folders
      loadDriveFolders(googleToken);

      // Clean URL
      window.history.replaceState({}, "", "/integrations");
    }

    // Asana OAuth callback
    const asanaToken = searchParams.get("asana_access_token");
    const asanaRefresh = searchParams.get("asana_refresh_token");
    const asanaUserName = searchParams.get("asana_user_name");
    const asanaUserEmail = searchParams.get("asana_user_email");
    const asanaWorkspacesParam = searchParams.get("asana_workspaces");
    const asanaOAuthError = searchParams.get("asana_error");

    if (asanaOAuthError) {
      setAsanaError(asanaOAuthError);
    }

    if (asanaToken) {
      const stored = localStorage.getItem(INTEGRATIONS_STORAGE_KEY);
      const current = stored ? { ...defaultIntegrations(), ...JSON.parse(stored) } : defaultIntegrations();

      let workspaces: AsanaWorkspace[] = [];
      try {
        workspaces = asanaWorkspacesParam ? JSON.parse(asanaWorkspacesParam) : [];
      } catch { /* ignore */ }

      if (workspaces.length === 1) {
        // Auto-select single workspace
        const updated = {
          ...current,
          asana: {
            ...current.asana,
            pat: "", // Clear PAT since we're using OAuth
            accessToken: asanaToken,
            refreshToken: asanaRefresh || "",
            userName: asanaUserName || "",
            userEmail: asanaUserEmail || "",
            workspace: workspaces[0],
            connected: true,
            connectedAt: new Date().toISOString(),
          },
        };
        setConfig(updated);
        localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated));
      } else if (workspaces.length > 1) {
        // Show workspace selector
        const updated = {
          ...current,
          asana: {
            ...current.asana,
            pat: "",
            accessToken: asanaToken,
            refreshToken: asanaRefresh || "",
            userName: asanaUserName || "",
            userEmail: asanaUserEmail || "",
            workspace: null,
            connected: false,
            connectedAt: null,
          },
        };
        setConfig(updated);
        localStorage.setItem(INTEGRATIONS_STORAGE_KEY, JSON.stringify(updated));
        setAsanaWorkspaces(workspaces);
      }

      // Clean URL
      window.history.replaceState({}, "", "/integrations");
    }
  }, [searchParams]);

  useEffect(() => {
    handleOAuthCallback();
  }, [handleOAuthCallback]);

  // Count active integrations
  const activeCount = [
    config.asana?.connected && config.asana?.workspace,
    config.googleAnalytics?.connected,
    config.googleSearchConsole?.connected,
    config.googleDrive?.connected,
    config.gemini?.connected,
  ].filter(Boolean).length;

  /* ─── Google Sign In ─── */
  function handleGoogleSignIn() {
    // Request all Google scopes in one sign-in
    const scopes = [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/analytics.readonly",
      "https://www.googleapis.com/auth/webmasters.readonly",
    ].join(" ");
    window.location.href = `/api/auth/google/authorize?scopes=${encodeURIComponent(scopes)}`;
  }

  /* ─── Asana Sign In ─── */
  function handleAsanaSignIn() {
    window.location.href = "/api/auth/asana/authorize";
  }

  /* ─── Asana Handlers ─── */
  async function handleAsanaTest() {
    if (!patInput.trim()) return;
    setAsanaTesting(true);
    setAsanaError(null);
    setAsanaWorkspaces([]);
    try {
      const res = await fetch("/api/asana/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pat: patInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");
      if (data.workspaces?.length === 1) {
        saveConfig({
          ...config,
          asana: {
            ...config.asana,
            pat: patInput.trim(),
            accessToken: "",
            refreshToken: "",
            userName: data.user?.name || "",
            userEmail: data.user?.email || "",
            workspace: data.workspaces[0],
            connected: true,
            connectedAt: new Date().toISOString(),
          },
        });
      } else if (data.workspaces?.length > 1) {
        setAsanaWorkspaces(data.workspaces);
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
        ...config.asana,
        pat: patInput.trim() || config.asana.pat,
        workspace: ws,
        connected: true,
        connectedAt: new Date().toISOString(),
      },
    });
    setAsanaWorkspaces([]);
  }

  function handleAsanaDisconnect() {
    saveConfig({
      ...config,
      asana: defaultIntegrations().asana,
    });
    setPatInput("");
    setAsanaError(null);
    setAsanaWorkspaces([]);
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
          ...config.googleAnalytics,
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
    saveConfig({
      ...config,
      googleAnalytics: defaultIntegrations().googleAnalytics,
    });
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
            ...config.googleSearchConsole,
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
        ...config.googleSearchConsole,
        accessToken: gscToken.trim(),
        siteUrl,
        connected: true,
        connectedAt: new Date().toISOString(),
      },
    });
    setGscSites([]);
  }

  function handleGSCDisconnect() {
    saveConfig({
      ...config,
      googleSearchConsole: defaultIntegrations().googleSearchConsole,
    });
    setGscToken("");
    setGscSiteUrl("");
    setGscError(null);
    setGscSites([]);
  }

  /* ─── Google Drive Handlers ─── */
  async function loadDriveFolders(token: string) {
    setLoadingFolders(true);
    setDriveError(null);
    try {
      const res = await fetch("/api/google-drive/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load folders");
      setDriveFolders(data.folders || []);
    } catch (err: unknown) {
      setDriveError(err instanceof Error ? err.message : "Failed to load folders");
    } finally {
      setLoadingFolders(false);
    }
  }

  function handleDriveSelectFolder(folder: DriveFolder) {
    saveConfig({
      ...config,
      googleDrive: {
        ...config.googleDrive,
        folderId: folder.id,
        folderName: folder.name,
        connected: true,
        connectedAt: new Date().toISOString(),
      },
    });
    setDriveFolders([]);
  }

  function handleDriveDisconnect() {
    saveConfig({
      ...config,
      googleDrive: defaultIntegrations().googleDrive,
    });
    setDriveError(null);
    setDriveFolders([]);
  }

  function handleDrivePickFolder() {
    const token = config.googleDrive?.accessToken || config.googleAnalytics?.accessToken;
    if (token) {
      loadDriveFolders(token);
    } else {
      handleGoogleSignIn();
    }
  }

  /* ─── Gemini Handlers ─── */
  async function handleGeminiTest() {
    if (!geminiKey.trim()) return;
    setGeminiTesting(true);
    setGeminiError(null);
    try {
      const res = await fetch("/api/gemini/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: geminiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed");

      saveConfig({
        ...config,
        gemini: {
          apiKey: geminiKey.trim(),
          connected: true,
          connectedAt: new Date().toISOString(),
        },
      });
    } catch (err: unknown) {
      setGeminiError(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setGeminiTesting(false);
    }
  }

  function handleGeminiDisconnect() {
    saveConfig({
      ...config,
      gemini: defaultIntegrations().gemini,
    });
    setGeminiKey("");
    setGeminiError(null);
  }

  /* ─── Mail Automation Handlers ─── */
  async function loadAsanaProjects() {
    const token = config.asana?.accessToken || config.asana?.pat;
    if (!token || !config.asana?.workspace?.gid) return;
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/asana/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pat: token,
          workspaceGid: config.asana.workspace.gid,
        }),
      });
      const data = await res.json();
      if (res.ok) setAsanaProjects(data.projects || []);
    } catch { /* ignore */ }
    setLoadingProjects(false);
  }

  function handleSelectProject(project: AsanaProject) {
    saveConfig({
      ...config,
      mailAutomation: {
        ...config.mailAutomation,
        enabled: true,
        asanaProjectGid: project.gid,
        asanaProjectName: project.name,
      },
    });
    setAsanaProjects([]);
  }

  function handleDisableAutomation() {
    saveConfig({
      ...config,
      mailAutomation: defaultIntegrations().mailAutomation,
    });
  }

  const asanaConnected = config.asana?.connected && config.asana?.workspace;
  const gaConnected = config.googleAnalytics?.connected;
  const gscConnected = config.googleSearchConsole?.connected;
  const driveConnected = config.googleDrive?.connected;
  const geminiConnected = config.gemini?.connected;
  const googleSignedIn = !!(config.googleDrive?.accessToken || config.googleAnalytics?.accessToken);
  const automationReady = driveConnected && geminiConnected && asanaConnected && config.mailAutomation?.asanaProjectGid;

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
        </div>

        {asanaConnected ? (
          <div className="space-y-3">
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-brand-green">Connected to {config.asana.workspace?.name}</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    {config.asana.userName && <span>Signed in as {config.asana.userName} — </span>}
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
            {/* OAuth Sign In button */}
            <button
              onClick={handleAsanaSignIn}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg bg-[#F06A6A] hover:bg-[#e55b5b] text-white text-[14px] font-semibold transition-colors shadow-sm"
            >
              <LogIn className="w-5 h-5" />
              Sign in with Asana
            </button>

            {/* Manual PAT fallback */}
            <div>
              <button
                onClick={() => setShowAsanaManual(!showAsanaManual)}
                className="flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-secondary transition-colors"
              >
                {showAsanaManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Or use a Personal Access Token
              </button>

              {showAsanaManual && (
                <div className="mt-3 space-y-3">
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
                </div>
              )}
            </div>

            {asanaError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {asanaError}
              </div>
            )}

            {/* Workspace selector (from OAuth or PAT) */}
            {asanaWorkspaces.length > 1 && (
              <div>
                <p className="text-[12px] font-medium text-text-secondary mb-2">
                  <CheckCircle2 className="w-4 h-4 text-brand-green inline mr-1" />
                  Authenticated. Select a workspace:
                </p>
                <div className="space-y-2">
                  {asanaWorkspaces.map((ws) => (
                    <button key={ws.gid} onClick={() => handleAsanaSelectWorkspace(ws)} className="w-full text-left px-4 py-3 rounded-lg border border-border hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[13px] font-medium">
                      {ws.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Google Services Section ─── */}
      <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${googleSignedIn ? "bg-brand-green/10" : "bg-gray-100"}`}>
              <svg viewBox="0 0 24 24" className={`w-6 h-6 ${googleSignedIn ? "text-brand-green" : "text-gray-500"}`} fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold">Google</h3>
                {googleSignedIn && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Signed In</span>
                )}
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Sign in once for Drive, Analytics, and Search Console
              </p>
            </div>
          </div>
        </div>

        {!googleSignedIn ? (
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-lg bg-white border-2 border-gray-200 hover:bg-gray-50 text-[14px] font-semibold text-gray-700 transition-colors shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>
        ) : (
          <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-3 mb-4">
            <p className="text-[12px] text-brand-green font-medium">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              Google account connected — configure services below
            </p>
          </div>
        )}
      </div>

      {/* ─── Google Drive Card (shown after Google sign-in) ─── */}
      {googleSignedIn && (
        <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4 ml-4 border-l-4 border-l-blue-200">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${driveConnected ? "bg-brand-green/10" : "bg-gray-100"}`}>
                <FolderOpen className={`w-5 h-5 ${driveConnected ? "text-brand-green" : "text-gray-500"}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold">Google Drive</h3>
                  {driveConnected && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Connected</span>
                  )}
                </div>
                <p className="text-[12px] text-text-secondary mt-0.5">Select folder to watch for scanned mail</p>
              </div>
            </div>
          </div>

          {driveConnected ? (
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-brand-green">
                    Watching: {config.googleDrive.folderName}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Connected {config.googleDrive.connectedAt ? new Date(config.googleDrive.connectedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <button onClick={handleDriveDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleDrivePickFolder}
                disabled={loadingFolders}
                className="px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {loadingFolders ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading folders...</>
                ) : (
                  <><FolderOpen className="w-4 h-4" /> Choose Mail Folder</>
                )}
              </button>

              {driveError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {driveError}
                </div>
              )}

              {driveFolders.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-text-secondary mb-2">Select the folder to watch:</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {driveFolders.map((folder) => (
                      <button key={folder.id} onClick={() => handleDriveSelectFolder(folder)} className="w-full text-left px-4 py-2.5 rounded-lg border border-border hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[13px] font-medium flex items-center gap-2">
                        <FolderOpen className="w-4 h-4 text-text-muted shrink-0" />
                        {folder.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Google Analytics Card ─── */}
      {googleSignedIn && (
        <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4 ml-4 border-l-4 border-l-blue-200">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${gaConnected ? "bg-brand-green/10" : "bg-gray-100"}`}>
                <svg viewBox="0 0 24 24" className={`w-5 h-5 ${gaConnected ? "text-brand-green" : "text-gray-500"}`} fill="currentColor">
                  <path d="M22 3.2c0-.66-.54-1.2-1.2-1.2h-1.6c-.66 0-1.2.54-1.2 1.2v17.6c0 .66.54 1.2 1.2 1.2h1.6c.66 0 1.2-.54 1.2-1.2V3.2z" />
                  <path d="M15 8.2c0-.66-.54-1.2-1.2-1.2h-1.6c-.66 0-1.2.54-1.2 1.2v12.6c0 .66.54 1.2 1.2 1.2h1.6c.66 0 1.2-.54 1.2-1.2V8.2z" />
                  <circle cx="5" cy="19.5" r="2.5" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold">Google Analytics</h3>
                  {gaConnected && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Connected</span>
                  )}
                </div>
                <p className="text-[12px] text-text-secondary mt-0.5">GA4 performance data & attribution</p>
              </div>
            </div>
          </div>

          {gaConnected ? (
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-brand-green">
                    {config.googleAnalytics.propertyName || config.googleAnalytics.propertyId}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Property ID: {config.googleAnalytics.propertyId}
                  </p>
                </div>
                <button onClick={handleGADisconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1.5">GA4 Property ID</label>
                <div className="flex gap-2">
                  <input type="text" value={gaPropertyId} onChange={(e) => setGaPropertyId(e.target.value)} placeholder="e.g. 123456789" className="flex-1 px-3 py-2.5 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                  <button onClick={handleGATest} disabled={!gaPropertyId.trim() || gaTesting} className="px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0">
                    {gaTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : "Connect"}
                  </button>
                </div>
                <p className="text-[11px] text-text-muted mt-1.5">
                  Find your Property ID in GA4 → Admin → Property Settings
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
      )}

      {/* ─── Google Search Console Card ─── */}
      {googleSignedIn && (
        <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4 ml-4 border-l-4 border-l-blue-200">
          <div className="flex items-start justify-between mb-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${gscConnected ? "bg-brand-green/10" : "bg-gray-100"}`}>
                <Search className={`w-5 h-5 ${gscConnected ? "text-brand-green" : "text-gray-500"}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold">Search Console</h3>
                  {gscConnected && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Connected</span>
                  )}
                </div>
                <p className="text-[12px] text-text-secondary mt-0.5">Search queries, CTR & rankings</p>
              </div>
            </div>
          </div>

          {gscConnected ? (
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-brand-green">{config.googleSearchConsole.siteUrl}</p>
                </div>
                <button onClick={handleGSCDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Site URL (optional — leave blank to list all)</label>
                <div className="flex gap-2">
                  <input type="text" value={gscSiteUrl} onChange={(e) => setGscSiteUrl(e.target.value)} placeholder="e.g. https://example.com" className="flex-1 px-3 py-2.5 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                  <button onClick={handleGSCTest} disabled={gscTesting} className="px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0">
                    {gscTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : "Connect"}
                  </button>
                </div>
              </div>
              {gscError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {gscError}
                </div>
              )}
              {gscSites.length > 0 && (
                <div>
                  <p className="text-[12px] font-medium text-text-secondary mb-2">Select a site:</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {gscSites.map((site) => (
                      <button key={site.siteUrl} onClick={() => handleGSCSelectSite(site.siteUrl)} className="w-full text-left px-4 py-2.5 rounded-lg border border-border hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[13px] font-medium">
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
      )}

      {/* ─── Gemini AI Card ─── */}
      <div className="bg-surface-raised rounded-xl border border-border p-4 md:p-6 mb-4">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${geminiConnected ? "bg-brand-green/10" : "bg-gray-100"}`}>
              <Sparkles className={`w-6 h-6 ${geminiConnected ? "text-brand-green" : "text-gray-500"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold">Gemini AI</h3>
                {geminiConnected && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Connected</span>
                )}
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">Gemini 2.5 Pro — document analysis for mail scanning</p>
            </div>
          </div>
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium flex items-center gap-1 shrink-0">
            Get API Key <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {geminiConnected ? (
          <div className="space-y-3">
            <div className="bg-brand-green/5 border border-brand-green/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-brand-green">Gemini 2.5 Pro connected</p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Connected {config.gemini.connectedAt ? new Date(config.gemini.connectedAt).toLocaleDateString() : ""}
                  </p>
                </div>
                <button onClick={handleGeminiDisconnect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                  <Unplug className="w-3.5 h-3.5" /> Disconnect
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">
                <span className="font-medium text-text-secondary">How it works:</span> Gemini analyzes scanned documents to extract sender, category, urgency, and action items. Supports PDFs, images, and text files.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type={showGeminiKey ? "text" : "password"} value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="Enter your Gemini API key" className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue bg-white" />
                  <button type="button" onClick={() => setShowGeminiKey(!showGeminiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button onClick={handleGeminiTest} disabled={!geminiKey.trim() || geminiTesting} className="px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0">
                  {geminiTesting ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</> : "Test Connection"}
                </button>
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                Get a free API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-brand-blue hover:underline">Google AI Studio</a>
              </p>
            </div>
            {geminiError && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0" /> {geminiError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Mail Automation Card ─── */}
      <div className="bg-surface-raised rounded-xl border border-amber-200 p-4 md:p-6 mb-4">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${automationReady ? "bg-amber-100" : "bg-gray-100"}`}>
              <Mail className={`w-6 h-6 ${automationReady ? "text-amber-600" : "text-gray-500"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[16px] font-semibold">Mail Automation</h3>
                {automationReady && (
                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-green/10 text-brand-green">Active</span>
                )}
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Drive folder → Gemini analysis → Asana tasks (Kanban board)
              </p>
            </div>
          </div>
        </div>

        {automationReady ? (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-amber-700">
                    Sending tasks to: {config.mailAutomation.asanaProjectName}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Watching: {config.googleDrive.folderName} → Gemini 2.5 Pro → Asana
                  </p>
                </div>
                <button onClick={handleDisableAutomation} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors text-[12px] font-medium text-red-500">
                  <Unplug className="w-3.5 h-3.5" /> Disable
                </button>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-[11px] text-text-muted">
                <span className="font-medium text-text-secondary">Pipeline:</span> New files in your Drive folder are analyzed by Gemini, categorized by type, assigned urgency, and created as Asana tasks. View them on the <a href="/mail" className="text-brand-blue hover:underline font-medium">Mail Kanban board</a>.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-amber-50/50 rounded-lg p-4">
              <p className="text-[13px] font-medium text-text-secondary mb-3">
                Select an Asana project to receive mail tasks:
              </p>

              {!asanaConnected && (
                <p className="text-[12px] text-text-muted">Connect Asana above first.</p>
              )}
              {!driveConnected && (
                <p className="text-[12px] text-text-muted">Sign in with Google and select a Drive folder above.</p>
              )}
              {!geminiConnected && (
                <p className="text-[12px] text-text-muted">Connect Gemini AI above for document analysis.</p>
              )}

              {asanaConnected && driveConnected && geminiConnected && (
                <>
                  {asanaProjects.length === 0 ? (
                    <button onClick={loadAsanaProjects} disabled={loadingProjects} className="px-4 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-40 flex items-center gap-2">
                      {loadingProjects ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                      ) : (
                        "Load Asana Projects"
                      )}
                    </button>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {asanaProjects.map((project) => (
                        <button key={project.gid} onClick={() => handleSelectProject(project)} className="w-full text-left px-4 py-2.5 rounded-lg border border-border hover:border-brand-blue/40 hover:bg-brand-blue/5 transition-all text-[13px] font-medium">
                          {project.name}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
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

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl"><div className="animate-pulse bg-gray-100 rounded-xl h-96" /></div>}>
      <IntegrationsContent />
    </Suspense>
  );
}
