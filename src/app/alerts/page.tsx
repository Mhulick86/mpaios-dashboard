"use client";

import { useState } from "react";
import { systemAlerts, type Alert } from "@/lib/metrics";
import { AlertItem } from "@/components/AlertItem";
import { Bell, Filter } from "lucide-react";

type FilterType = "all" | "success" | "warning" | "critical" | "info";

export default function AlertsPage() {
  const [filter, setFilter] = useState<FilterType>("all");

  const filters: { id: FilterType; label: string; color: string }[] = [
    { id: "all", label: "All", color: "#6B7280" },
    { id: "critical", label: "Critical", color: "#EF4444" },
    { id: "warning", label: "Warning", color: "#F59E0B" },
    { id: "success", label: "Success", color: "#08AE67" },
    { id: "info", label: "Info", color: "#2CACE8" },
  ];

  const filteredAlerts =
    filter === "all"
      ? systemAlerts
      : systemAlerts.filter((a) => a.type === filter);

  const unreadCount = systemAlerts.filter((a) => !a.read).length;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold">
            Alerts & Notifications
          </h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            Agent insights, system alerts, and performance notifications
          </p>
        </div>
        {unreadCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-blue/10 text-brand-blue text-[12px] font-medium">
            <Bell className="w-4 h-4" />
            {unreadCount} unread
          </div>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
              filter === f.id
                ? "text-white"
                : "bg-surface-raised border border-border text-text-secondary hover:text-text-primary"
            }`}
            style={
              filter === f.id ? { backgroundColor: f.color } : undefined
            }
          >
            {f.id !== "all" && (
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: filter === f.id ? "#fff" : f.color,
                }}
              />
            )}
            {f.label}
            <span className="opacity-60">
              {f.id === "all"
                ? systemAlerts.length
                : systemAlerts.filter((a) => a.type === f.id).length}
            </span>
          </button>
        ))}
      </div>

      {/* Alert List */}
      <div className="space-y-3">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))
        ) : (
          <div className="bg-surface-raised rounded-xl border border-border p-8 text-center">
            <Filter className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-[13px] text-text-muted">
              No alerts matching this filter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
