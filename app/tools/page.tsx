import { tools, statusLabels } from "@/lib/tools";
import {
  Rocket,
  Target,
  Search,
  Heart,
  Database,
  Film,
  MapPin,
  Wrench,
  ArrowRight,
  Cpu,
  CheckCircle2,
  Clock,
  Code2,
  Play,
  Calendar,
} from "lucide-react";
import Link from "next/link";

const iconMap: Record<string, React.ElementType> = {
  rocket: Rocket,
  target: Target,
  search: Search,
  heart: Heart,
  database: Database,
  film: Film,
  "map-pin": MapPin,
};

const statusIcon: Record<string, React.ElementType> = {
  active: CheckCircle2,
  beta: Clock,
  development: Code2,
};

export default function ToolsPage() {
  const activeCount = tools.filter((t) => t.status === "active").length;
  const betaCount = tools.filter((t) => t.status === "beta").length;
  const devCount = tools.filter((t) => t.status === "development").length;

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8 gap-3">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold">
            Automation Tools
          </h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            {tools.length} blueprints &middot; {activeCount} active &middot;{" "}
            {betaCount} beta &middot; {devCount} in development
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-raised border border-border text-[12px] font-medium">
            <Wrench className="w-4 h-4 text-brand-blue" />
            <span>{tools.length} Tools</span>
          </div>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        {(
          [
            {
              label: "Active",
              count: activeCount,
              color: "#08AE67",
              icon: CheckCircle2,
            },
            {
              label: "Beta",
              count: betaCount,
              color: "#F59E0B",
              icon: Clock,
            },
            {
              label: "In Development",
              count: devCount,
              color: "#6B7280",
              icon: Code2,
            },
          ] as const
        ).map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-surface-raised rounded-xl border border-border p-4 md:p-5"
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon
                  className="w-4 h-4"
                  style={{ color: s.color }}
                />
                <span className="text-[11px] text-text-muted uppercase tracking-wide">
                  {s.label}
                </span>
              </div>
              <div className="text-[24px] font-semibold">{s.count}</div>
            </div>
          );
        })}
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {tools.map((tool) => {
          const Icon = iconMap[tool.icon] || Cpu;
          const status = statusLabels[tool.status];
          const StatusIcon = statusIcon[tool.status] || CheckCircle2;

          return (
            <Link
              key={tool.id}
              href={`/tools/${tool.id}`}
              className="bg-surface-raised rounded-xl border border-border p-5 md:p-6 hover:border-brand-blue/30 hover:shadow-sm transition-all group block"
            >
              {/* Top row: icon + name + blueprint badge + status */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${tool.color}15` }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: tool.color }}
                    />
                  </div>
                  <div>
                    <h3 className="text-[14px] md:text-[15px] font-semibold leading-tight group-hover:text-brand-blue transition-colors">
                      {tool.name}
                    </h3>
                    <span className="text-[10px] text-text-muted font-medium tracking-wide">
                      BLUEPRINT {tool.blueprint}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusIcon
                    className="w-3 h-3"
                    style={{ color: status.color }}
                  />
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: status.color }}
                  >
                    {status.label}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-[12px] md:text-[13px] text-text-secondary leading-relaxed mb-4">
                {tool.description}
              </p>

              {/* Tech stack pills */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {tool.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-0.5 rounded-md bg-gray-50 border border-border text-[10px] text-text-muted font-medium"
                  >
                    {tech}
                  </span>
                ))}
              </div>

              {/* Bottom row: metrics + schedule + action hint */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-4">
                  {tool.metrics?.map((m) => (
                    <div key={m.label}>
                      <div className="text-[10px] text-text-muted uppercase tracking-wide">
                        {m.label}
                      </div>
                      <div className="text-[16px] font-semibold">{m.value}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {tool.schedule && (
                    <span className="hidden sm:flex items-center gap-1 text-[11px] text-text-muted">
                      <Calendar className="w-3 h-3" />
                      {tool.schedule}
                    </span>
                  )}
                  <div className="flex items-center gap-1 text-[12px] text-brand-blue font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Open
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
