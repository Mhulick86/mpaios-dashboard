"use client";

import { useState, useEffect } from "react";
import {
  MapPin, Search, Globe, Star, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Minus, BarChart3, Building2,
  Phone, Clock, Camera, MessageSquare, Loader2, Zap,
  History, ArrowUpRight, ArrowDownRight, Trash2,
} from "lucide-react";
import { saveScan, getScanHistory, deleteScan, compareScanPoints, type ScanRecord } from "@/lib/localSeoHistory";

/* ── Types ── */
interface GridPoint {
  row: number;
  col: number;
  rank: number | null; // null = not ranking
  lat: number;
  lng: number;
}

interface ScanResult {
  keyword: string;
  businessName: string;
  gridSize: number;
  points: GridPoint[];
  avgRank: number;
  topRank: number;
  visibility: number; // percentage of grid points ranking in top 3
  scanDate: string;
}

/* ── Color helper ── */
function getRankColor(rank: number | null): string {
  if (rank === null) return "#374151"; // not ranking
  if (rank === 1) return "#08AE67";
  if (rank <= 3) return "#2CACE8";
  if (rank <= 5) return "#F59E0B";
  if (rank <= 10) return "#F97316";
  if (rank <= 20) return "#EF4444";
  return "#6B7280";
}

function getRankBg(rank: number | null): string {
  if (rank === null) return "bg-gray-800";
  if (rank === 1) return "bg-brand-green";
  if (rank <= 3) return "bg-brand-blue";
  if (rank <= 5) return "bg-yellow-500";
  if (rank <= 10) return "bg-orange-500";
  if (rank <= 20) return "bg-red-500";
  return "bg-gray-500";
}

/* ── Mock scan generator (replaced with real API when DataForSEO/SerpAPI key is configured) ── */
function generateScan(keyword: string, businessName: string, gridSize: number): ScanResult {
  const points: GridPoint[] = [];
  const centerLat = 26.1224; // Fort Lauderdale area
  const centerLng = -80.1373;
  const spread = 0.015 * gridSize;

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const distFromCenter = Math.sqrt(
        Math.pow(r - Math.floor(gridSize / 2), 2) +
        Math.pow(c - Math.floor(gridSize / 2), 2)
      );
      // Closer to center = better ranking
      let rank: number | null;
      const rand = Math.random();
      if (distFromCenter < 1.5) {
        rank = rand < 0.4 ? 1 : rand < 0.7 ? 2 : rand < 0.9 ? 3 : Math.floor(Math.random() * 5) + 3;
      } else if (distFromCenter < 3) {
        rank = rand < 0.2 ? 1 : rand < 0.5 ? Math.floor(Math.random() * 3) + 2 : rand < 0.8 ? Math.floor(Math.random() * 7) + 4 : null;
      } else {
        rank = rand < 0.3 ? Math.floor(Math.random() * 10) + 5 : rand < 0.6 ? Math.floor(Math.random() * 15) + 8 : null;
      }

      points.push({
        row: r,
        col: c,
        rank,
        lat: centerLat + (r - gridSize / 2) * (spread / gridSize),
        lng: centerLng + (c - gridSize / 2) * (spread / gridSize),
      });
    }
  }

  const rankedPoints = points.filter(p => p.rank !== null);
  const avgRank = rankedPoints.length > 0
    ? Math.round((rankedPoints.reduce((s, p) => s + p.rank!, 0) / rankedPoints.length) * 10) / 10
    : 0;
  const topRank = rankedPoints.length > 0 ? Math.min(...rankedPoints.map(p => p.rank!)) : 0;
  const top3Count = points.filter(p => p.rank !== null && p.rank <= 3).length;
  const visibility = Math.round((top3Count / points.length) * 100);

  return {
    keyword,
    businessName,
    gridSize,
    points,
    avgRank,
    topRank,
    visibility,
    scanDate: new Date().toISOString(),
  };
}

