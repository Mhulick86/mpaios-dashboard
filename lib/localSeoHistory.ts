/**
 * Local SEO Scan History - Supabase persistence
 */

import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export interface ScanRecord {
  id: string;
  business_name: string;
  keyword: string;
  grid_size: number;
  center_lat: number | null;
  center_lng: number | null;
  avg_rank: number;
  top_rank: number;
  visibility: number;
  total_points: number;
  ranking_points: number;
  points: { row: number; col: number; rank: number | null; lat: number; lng: number }[];
  created_at: string;
}

export async function saveScan(params: {
  businessName: string;
  keyword: string;
  gridSize: number;
  centerLat?: number;
  centerLng?: number;
  avgRank: number;
  topRank: number;
  visibility: number;
  totalPoints: number;
  rankingPoints: number;
  points: { row: number; col: number; rank: number | null; lat: number; lng: number }[];
}): Promise<ScanRecord | null> {
  const { data, error } = await supabase
    .from("local_seo_scans")
    .insert({
      business_name: params.businessName,
      keyword: params.keyword,
      grid_size: params.gridSize,
      center_lat: params.centerLat,
      center_lng: params.centerLng,
      avg_rank: params.avgRank,
      top_rank: params.topRank,
      visibility: params.visibility,
      total_points: params.totalPoints,
      ranking_points: params.rankingPoints,
      points: params.points,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to save scan:", error);
    return null;
  }
  return data;
}

export async function getScanHistory(params?: {
  keyword?: string;
  businessName?: string;
  limit?: number;
}): Promise<ScanRecord[]> {
  let query = supabase
    .from("local_seo_scans")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 50);

  if (params?.keyword) query = query.eq("keyword", params.keyword);
  if (params?.businessName) query = query.eq("business_name", params.businessName);

  const { data } = await query;
  return (data || []) as ScanRecord[];
}

export async function getScan(id: string): Promise<ScanRecord | null> {
  const { data } = await supabase
    .from("local_seo_scans")
    .select("*")
    .eq("id", id)
    .single();
  return data as ScanRecord | null;
}

export async function deleteScan(id: string): Promise<boolean> {
  const { error } = await supabase.from("local_seo_scans").delete().eq("id", id);
  return !error;
}

// Compare two scans and compute rank changes at each grid point
export function compareScanPoints(
  oldScan: ScanRecord,
  newScan: ScanRecord
): { row: number; col: number; oldRank: number | null; newRank: number | null; change: number | null }[] {
  return newScan.points.map((newPt) => {
    const oldPt = oldScan.points.find(p => p.row === newPt.row && p.col === newPt.col);
    const oldRank = oldPt?.rank ?? null;
    const newRank = newPt.rank;
    let change: number | null = null;
    if (oldRank !== null && newRank !== null) {
      change = oldRank - newRank; // positive = improved
    } else if (oldRank === null && newRank !== null) {
      change = newRank; // newly ranking
    } else if (oldRank !== null && newRank === null) {
      change = -oldRank; // lost ranking
    }
    return { row: newPt.row, col: newPt.col, oldRank, newRank, change };
  });
}