export default function LocalSEOPage() {
  const [keyword, setKeyword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [gridSize, setGridSize] = useState(7);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<GridPoint | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "heatmap">("grid");
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [compareScan, setCompareScan] = useState<ScanRecord | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Load scan history on mount
  useEffect(() => {
    getScanHistory({ limit: 20 }).then(setHistory);
  }, []);

  const handleScan = async () => {
    if (!keyword.trim() || !businessName.trim()) return;
    setScanning(true);
    await new Promise(r => setTimeout(r, 2000));
    const result = generateScan(keyword, businessName, gridSize);
    setScanResult(result);
    setScanning(false);

    // Save to Supabase
    const saved = await saveScan({
      businessName: result.businessName,
      keyword: result.keyword,
      gridSize: result.gridSize,
      avgRank: result.avgRank,
      topRank: result.topRank,
      visibility: result.visibility,
      totalPoints: result.points.length,
      rankingPoints: result.points.filter(p => p.rank !== null).length,
      points: result.points,
    });
    if (saved) {
      setHistory(prev => [saved, ...prev]);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold flex items-center gap-2">
            <MapPin className="w-6 h-6 text-brand-blue" />
            Local SEO & GEO Grid Scanner
          </h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Agent 31 &middot; Scan local search rankings across a geographic grid &middot; LocalFalcon-style visibility analysis
          </p>
        </div>
      </div>

      {/* Scan Input */}
      <div className="bg-surface-raised rounded-xl border border-border p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1">
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder="Marketing Powered LLC"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Target Keyword</label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="digital marketing agency"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1.5">Grid Size</label>
            <select
              value={gridSize}
              onChange={e => setGridSize(parseInt(e.target.value))}
              className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white"
            >
              <option value={5}>5x5 (25 points)</option>
              <option value={7}>7x7 (49 points)</option>
              <option value={9}>9x9 (81 points)</option>
              <option value={11}>11x11 (121 points)</option>
              <option value={13}>13x13 (169 points)</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleScan}
              disabled={scanning || !keyword.trim() || !businessName.trim()}
              className="w-full px-4 py-2.5 bg-brand-blue text-white font-semibold rounded-lg text-[13px] hover:bg-brand-blue-dark disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
            >
              {scanning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Scan Grid
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {scanResult && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-surface-raised rounded-xl border border-border p-4">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Avg Rank</p>
              <p className="text-[28px] font-bold mt-1" style={{ color: getRankColor(Math.round(scanResult.avgRank)) }}>
                {scanResult.avgRank}
              </p>
            </div>
            <div className="bg-surface-raised rounded-xl border border-border p-4">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Best Rank</p>
              <p className="text-[28px] font-bold mt-1 text-brand-green">#{scanResult.topRank}</p>
            </div>
            <div className="bg-surface-raised rounded-xl border border-border p-4">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Top 3 Visibility</p>
              <p className="text-[28px] font-bold mt-1 text-brand-blue">{scanResult.visibility}%</p>
            </div>
            <div className="bg-surface-raised rounded-xl border border-border p-4">
              <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">Grid Points</p>
              <p className="text-[28px] font-bold mt-1">{scanResult.points.length}</p>
              <p className="text-[10px] text-text-muted">{scanResult.points.filter(p => p.rank !== null).length} ranking</p>
            </div>
          </div>

          {/* GEO Grid + Legend */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-6">
            {/* Grid Map */}
            <div className="lg:col-span-3 bg-surface-raised rounded-xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[14px] font-semibold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-blue" />
                  GEO Rank Grid: &ldquo;{scanResult.keyword}&rdquo;
                </h3>
                <div className="flex items-center gap-2">
                  <div className="flex bg-gray-100 rounded-lg p-0.5">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${viewMode === "grid" ? "bg-white text-text-primary shadow-sm" : "text-text-muted"}`}
                    >
                      Grid
                    </button>
                    <button
                      onClick={() => setViewMode("heatmap")}
                      className={`px-3 py-1 rounded-md text-[11px] font-medium transition-colors ${viewMode === "heatmap" ? "bg-white text-text-primary shadow-sm" : "text-text-muted"}`}
                    >
                      Heatmap
                    </button>
                  </div>
                  <span className="text-[11px] text-text-muted">
                    {new Date(scanResult.scanDate).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Grid View */}
              {viewMode === "grid" && (
                <div className="flex justify-center">
                  <div
                    className="grid gap-1"
                    style={{
                      gridTemplateColumns: `repeat(${scanResult.gridSize}, minmax(0, 1fr))`,
                      maxWidth: `${Math.min(scanResult.gridSize * 52, 600)}px`,
                    }}
                  >
                    {scanResult.points.map((point, idx) => {
                      const isCenter = point.row === Math.floor(scanResult.gridSize / 2) && point.col === Math.floor(scanResult.gridSize / 2);
                      return (
                        <div
                          key={idx}
                          className={`w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center text-[11px] md:text-[13px] font-bold text-white cursor-pointer transition-all hover:scale-110 hover:shadow-lg ${getRankBg(point.rank)} ${isCenter ? "ring-2 ring-white ring-offset-2 ring-offset-surface-raised" : ""}`}
                          onMouseEnter={() => setHoveredPoint(point)}
                          onMouseLeave={() => setHoveredPoint(null)}
                          title={`Row ${point.row + 1}, Col ${point.col + 1}: ${point.rank ? `Rank #${point.rank}` : "Not ranking"}`}
                        >
                          {point.rank || "—"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Heatmap View */}
              {viewMode === "heatmap" && (
                <div className="flex justify-center">
                  <div
                    className="grid gap-0 rounded-xl overflow-hidden"
                    style={{
                      gridTemplateColumns: `repeat(${scanResult.gridSize}, minmax(0, 1fr))`,
                      maxWidth: `${Math.min(scanResult.gridSize * 52, 600)}px`,
                    }}
                  >
                    {scanResult.points.map((point, idx) => {
                      const isCenter = point.row === Math.floor(scanResult.gridSize / 2) && point.col === Math.floor(scanResult.gridSize / 2);
                      // Heatmap: interpolated color based on rank
                      let opacity: number;
                      let hue: number;
                      if (point.rank === null) {
                        opacity = 0.9;
                        hue = 0;
                      } else if (point.rank <= 3) {
                        opacity = 0.85;
                        hue = 140; // green
                      } else if (point.rank <= 10) {
                        opacity = 0.75;
                        hue = 60 - (point.rank - 3) * 5; // yellow to orange
                      } else {
                        opacity = 0.7;
                        hue = 0; // red
                      }
                      const saturation = point.rank === null ? 0 : 80;
                      const lightness = point.rank === null ? 25 : 45;

                      return (
                        <div
                          key={idx}
                          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-[10px] md:text-[12px] font-bold cursor-pointer transition-all hover:scale-105 relative"
                          style={{
                            backgroundColor: `hsla(${hue}, ${saturation}%, ${lightness}%, ${opacity})`,
                            color: point.rank === null ? "#555" : "#fff",
                          }}
                          onMouseEnter={() => setHoveredPoint(point)}
                          onMouseLeave={() => setHoveredPoint(null)}
                          title={`${point.rank ? `#${point.rank}` : "N/R"}`}
                        >
                          {isCenter && (
                            <div className="absolute inset-0 border-2 border-white/50 rounded-sm pointer-events-none" />
                          )}
                          {point.rank || "—"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hovered point info */}
              {hoveredPoint && (
                <div className="mt-4 text-center text-[12px] text-text-secondary">
                  Grid position ({hoveredPoint.row + 1}, {hoveredPoint.col + 1}) &middot;{" "}
                  {hoveredPoint.rank ? (
                    <span className="font-semibold" style={{ color: getRankColor(hoveredPoint.rank) }}>
                      Rank #{hoveredPoint.rank}
                    </span>
                  ) : (
                    <span className="text-text-muted">Not ranking in top 20</span>
                  )}
                  {" "}&middot; {hoveredPoint.lat.toFixed(4)}, {hoveredPoint.lng.toFixed(4)}
                </div>
              )}
            </div>

            {/* Legend + Stats */}
            <div className="space-y-4">
              {/* Color Legend */}
              <div className="bg-surface-raised rounded-xl border border-border p-4">
                <h4 className="text-[12px] font-semibold mb-3">Rank Legend</h4>
                <div className="space-y-2">
                  {[
                    { label: "#1", color: "#08AE67", bg: "bg-brand-green" },
                    { label: "#2-3", color: "#2CACE8", bg: "bg-brand-blue" },
                    { label: "#4-5", color: "#F59E0B", bg: "bg-yellow-500" },
                    { label: "#6-10", color: "#F97316", bg: "bg-orange-500" },
                    { label: "#11-20", color: "#EF4444", bg: "bg-red-500" },
                    { label: "Not ranking", color: "#374151", bg: "bg-gray-800" },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded ${item.bg}`} />
                      <span className="text-[11px] text-text-secondary">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rank Distribution */}
              <div className="bg-surface-raised rounded-xl border border-border p-4">
                <h4 className="text-[12px] font-semibold mb-3">Distribution</h4>
                {[
                  { label: "#1", count: scanResult.points.filter(p => p.rank === 1).length },
                  { label: "Top 3", count: scanResult.points.filter(p => p.rank && p.rank <= 3).length },
                  { label: "Top 10", count: scanResult.points.filter(p => p.rank && p.rank <= 10).length },
                  { label: "Top 20", count: scanResult.points.filter(p => p.rank && p.rank <= 20).length },
                  { label: "Not ranking", count: scanResult.points.filter(p => !p.rank).length },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between py-1.5">
                    <span className="text-[11px] text-text-secondary">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-blue rounded-full"
                          style={{ width: `${(item.count / scanResult.points.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold w-6 text-right">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="bg-surface-raised rounded-xl border border-border p-4">
                <h4 className="text-[12px] font-semibold mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <button className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium text-brand-blue bg-brand-blue/5 hover:bg-brand-blue/10 transition-colors flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5" /> Audit GBP Listing
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium text-brand-green bg-brand-green/5 hover:bg-brand-green/10 transition-colors flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5" /> Check Citations
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium text-[#8B5CF6] bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/10 transition-colors flex items-center gap-2">
                    <Star className="w-3.5 h-3.5" /> Review Generation
                  </button>
                  <button className="w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium text-[#F59E0B] bg-[#F59E0B]/5 hover:bg-[#F59E0B]/10 transition-colors flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5" /> Competitor Scan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!scanResult && !scanning && history.length === 0 && (
        <div className="bg-surface-raised rounded-xl border border-border p-12 text-center">
          <MapPin className="w-12 h-12 text-brand-blue/20 mx-auto mb-4" />
          <h3 className="text-[16px] font-semibold mb-2">GEO Grid Rank Scanner</h3>
          <p className="text-[13px] text-text-muted max-w-md mx-auto mb-6">
            Enter your business name and target keyword to scan local search rankings across a geographic grid.
            See exactly where you rank at every point in your service area — just like LocalFalcon.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            {["digital marketing agency", "addiction treatment center", "personal injury lawyer", "dentist near me", "behavioral health clinic"].map(kw => (
              <button
                key={kw}
                onClick={() => setKeyword(kw)}
                className="px-3 py-1.5 rounded-full bg-brand-blue/5 text-brand-blue text-[11px] font-medium hover:bg-brand-blue/10 transition-colors"
              >
                {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Scan History ── */}
      {history.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] md:text-[16px] font-semibold flex items-center gap-2">
              <History className="w-4 h-4 text-brand-blue" />
              Scan History
            </h2>
            <span className="text-[11px] text-text-muted">{history.length} scans saved</span>
          </div>

          {/* Trend Chart (if 2+ scans for same keyword) */}
          {(() => {
            const keywordScans = scanResult
              ? history.filter(s => s.keyword === scanResult.keyword).reverse()
              : [];
            if (keywordScans.length >= 2) {
              return (
                <div className="bg-surface-raised rounded-xl border border-border p-5 mb-4">
                  <h3 className="text-[13px] font-semibold mb-3">
                    Trend: &ldquo;{scanResult!.keyword}&rdquo; over {keywordScans.length} scans
                  </h3>
                  <div className="flex items-end gap-1 h-[80px]">
                    {keywordScans.map((scan, i) => {
                      const maxVis = Math.max(...keywordScans.map(s => s.visibility), 1);
                      const height = (scan.visibility / maxVis) * 100;
                      const isLatest = i === keywordScans.length - 1;
                      return (
                        <div key={scan.id} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] font-semibold" style={{ color: isLatest ? "#2CACE8" : "#9ca3af" }}>
                            {scan.visibility}%
                          </span>
                          <div
                            className="w-full rounded-t transition-all"
                            style={{
                              height: `${Math.max(height, 5)}%`,
                              backgroundColor: isLatest ? "#2CACE8" : "#e5e7eb",
                            }}
                          />
                          <span className="text-[8px] text-text-muted">
                            {new Date(scan.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-text-muted">
                    <span>Top 3 Visibility %</span>
                    {keywordScans.length >= 2 && (() => {
                      const first = keywordScans[0].visibility;
                      const last = keywordScans[keywordScans.length - 1].visibility;
                      const diff = last - first;
                      return (
                        <span className={`font-semibold flex items-center gap-0.5 ${diff > 0 ? "text-brand-green" : diff < 0 ? "text-red-500" : "text-text-muted"}`}>
                          {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : diff < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
                          {diff > 0 ? "+" : ""}{diff}% overall
                        </span>
                      );
                    })()}
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* History Table */}
          <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-gray-50/50">
                    <th className="text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider px-4 py-2.5">Date</th>
                    <th className="text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider px-4 py-2.5">Keyword</th>
                    <th className="text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider px-4 py-2.5">Business</th>
                    <th className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider px-4 py-2.5">Grid</th>
                    <th className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider px-4 py-2.5">Avg Rank</th>
                    <th className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider px-4 py-2.5">Best</th>
                    <th className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider px-4 py-2.5">Visibility</th>
                    <th className="text-center text-[10px] font-semibold text-text-muted uppercase tracking-wider px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((scan) => (
                    <tr key={scan.id} className="border-b border-border last:border-0 hover:bg-gray-50/30 transition-colors">
                      <td className="px-4 py-2.5 text-[12px] text-text-secondary">
                        {new Date(scan.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] font-medium">{scan.keyword}</td>
                      <td className="px-4 py-2.5 text-[12px] text-text-secondary">{scan.business_name}</td>
                      <td className="px-4 py-2.5 text-[12px] text-center text-text-muted">{scan.grid_size}x{scan.grid_size}</td>
                      <td className="px-4 py-2.5 text-[12px] text-center font-semibold">{scan.avg_rank}</td>
                      <td className="px-4 py-2.5 text-[12px] text-center font-semibold text-brand-green">#{scan.top_rank}</td>
                      <td className="px-4 py-2.5 text-[12px] text-center">
                        <span className={`font-semibold ${scan.visibility >= 50 ? "text-brand-green" : scan.visibility >= 25 ? "text-brand-blue" : "text-[#F59E0B]"}`}>
                          {scan.visibility}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setScanResult({
                                keyword: scan.keyword,
                                businessName: scan.business_name,
                                gridSize: scan.grid_size,
                                points: scan.points,
                                avgRank: scan.avg_rank,
                                topRank: scan.top_rank,
                                visibility: scan.visibility,
                                scanDate: scan.created_at,
                              });
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="px-2 py-1 rounded text-[10px] font-medium text-brand-blue bg-brand-blue/5 hover:bg-brand-blue/10 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={async () => {
                              await deleteScan(scan.id);
                              setHistory(prev => prev.filter(s => s.id !== scan.id));
                            }}
                            className="p-1 rounded text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
