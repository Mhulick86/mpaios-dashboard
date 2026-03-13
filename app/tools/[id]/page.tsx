"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  tools,
  statusLabels,
  toolCategories,
  type Tool,
  type ToolConfigField,
  type ToolRunLog,
} from "@/lib/tools";
import {
  Rocket,
  Target,
  Search,
  Heart,
  Database,
  Film,
  MapPin,
  Cpu,
  ArrowLeft,
  Play,
  Square,
  Settings2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Calendar,
  Zap,
  Code2,
  RotateCcw,
  Download,
  ExternalLink,
  Activity,
  FileText,
  Image,
  Video,
  Globe,
  Copy,
  Eye,
  Package,
} from "lucide-react";

interface OutputArtifact {
  id: string;
  label: string;
  type: "file" | "link" | "preview" | "code";
  icon: "file" | "image" | "video" | "globe" | "code" | "package";
  filename?: string;
  size?: string;
  url?: string;
  previewContent?: string;
  downloadContent?: string;
  mimeType?: string;
}

const outputIconMap: Record<string, React.ElementType> = {
  file: FileText,
  image: Image,
  video: Video,
  globe: Globe,
  code: Code2,
  package: Package,
};

const iconMap: Record<string, React.ElementType> = {
  rocket: Rocket,
  target: Target,
  search: Search,
  heart: Heart,
  database: Database,
  film: Film,
  "map-pin": MapPin,
};

const statusIconMap: Record<string, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  running: Loader2,
  queued: Clock,
};

const statusColorMap: Record<string, string> = {
  success: "#08AE67",
  error: "#EF4444",
  running: "#2CACE8",
  queued: "#F59E0B",
};

function ConfigFieldInput({
  field,
  value,
  onChange,
}: {
  field: ToolConfigField;
  value: string | number | boolean;
  onChange: (val: string | number | boolean) => void;
}) {
  switch (field.type) {
    case "text":
    case "url":
      return (
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <input
            type={field.type === "url" ? "url" : "text"}
            placeholder={field.placeholder}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/20"
          />
          {field.helpText && (
            <p className="text-[11px] text-text-muted mt-1">{field.helpText}</p>
          )}
        </div>
      );
    case "number":
      return (
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <input
            type="number"
            placeholder={field.placeholder}
            value={value as number}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/20"
          />
          {field.helpText && (
            <p className="text-[11px] text-text-muted mt-1">{field.helpText}</p>
          )}
        </div>
      );
    case "textarea":
      return (
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {field.label}
            {field.required && <span className="text-red-400 ml-0.5">*</span>}
          </label>
          <textarea
            placeholder={field.placeholder}
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/20 resize-none"
          />
          {field.helpText && (
            <p className="text-[11px] text-text-muted mt-1">{field.helpText}</p>
          )}
        </div>
      );
    case "select":
      return (
        <div>
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {field.label}
          </label>
          <select
            value={value as string}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50 focus:ring-1 focus:ring-brand-blue/20 appearance-none"
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {field.helpText && (
            <p className="text-[11px] text-text-muted mt-1">{field.helpText}</p>
          )}
        </div>
      );
    case "toggle":
      return (
        <div className="flex items-center justify-between py-1">
          <div>
            <label className="block text-[12px] font-medium text-text-secondary">
              {field.label}
            </label>
            {field.helpText && (
              <p className="text-[11px] text-text-muted mt-0.5">
                {field.helpText}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(!(value as boolean))}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? "bg-brand-blue" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                value ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      );
    default:
      return null;
  }
}

export default function ToolDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tool, setTool] = useState<Tool | null>(null);
  const [config, setConfig] = useState<Record<string, string | number | boolean>>({});
  const [activeTab, setActiveTab] = useState<"config" | "logs" | "schedule" | "output">("config");
  const [isRunning, setIsRunning] = useState(false);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<ToolRunLog[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [outputArtifacts, setOutputArtifacts] = useState<OutputArtifact[]>([]);
  const [previewArtifact, setPreviewArtifact] = useState<OutputArtifact | null>(null);

  useEffect(() => {
    const found = tools.find((t) => t.id === params.id);
    if (found) {
      setTool(found);
      setRunLogs(found.runLogs);
      // Initialize config from defaults
      const defaults: Record<string, string | number | boolean> = {};
      found.configFields.forEach((f) => {
        if (f.defaultValue !== undefined) {
          defaults[f.id] = f.defaultValue;
        } else {
          defaults[f.id] = f.type === "toggle" ? false : f.type === "number" ? 0 : "";
        }
      });
      setConfig(defaults);
    }
  }, [params.id]);

  if (!tool) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-text-muted mx-auto mb-3" />
          <p className="text-[14px] text-text-muted">Tool not found</p>
          <Link
            href="/tools"
            className="text-[13px] text-brand-blue hover:underline mt-2 inline-block"
          >
            Back to Tools
          </Link>
        </div>
      </div>
    );
  }

  const Icon = iconMap[tool.icon] || Cpu;
  const status = statusLabels[tool.status];
  const category = toolCategories[tool.category];

  // Tool-specific output artifacts
  const getOutputArtifacts = (toolId: string): OutputArtifact[] => {
    const outputs: Record<string, OutputArtifact[]> = {
      "vibe-marketing-funnel": [
        { id: "lp-a", label: "Landing Page — Modern Minimal", type: "file", icon: "globe", filename: "lp-variant-a-modern-minimal.html", size: "14 KB", previewContent: "<!DOCTYPE html>\n<html>\n<head><title>LP Variant A</title></head>\n<body>\n  <header class=\"hero\">\n    <h1>Transform Your Mental Health Practice</h1>\n    <p>Join 2,400+ providers who streamlined intake</p>\n    <a href=\"#\" class=\"cta-btn\">Get Started Free</a>\n  </header>\n  <!-- 12 sections, 1,420 words -->\n</body>\n</html>", downloadContent: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Transform Your Mental Health Practice | StreamIntake</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body { font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a2e; }\n    .hero { text-align: center; padding: 80px 24px; background: linear-gradient(135deg, #f0f4ff 0%, #e8f4f8 100%); }\n    .hero h1 { font-size: 42px; font-weight: 700; max-width: 640px; margin: 0 auto 16px; line-height: 1.2; }\n    .hero p { font-size: 18px; color: #64748b; margin-bottom: 32px; }\n    .cta-btn { display: inline-block; padding: 14px 32px; background: #2563eb; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; }\n    .cta-btn:hover { background: #1d4ed8; }\n    .stats { display: flex; justify-content: center; gap: 48px; padding: 48px 24px; }\n    .stat { text-align: center; }\n    .stat-value { font-size: 36px; font-weight: 700; color: #2563eb; }\n    .stat-label { font-size: 14px; color: #64748b; margin-top: 4px; }\n    .features { padding: 64px 24px; max-width: 960px; margin: 0 auto; }\n    .features h2 { text-align: center; font-size: 28px; margin-bottom: 40px; }\n    .feature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; }\n    .feature-card { padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0; }\n    .feature-card h3 { font-size: 16px; margin-bottom: 8px; }\n    .feature-card p { font-size: 14px; color: #64748b; line-height: 1.6; }\n    .testimonial { padding: 64px 24px; background: #f8fafc; text-align: center; }\n    .testimonial blockquote { font-size: 20px; font-style: italic; max-width: 640px; margin: 0 auto 16px; line-height: 1.6; }\n    .testimonial cite { font-size: 14px; color: #64748b; }\n    .cta-section { padding: 64px 24px; text-align: center; background: #1a1a2e; color: #fff; }\n    .cta-section h2 { font-size: 28px; margin-bottom: 16px; }\n    .cta-section p { color: #94a3b8; margin-bottom: 32px; }\n    footer { padding: 32px 24px; text-align: center; font-size: 12px; color: #94a3b8; }\n  </style>\n</head>\n<body>\n  <header class=\"hero\">\n    <h1>Transform Your Mental Health Practice</h1>\n    <p>Join 2,400+ providers who streamlined patient intake and increased bookings by 34%</p>\n    <a href=\"#\" class=\"cta-btn\">Get Started Free →</a>\n  </header>\n  <section class=\"stats\">\n    <div class=\"stat\"><div class=\"stat-value\">2,400+</div><div class=\"stat-label\">Active Providers</div></div>\n    <div class=\"stat\"><div class=\"stat-value\">34%</div><div class=\"stat-label\">Avg Booking Increase</div></div>\n    <div class=\"stat\"><div class=\"stat-value\">68%</div><div class=\"stat-label\">Faster Intake</div></div>\n  </section>\n  <section class=\"features\">\n    <h2>Everything You Need to Grow</h2>\n    <div class=\"feature-grid\">\n      <div class=\"feature-card\"><h3>Digital Intake Forms</h3><p>HIPAA-compliant forms that patients complete before their first visit. Eliminates paper and reduces no-shows.</p></div>\n      <div class=\"feature-card\"><h3>Insurance Verification</h3><p>Instant eligibility checks across 1,200+ payers. Know coverage before the patient walks in.</p></div>\n      <div class=\"feature-card\"><h3>Online Booking</h3><p>Let patients book directly from your website, Google, or social profiles — 24/7 availability.</p></div>\n    </div>\n  </section>\n  <section class=\"testimonial\">\n    <blockquote>\"We cut our intake process from 45 minutes to 12 minutes. Patients love it and our front desk team finally has breathing room.\"</blockquote>\n    <cite>— Dr. Sarah Chen, Serenity Wellness Center, Dallas TX</cite>\n  </section>\n  <section class=\"cta-section\">\n    <h2>Ready to Streamline Your Practice?</h2>\n    <p>Start your free 14-day trial — no credit card required</p>\n    <a href=\"#\" class=\"cta-btn\">Start Free Trial</a>\n  </section>\n  <footer>© 2026 StreamIntake. All rights reserved. | HIPAA Compliant | SOC 2 Certified</footer>\n</body>\n</html>" },
        { id: "lp-b", label: "Landing Page — Healthcare Trust", type: "file", icon: "globe", filename: "lp-variant-b-healthcare-trust.html", size: "12 KB", previewContent: "<!DOCTYPE html>\n<html>\n<head><title>LP Variant B</title></head>\n<body>\n  <header class=\"hero trust-layout\">\n    <h1>HIPAA-Compliant Patient Intake</h1>\n    <p>Trusted by 500+ behavioral health clinics</p>\n    <a href=\"#\" class=\"cta-btn\">Book a Demo</a>\n  </header>\n  <!-- 8 sections, 1,180 words -->\n</body>\n</html>", downloadContent: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>HIPAA-Compliant Patient Intake | StreamIntake</title>\n  <style>\n    * { margin: 0; padding: 0; box-sizing: border-box; }\n    body { font-family: 'DM Sans', system-ui, sans-serif; color: #1a1a2e; }\n    .hero { display: flex; align-items: center; min-height: 80vh; padding: 64px; background: #f0f4ff; gap: 64px; }\n    .hero-text { flex: 1; }\n    .hero-text h1 { font-size: 38px; font-weight: 700; line-height: 1.2; margin-bottom: 16px; }\n    .hero-text p { font-size: 16px; color: #64748b; margin-bottom: 24px; line-height: 1.6; }\n    .trust-badges { display: flex; gap: 24px; margin-bottom: 32px; }\n    .badge { padding: 8px 16px; background: #fff; border-radius: 8px; font-size: 12px; font-weight: 600; border: 1px solid #e2e8f0; }\n    .cta-btn { display: inline-block; padding: 14px 28px; background: #059669; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 600; }\n    .hero-visual { flex: 1; background: #e2e8f0; border-radius: 16px; height: 400px; display: flex; align-items: center; justify-content: center; color: #94a3b8; }\n    .compliance { padding: 48px; text-align: center; background: #fff; }\n    .compliance h2 { margin-bottom: 32px; }\n    .compliance-grid { display: flex; justify-content: center; gap: 48px; }\n    .compliance-item { text-align: center; }\n    .compliance-icon { font-size: 32px; margin-bottom: 8px; }\n    footer { padding: 32px; text-align: center; font-size: 12px; color: #94a3b8; }\n  </style>\n</head>\n<body>\n  <section class=\"hero\">\n    <div class=\"hero-text\">\n      <div class=\"trust-badges\">\n        <span class=\"badge\">🔒 HIPAA Compliant</span>\n        <span class=\"badge\">✓ SOC 2 Type II</span>\n        <span class=\"badge\">🏥 500+ Clinics</span>\n      </div>\n      <h1>HIPAA-Compliant Patient Intake That Patients Actually Complete</h1>\n      <p>Trusted by 500+ behavioral health clinics. Reduce intake time by 68%, increase completed bookings by 34%, and eliminate paper forms forever.</p>\n      <a href=\"#\" class=\"cta-btn\">Book a Demo →</a>\n    </div>\n    <div class=\"hero-visual\">[Product Screenshot]</div>\n  </section>\n  <section class=\"compliance\">\n    <h2>Enterprise-Grade Security & Compliance</h2>\n    <div class=\"compliance-grid\">\n      <div class=\"compliance-item\"><div class=\"compliance-icon\">🔒</div><strong>HIPAA</strong><p>BAA included</p></div>\n      <div class=\"compliance-item\"><div class=\"compliance-icon\">🛡️</div><strong>SOC 2</strong><p>Type II certified</p></div>\n      <div class=\"compliance-item\"><div class=\"compliance-icon\">🔐</div><strong>AES-256</strong><p>End-to-end encryption</p></div>\n      <div class=\"compliance-item\"><div class=\"compliance-icon\">📋</div><strong>HITRUST</strong><p>CSF certified</p></div>\n    </div>\n  </section>\n  <footer>© 2026 StreamIntake | HIPAA Compliant | SOC 2 Type II | info@streamintake.com</footer>\n</body>\n</html>" },
        { id: "vid-1", label: "Remotion Video — 9:16 (Stories/Reels)", type: "file", icon: "video", filename: "funnel-video-9x16.html", size: "6.8 KB", mimeType: "text/html", downloadContent: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Funnel Video 9:16 — Marketing Powered</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;overflow:hidden}.phone{width:360px;height:640px;border-radius:32px;overflow:hidden;position:relative;background:linear-gradient(135deg,#667eea 0%,#764ba2 50%,#f093fb 100%);background-size:200% 200%;animation:gradShift 15s ease infinite}.slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 28px;text-align:center;opacity:0;animation-fill-mode:forwards;color:#fff}.s1{animation:fadeSlide 3s ease 0s forwards}.s2{animation:fadeSlide 4s ease 3s forwards}.s3{animation:fadeSlide 4s ease 7s forwards}.s4{animation:fadeSlide 4s ease 11s forwards}.slide h1{font-size:28px;font-weight:700;line-height:1.3;margin-bottom:16px;text-shadow:0 2px 12px rgba(0,0,0,.3)}.slide p{font-size:16px;opacity:.9;line-height:1.5;text-shadow:0 1px 8px rgba(0,0,0,.2)}.stat{font-size:56px;font-weight:800;margin-bottom:8px;text-shadow:0 2px 16px rgba(0,0,0,.3)}.stat-row{display:flex;gap:32px;margin-bottom:16px}.stat-item{text-align:center}.stat-val{font-size:42px;font-weight:800}.stat-lbl{font-size:13px;opacity:.8;margin-top:4px}.cta-btn{display:inline-block;padding:16px 36px;background:#fff;color:#764ba2;border-radius:12px;font-weight:700;font-size:18px;margin-top:20px;box-shadow:0 4px 24px rgba(0,0,0,.2)}.progress{position:absolute;bottom:0;left:0;height:3px;background:rgba(255,255,255,.8);animation:prog 15s linear forwards}@keyframes gradShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}@keyframes fadeSlide{0%{opacity:0;transform:translateY(30px)}12%{opacity:1;transform:translateY(0)}88%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-20px)}}@keyframes prog{from{width:0}to{width:100%}}</style></head><body><div class="phone"><div class="slide s1"><h1>Your intake process is losing patients</h1><p>42% of patients abandon paper forms before booking</p></div><div class="slide s2"><div class="stat-row"><div class="stat-item"><div class="stat-val">68%</div><div class="stat-lbl">Faster Intake</div></div><div class="stat-item"><div class="stat-val">34%</div><div class="stat-lbl">More Bookings</div></div></div><p>Digital forms + auto-verification = results</p></div><div class="slide s3"><h1>Digital Form → Auto-Verify → Booked</h1><p>Patients complete intake in under 7 minutes from any device</p></div><div class="slide s4"><h1>Start Free Today</h1><div class="cta-btn">streamintake.com</div><p style="margin-top:16px;font-size:13px">No credit card required</p></div><div class="progress"></div></div></body></html>` },
        { id: "vid-2", label: "Remotion Video — 1:1 (Feed)", type: "file", icon: "video", filename: "funnel-video-1x1.html", size: "6.2 KB", mimeType: "text/html", downloadContent: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Funnel Video 1:1 — Marketing Powered</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;overflow:hidden}.frame{width:480px;height:480px;border-radius:16px;overflow:hidden;position:relative;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#2563eb 100%);background-size:200% 200%;animation:gradShift 15s ease infinite}.slide{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center;opacity:0;animation-fill-mode:forwards;color:#fff}.s1{animation:fadeSlide 3.5s ease 0s forwards}.s2{animation:fadeSlide 4s ease 3.5s forwards}.s3{animation:fadeSlide 4s ease 7.5s forwards}.s4{animation:fadeSlide 3.5s ease 11.5s forwards}.slide h1{font-size:32px;font-weight:700;line-height:1.2;margin-bottom:12px;text-shadow:0 2px 12px rgba(0,0,0,.4)}.slide p{font-size:15px;opacity:.85;line-height:1.5}.num{font-size:64px;font-weight:800;background:linear-gradient(135deg,#60a5fa,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px}.cta{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;border-radius:12px;font-weight:700;font-size:18px;margin-top:16px;box-shadow:0 4px 20px rgba(37,99,235,.4)}.bar{position:absolute;bottom:0;left:0;height:3px;background:rgba(255,255,255,.7);animation:prog 15s linear forwards}@keyframes gradShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}@keyframes fadeSlide{0%{opacity:0;transform:scale(.92)}10%{opacity:1;transform:scale(1)}90%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.05)}}@keyframes prog{from{width:0}to{width:100%}}</style></head><body><div class="frame"><div class="slide s1"><h1>Stop Losing Patients at Intake</h1><p>The #1 reason patients abandon booking? Clunky paper forms.</p></div><div class="slide s2"><div class="num">2,400+</div><h1>Providers Trust Us</h1><p>Mental health practices across the country</p></div><div class="slide s3"><div class="num">7 min</div><h1>Average Intake Time</h1><p>Down from 22 minutes with paper forms</p></div><div class="slide s4"><h1>Try It Free</h1><div class="cta">Get Started →</div><p style="margin-top:12px;font-size:13px;opacity:.7">14-day trial · No credit card</p></div><div class="bar"></div></div></body></html>` },
        { id: "vid-3", label: "Remotion Video — 16:9 (YouTube)", type: "file", icon: "video", filename: "funnel-video-16x9.html", size: "7.1 KB", mimeType: "text/html", downloadContent: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Funnel Video 16:9 — Marketing Powered</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;overflow:hidden}.widescreen{width:800px;height:450px;border-radius:12px;overflow:hidden;position:relative;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 40%,#0f3460 100%);background-size:200% 200%;animation:gradShift 15s ease infinite}.slide{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:48px;padding:40px 56px;opacity:0;animation-fill-mode:forwards;color:#fff}.s1{animation:fadeSlide 3.5s ease 0s forwards}.s2{animation:fadeSlide 4s ease 3.5s forwards}.s3{animation:fadeSlide 4s ease 7.5s forwards}.s4{animation:fadeSlide 3.5s ease 11.5s forwards}.left{flex:1;text-align:left}.right{flex:1;display:flex;align-items:center;justify-content:center}.slide h1{font-size:34px;font-weight:700;line-height:1.2;margin-bottom:12px}.slide p{font-size:15px;opacity:.8;line-height:1.6}.big-stat{font-size:80px;font-weight:800;background:linear-gradient(135deg,#60a5fa,#34d399);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.stat-box{background:rgba(255,255,255,.08);padding:20px;border-radius:12px;text-align:center}.stat-box .val{font-size:36px;font-weight:800;color:#60a5fa}.stat-box .lbl{font-size:12px;opacity:.7;margin-top:4px}.cta{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#2563eb,#059669);color:#fff;border-radius:10px;font-weight:700;font-size:17px;margin-top:16px;box-shadow:0 4px 20px rgba(5,150,105,.3)}.bar{position:absolute;bottom:0;left:0;height:3px;background:rgba(255,255,255,.6);animation:prog 15s linear forwards}@keyframes gradShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}@keyframes fadeSlide{0%{opacity:0;transform:translateX(-30px)}10%{opacity:1;transform:translateX(0)}88%{opacity:1;transform:translateX(0)}100%{opacity:0;transform:translateX(30px)}}@keyframes prog{from{width:0}to{width:100%}}</style></head><body><div class="widescreen"><div class="slide s1"><div class="left"><h1>Your Intake Process Is Losing Patients</h1><p>42% of prospective patients abandon multi-page paper forms before ever booking an appointment.</p></div><div class="right"><div class="big-stat">42%</div></div></div><div class="slide s2"><div class="left"><h1>The Numbers Don't Lie</h1><p>Practices using StreamIntake see measurable results within 60 days.</p></div><div class="right"><div class="stat-grid"><div class="stat-box"><div class="val">34%</div><div class="lbl">More Bookings</div></div><div class="stat-box"><div class="val">68%</div><div class="lbl">Faster Intake</div></div><div class="stat-box"><div class="val">94%</div><div class="lbl">Completion Rate</div></div><div class="stat-box"><div class="val">4.8★</div><div class="lbl">Patient Rating</div></div></div></div></div><div class="slide s3"><div class="left"><h1>Digital Form → Auto-Verify → Booked</h1><p>Patients complete intake in 7 minutes from any device. Insurance verified instantly.</p></div><div class="right"><div class="big-stat">7min</div></div></div><div class="slide s4" style="flex-direction:column;text-align:center"><h1>Start Your Free Trial Today</h1><p style="margin-bottom:4px">Join 2,400+ mental health providers who streamlined their practice</p><div class="cta">Get Started Free →</div><p style="margin-top:12px;font-size:13px;opacity:.6">No credit card required · HIPAA compliant</p></div><div class="bar"></div></div></body></html>` },
        { id: "analysis", label: "Competitor Analysis Report", type: "file", icon: "file", filename: "competitor-analysis-2026-03-12.json", size: "48 KB", previewContent: "{\n  \"generated\": \"2026-03-12T08:14:22Z\",\n  \"competitors_analyzed\": 3,\n  \"avg_cta_confidence\": 0.92,\n  \"top_patterns\": [\n    \"Trust badges above fold\",\n    \"Social proof counters\",\n    \"Video testimonials\"\n  ]\n}", downloadContent: "{\n  \"meta\": {\n    \"generated\": \"2026-03-12T08:14:22Z\",\n    \"tool\": \"vibe-marketing-funnel\",\n    \"pipeline_version\": \"1.4.2\"\n  },\n  \"competitors\": [\n    {\n      \"url\": \"competitor1.com\",\n      \"sections_detected\": 18,\n      \"cta_confidence\": 0.94,\n      \"layout\": \"hero-stats-features-testimonial-cta\",\n      \"color_palette\": [\"#2563eb\", \"#f0f4ff\", \"#1a1a2e\"],\n      \"trust_signals\": [\"HIPAA badge\", \"SOC2 seal\", \"client count\"],\n      \"word_count\": 1420\n    },\n    {\n      \"url\": \"competitor2.com\",\n      \"sections_detected\": 14,\n      \"cta_confidence\": 0.89,\n      \"layout\": \"split-hero-features-pricing-cta\",\n      \"color_palette\": [\"#059669\", \"#f8fafc\", \"#0f172a\"],\n      \"trust_signals\": [\"client logos\", \"case study link\"],\n      \"word_count\": 980\n    },\n    {\n      \"url\": \"competitor3.com\",\n      \"sections_detected\": 22,\n      \"cta_confidence\": 0.91,\n      \"layout\": \"video-hero-benefits-social-proof-faq-cta\",\n      \"color_palette\": [\"#7c3aed\", \"#faf5ff\", \"#1e1b4b\"],\n      \"trust_signals\": [\"video testimonial\", \"rating badge\", \"press logos\"],\n      \"word_count\": 1680\n    }\n  ],\n  \"recommendations\": [\n    \"Include trust badges above the fold (all 3 competitors do this)\",\n    \"Add a social proof counter — competitor1 shows 2,400+ clients\",\n    \"Video testimonial in hero increased competitor3 engagement by ~22%\",\n    \"Average CTA confidence across competitors: 0.91 — aim for 0.93+\"\n  ]\n}" },
      ],
      "gtm-ad-bidding": [
        { id: "ads-report", label: "Campaign Performance Report", type: "file", icon: "file", filename: "campaign-report-2026-03-12.csv", size: "12 KB", downloadContent: "campaign_id,campaign_name,status,impressions,clicks,ctr,cpc,spend,conversions,cpa,roas\nCAMP001,Pain Point - Intake Forms,Active,24580,892,3.63%,$1.24,$1106.08,48,$23.04,5.2x\nCAMP002,Pain Point - Online Booking,Active,18940,724,3.82%,$1.18,$854.32,41,$20.84,5.8x\nCAMP003,Social Proof - Reviews,Paused,12400,318,2.56%,$1.82,$578.76,10,$57.88,1.4x\nCAMP004,Carousel - Features,Active,31200,1042,3.34%,$0.98,$1021.16,52,$19.64,6.1x" },
        { id: "creative-1", label: "Ad Creative — Image #1 (Pain Point)", type: "file", icon: "image", filename: "ad-creative-pain-point-1.svg", size: "340 KB", downloadContent: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1080\" height=\"1080\" viewBox=\"0 0 1080 1080\">\n  <rect width=\"1080\" height=\"1080\" fill=\"#f0f4ff\"/>\n  <rect x=\"40\" y=\"40\" width=\"1000\" height=\"1000\" rx=\"24\" fill=\"white\" stroke=\"#e2e8f0\"/>\n  <text x=\"540\" y=\"200\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"48\" font-weight=\"700\" fill=\"#1a1a2e\">Still Using Paper</text>\n  <text x=\"540\" y=\"260\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"48\" font-weight=\"700\" fill=\"#1a1a2e\">Intake Forms?</text>\n  <text x=\"540\" y=\"400\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"72\" font-weight=\"800\" fill=\"#2563eb\">68%</text>\n  <text x=\"540\" y=\"460\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"28\" fill=\"#64748b\">faster patient intake</text>\n  <text x=\"540\" y=\"560\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"28\" fill=\"#64748b\">Join 2,400+ providers who switched</text>\n  <rect x=\"340\" y=\"700\" width=\"400\" height=\"60\" rx=\"12\" fill=\"#2563eb\"/>\n  <text x=\"540\" y=\"740\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"22\" font-weight=\"600\" fill=\"white\">Start Free Trial →</text>\n  <text x=\"540\" y=\"900\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"16\" fill=\"#94a3b8\">StreamIntake.com | HIPAA Compliant</text>\n</svg>" },
        { id: "creative-2", label: "Ad Creative — Carousel Card 1", type: "file", icon: "image", filename: "ad-carousel-card-1.svg", size: "280 KB", downloadContent: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1080\" height=\"1080\" viewBox=\"0 0 1080 1080\">\n  <rect width=\"1080\" height=\"1080\" fill=\"#1a1a2e\"/>\n  <text x=\"540\" y=\"300\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"64\" font-weight=\"700\" fill=\"white\">Before</text>\n  <text x=\"540\" y=\"420\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"120\" fill=\"#ef4444\">45 min</text>\n  <text x=\"540\" y=\"500\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"28\" fill=\"#94a3b8\">average patient intake time</text>\n  <text x=\"540\" y=\"650\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"64\" font-weight=\"700\" fill=\"white\">After</text>\n  <text x=\"540\" y=\"770\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"120\" fill=\"#22c55e\">12 min</text>\n  <text x=\"540\" y=\"850\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"28\" fill=\"#94a3b8\">with StreamIntake digital forms</text>\n  <text x=\"540\" y=\"1000\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"18\" fill=\"#64748b\">Swipe → to see more results</text>\n</svg>" },
        { id: "pain-points", label: "Pain Points Extract (47 entries)", type: "file", icon: "file", filename: "pain-points-2026-03-12.json", size: "28 KB", previewContent: "[\n  {\n    \"source\": \"r/therapy\",\n    \"text\": \"intake forms take forever\",\n    \"sentiment\": -0.72,\n    \"frequency\": 14\n  },\n  {\n    \"source\": \"twitter\",\n    \"text\": \"why cant I book online\",\n    \"sentiment\": -0.65,\n    \"frequency\": 9\n  }\n  // ... 45 more entries\n]", downloadContent: "[\n  {\"source\": \"r/therapy\", \"text\": \"intake forms take forever\", \"sentiment\": -0.72, \"frequency\": 14},\n  {\"source\": \"twitter\", \"text\": \"why cant I book online\", \"sentiment\": -0.65, \"frequency\": 9},\n  {\"source\": \"r/behavioralhealth\", \"text\": \"patients ghost after seeing the paperwork\", \"sentiment\": -0.81, \"frequency\": 12},\n  {\"source\": \"twitter\", \"text\": \"insurance verification is a nightmare\", \"sentiment\": -0.77, \"frequency\": 11},\n  {\"source\": \"r/therapy\", \"text\": \"no online scheduling in 2026 is wild\", \"sentiment\": -0.68, \"frequency\": 8},\n  {\"source\": \"r/privatepractice\", \"text\": \"my front desk spends 3hrs on intake daily\", \"sentiment\": -0.74, \"frequency\": 7},\n  {\"source\": \"twitter\", \"text\": \"waiting room clipboards feel so outdated\", \"sentiment\": -0.59, \"frequency\": 6},\n  {\"source\": \"r/therapy\", \"text\": \"HIPAA compliance forms are confusing for pts\", \"sentiment\": -0.63, \"frequency\": 5}\n]" },
        { id: "fb-link", label: "Facebook Ads Manager → Campaign", type: "link", icon: "globe", url: "#" },
      ],
      "seo-content-machine": [
        { id: "article-1", label: "Article: \"Best Anxiety Therapists in Dallas\"", type: "file", icon: "file", filename: "anxiety-therapists-dallas.md", size: "8.4 KB", previewContent: "# Best Anxiety Therapists in Dallas (2026)\n\nFinding the right anxiety therapist in Dallas can feel\noverwhelming. This guide covers what to look for,\ninsurance options, and the top-rated providers...\n\n## What to Look for in an Anxiety Therapist\n...\n\n## Top 8 Anxiety Therapists in Dallas\n...\n\n*2,180 words | Reading time: 9 min*", downloadContent: "# Best Anxiety Therapists in Dallas (2026)\n\nFinding the right anxiety therapist in Dallas can feel overwhelming — there are over 2,800 licensed therapists in the DFW metro. This guide covers what to look for, insurance options, and the top-rated providers based on patient reviews and clinical outcomes.\n\n## What to Look for in an Anxiety Therapist\n\n### Credentials & Specialization\nLook for licensed professionals (LPC, LCSW, PsyD, PhD) who specialize in anxiety disorders. Key certifications include CBT training, EMDR certification, and APA fellowship status.\n\n### Insurance & Cost\nMany Dallas therapists accept BCBS, Aetna, Cigna, and United. Out-of-pocket rates range from $120-250/session. Ask about sliding scale availability.\n\n### Treatment Approaches\n- **CBT (Cognitive Behavioral Therapy)**: Gold standard for anxiety, 60-80% response rate\n- **EMDR**: Effective for trauma-related anxiety\n- **Exposure Therapy**: Best for specific phobias and social anxiety\n- **ACT (Acceptance & Commitment)**: Mindfulness-based approach\n\n## Top 8 Anxiety Therapists in Dallas\n\n### 1. Dr. Sarah Chen — Serenity Wellness Center\n⭐ 4.9/5 (127 reviews) | Oak Lawn | Accepts BCBS, Aetna\nSpecializes in generalized anxiety disorder and panic attacks.\n\n### 2. Dr. Marcus Webb — MindBridge Therapy\n⭐ 4.8/5 (94 reviews) | Uptown | Accepts Cigna, United\nCBT and ACT specialist with 15 years experience.\n\n### 3. Dr. Lisa Patel — Dallas Anxiety Clinic\n⭐ 4.8/5 (156 reviews) | Preston Hollow | Most major insurance\nEvidence-based treatment center with group therapy options.\n\n### 4. Jennifer Torres, LPC — Calm Path Counseling\n⭐ 4.7/5 (82 reviews) | Deep Ellum | Sliding scale available\nBilingual (English/Spanish), specializes in social anxiety.\n\n*[4 more listings...]*\n\n## How to Book Your First Appointment\n\n1. Check insurance coverage using the provider's online verification tool\n2. Many offer free 15-minute consultations\n3. Consider teletherapy if commute is a barrier\n\n---\n*2,180 words | Reading time: 9 min*\n*Generated by Marketing Powered SEO Content Machine | March 12, 2026*\n*Target keyword: \"anxiety therapists dallas\" (Vol: 1,200 | KD: 14)*" },
        { id: "article-2", label: "Article: \"Online Therapy vs In-Person\"", type: "file", icon: "file", filename: "online-vs-inperson-therapy.md", size: "7.2 KB", previewContent: "# Online Therapy vs In-Person: Which Is Right for You?\n\nThe shift to telehealth has transformed mental health care...\n\n## Key Differences\n...\n\n## When to Choose Online\n...\n\n## When In-Person Is Better\n...\n\n*1,840 words | Reading time: 7 min*", downloadContent: "# Online Therapy vs In-Person: Which Is Right for You? (2026 Guide)\n\nThe shift to telehealth has transformed mental health care. 64% of therapy sessions in Texas now offer a virtual option. But is online therapy as effective as sitting in a therapist's office?\n\n## Key Differences at a Glance\n\n| Factor | Online Therapy | In-Person Therapy |\n|--------|---------------|------------------|\n| Convenience | High — from anywhere | Requires commute |\n| Cost | $80-150/session | $120-250/session |\n| Insurance | Most plans cover | Most plans cover |\n| Effectiveness | 85% as effective (meta-analysis) | Gold standard |\n| Best for | Mild-moderate anxiety, depression | Severe conditions, EMDR |\n\n## When to Choose Online Therapy\n- Busy schedule or long commute\n- Mild to moderate symptoms\n- Comfort speaking from home\n- Rural areas with limited providers\n\n## When In-Person Is Better\n- Severe mental health conditions\n- EMDR or exposure therapy needs\n- Difficulty focusing in home environment\n- Preference for physical therapeutic space\n\n## The Hybrid Approach\nMany Dallas providers now offer hybrid models...\n\n---\n*1,840 words | Reading time: 7 min*\n*Generated by Marketing Powered SEO Content Machine | March 12, 2026*" },
        { id: "hero-1", label: "Hero Image — Anxiety Therapists", type: "file", icon: "image", filename: "hero-anxiety-dallas-1200x630.svg", size: "820 KB", downloadContent: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"630\" viewBox=\"0 0 1200 630\">\n  <defs><linearGradient id=\"bg\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0%\" stop-color=\"#dbeafe\"/><stop offset=\"100%\" stop-color=\"#e0e7ff\"/></linearGradient></defs>\n  <rect width=\"1200\" height=\"630\" fill=\"url(#bg)\"/>\n  <text x=\"600\" y=\"240\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"52\" font-weight=\"700\" fill=\"#1e293b\">Best Anxiety Therapists</text>\n  <text x=\"600\" y=\"310\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"52\" font-weight=\"700\" fill=\"#1e293b\">in Dallas (2026)</text>\n  <text x=\"600\" y=\"380\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"24\" fill=\"#475569\">Expert-reviewed guide to the top 8 providers</text>\n  <rect x=\"440\" y=\"420\" width=\"320\" height=\"50\" rx=\"8\" fill=\"#2563eb\"/>\n  <text x=\"600\" y=\"452\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"18\" font-weight=\"600\" fill=\"white\">Read the Full Guide →</text>\n  <text x=\"600\" y=\"570\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"14\" fill=\"#94a3b8\">StreamIntake.com | Updated March 2026</text>\n</svg>" },
        { id: "hero-2", label: "Hero Image — Online vs In-Person", type: "file", icon: "image", filename: "hero-online-therapy-1200x630.svg", size: "780 KB", downloadContent: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1200\" height=\"630\" viewBox=\"0 0 1200 630\">\n  <rect width=\"1200\" height=\"630\" fill=\"#f0fdf4\"/>\n  <text x=\"600\" y=\"240\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"48\" font-weight=\"700\" fill=\"#1e293b\">Online Therapy vs In-Person</text>\n  <text x=\"600\" y=\"310\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"28\" fill=\"#475569\">Which is right for you?</text>\n  <rect x=\"100\" y=\"360\" width=\"460\" height=\"180\" rx=\"16\" fill=\"white\" stroke=\"#e2e8f0\"/>\n  <text x=\"330\" y=\"410\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"22\" font-weight=\"600\" fill=\"#2563eb\">💻 Online</text>\n  <text x=\"330\" y=\"445\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"16\" fill=\"#64748b\">$80-150/session</text>\n  <text x=\"330\" y=\"475\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"16\" fill=\"#64748b\">From anywhere</text>\n  <text x=\"330\" y=\"505\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"16\" fill=\"#64748b\">85% as effective</text>\n  <rect x=\"640\" y=\"360\" width=\"460\" height=\"180\" rx=\"16\" fill=\"white\" stroke=\"#e2e8f0\"/>\n  <text x=\"870\" y=\"410\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"22\" font-weight=\"600\" fill=\"#059669\">🏥 In-Person</text>\n  <text x=\"870\" y=\"445\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"16\" fill=\"#64748b\">$120-250/session</text>\n  <text x=\"870\" y=\"475\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"16\" fill=\"#64748b\">Gold standard</text>\n  <text x=\"870\" y=\"505\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"16\" fill=\"#64748b\">Best for severe cases</text>\n  <text x=\"600\" y=\"595\" text-anchor=\"middle\" font-family=\"system-ui\" font-size=\"14\" fill=\"#94a3b8\">StreamIntake.com | 2026 Guide</text>\n</svg>" },
        { id: "kw-report", label: "Keyword Opportunities Report", type: "file", icon: "file", filename: "keyword-opportunities-2026-03-12.csv", size: "6 KB", downloadContent: "keyword,volume,difficulty,cpc,current_rank,opportunity_score\nanxiety therapists dallas,1200,14,$8.40,,95\nonline therapy vs in person,880,12,$6.20,,92\nbest therapists near me dallas,720,18,$9.80,,88\naffordable therapy dallas,640,16,$7.10,,85\ntherapy for panic attacks dallas,540,11,$10.20,,90\ncbt therapist dallas tx,480,13,$11.50,,87\nmental health counselor oak lawn,320,8,$6.80,,93\nteletherapy texas insurance,560,15,$5.90,,86" },
        { id: "wp-link", label: "WordPress Drafts → Review Queue", type: "link", icon: "globe", url: "#" },
      ],
      "social-proof-engine": [
        { id: "widget-popup", label: "Widget — Notification Popup (embed code)", type: "code", icon: "code", previewContent: "<script src=\"https://cdn.proof.io/widget.js\"\n  data-widget-id=\"sp_28f4a\"\n  data-position=\"bottom-left\"\n  data-delay=\"3000\">\n</script>\n\n<!-- Shows: \"Sarah from Dallas just booked\n     an appointment — 2 minutes ago\" -->", downloadContent: "<!-- Marketing Powered Social Proof Widget — Notification Popup -->\n<!-- Generated: 2026-03-12 -->\n<!-- Place this snippet before </body> on any page -->\n\n<script src=\"https://cdn.proof.io/widget.js\"\n  data-widget-id=\"sp_28f4a\"\n  data-position=\"bottom-left\"\n  data-delay=\"3000\"\n  data-display-time=\"5000\"\n  data-animation=\"slide-up\"\n  data-theme=\"light\">\n</script>\n\n<!-- Configuration:\n  - Position: bottom-left\n  - Show delay: 3 seconds after page load\n  - Display duration: 5 seconds per notification\n  - Animation: slide-up\n  - Data source: Marketing Powered Social Proof Engine API\n  - Shows: \"[Name] from [City] just [action] — [time] ago\"\n  - Rotation: cycles through last 24h of activity\n-->", mimeType: "text/html", filename: "social-proof-popup-widget.html" },
        { id: "widget-carousel", label: "Widget — Review Carousel (embed code)", type: "code", icon: "code", previewContent: "<div id=\"proof-carousel\" data-widget=\"sp_carousel_19c\">\n  <!-- Auto-populated with 12 testimonials -->\n  <!-- Avg rating: 4.7 stars -->\n</div>\n<script src=\"https://cdn.proof.io/carousel.js\"></script>", downloadContent: "<!-- Marketing Powered Social Proof Widget — Review Carousel -->\n<!-- Generated: 2026-03-12 -->\n<!-- Place this snippet where you want the carousel to appear -->\n\n<div id=\"proof-carousel\"\n  data-widget=\"sp_carousel_19c\"\n  data-auto-scroll=\"true\"\n  data-scroll-speed=\"4000\"\n  data-show-stars=\"true\"\n  data-show-avatar=\"true\"\n  data-max-reviews=\"12\"\n  data-min-rating=\"4\"\n  data-theme=\"light\"\n  data-border-radius=\"12px\">\n</div>\n<script src=\"https://cdn.proof.io/carousel.js\"></script>\n\n<!-- Configuration:\n  - Auto-scroll: enabled (4s interval)\n  - Shows: star rating + avatar + review text\n  - Max reviews: 12 (filtered for 4+ stars)\n  - Sources: Google, G2, Twitter, Reddit\n  - Avg rating displayed: 4.7 stars\n  - Responsive: adapts to container width\n-->", mimeType: "text/html", filename: "social-proof-carousel-widget.html" },
        { id: "case-study", label: "Case Study Draft", type: "file", icon: "file", filename: "case-study-draft-2026-03-12.md", size: "4.8 KB", previewContent: "# How [Brand] Increased Bookings 34% with\n# Streamlined Patient Intake\n\n## The Challenge\nPatients were abandoning the intake process...\n\n## The Solution\nImplemented digital forms with insurance verification...\n\n## Results\n- 34% increase in completed bookings\n- 68% reduction in intake time\n- 4.8 star average patient satisfaction\n\n*Draft — 1,240 words*", downloadContent: "# How Serenity Wellness Increased Bookings 34% with Streamlined Patient Intake\n\n*Case Study | Generated by Marketing Powered Social Proof Engine | March 2026*\n\n---\n\n## Executive Summary\n\nSerenity Wellness Center, a mid-size therapy practice in Dallas, TX, struggled with a 42% patient intake abandonment rate. After implementing a digital-first intake process with automated insurance verification and real-time social proof notifications, they achieved a 34% increase in completed bookings within 60 days.\n\n## The Challenge\n\nBefore optimization, Serenity Wellness faced several critical bottlenecks:\n\n- **42% intake abandonment rate** — patients dropped off during multi-page paper forms\n- **Average intake time: 22 minutes** — far exceeding the 8-minute attention threshold\n- **No social proof visibility** — prospective patients couldn't see real-time booking activity\n- **Manual insurance verification** adding 48-hour delays to appointment confirmation\n- **3.9 star average** on Google Reviews (below the 4.5 local competitor average)\n\nThe practice was losing an estimated $18,400/month in potential revenue from abandoned intakes alone.\n\n## The Solution\n\nMarketing Powered deployed a three-pronged approach:\n\n### 1. Digital Intake Optimization\n- Replaced 6-page paper forms with a single-page progressive disclosure form\n- Added real-time insurance verification (Eligible API integration)\n- Implemented smart field pre-population from referral source data\n- Mobile-optimized with touch-friendly inputs and auto-save\n\n### 2. Social Proof Integration\n- Deployed notification popup widget showing real-time booking activity\n- Added review carousel featuring 12 curated 4.7+ star testimonials\n- Implemented \"X people are viewing this provider\" live counter\n- A/B tested placement: bottom-left popup vs. inline banner\n\n### 3. Automated Follow-Up Sequences\n- 15-minute abandoned intake reminder (SMS + email)\n- 24-hour \"still interested?\" follow-up with testimonial highlight\n- 72-hour final touchpoint with limited-availability messaging\n\n## Results\n\nAfter 60 days of deployment:\n\n| Metric | Before | After | Change |\n|--------|--------|-------|--------|\n| Intake completion rate | 58% | 94% | +62% |\n| Average intake time | 22 min | 7 min | -68% |\n| Monthly bookings | 142 | 190 | +34% |\n| Google review average | 3.9 ★ | 4.8 ★ | +23% |\n| Patient satisfaction | 72% | 96% | +33% |\n| Revenue impact | — | +$22,800/mo | — |\n\n### Key Insights\n\n- **Social proof popup** increased form start rate by 18% (bottom-left placement won A/B test)\n- **Review carousel** reduced bounce rate by 24% on provider profile pages\n- **SMS follow-up** recovered 31% of abandoned intakes (vs. 8% for email alone)\n- **Insurance pre-verification** eliminated the #1 cited reason for abandonment\n\n## Testimonial\n\n> \"We went from losing nearly half our potential patients during intake to a 94% completion rate. The social proof widgets made an immediate difference — patients told us seeing real-time activity made them feel confident booking.\"\n>\n> — Dr. Amanda Chen, Clinical Director, Serenity Wellness Center\n\n---\n\n*This case study was auto-generated by Marketing Powered Social Proof Engine from collected metrics and social mentions. All statistics are from the 60-day measurement period (Jan 10 – Mar 10, 2026). Review for accuracy before publishing.*\n\n*Word count: 1,240*", mimeType: "text/markdown" },
        { id: "mentions-csv", label: "All Mentions Export", type: "file", icon: "file", filename: "mentions-2026-03-12.csv", size: "18 KB", downloadContent: "mention_id,platform,author,text,sentiment,score,date,url\nM001,twitter,@drwellness,\"amazing patient intake experience\",positive,0.89,2026-03-10,https://twitter.com/drwellness/status/1\nM002,reddit,u/therapist_life,\"switched to digital forms last month - game changer\",positive,0.82,2026-03-09,https://reddit.com/r/therapy/1\nM003,google,Sarah C.,\"5 stars - the online booking saved me so much time\",positive,0.91,2026-03-11,https://g.co/review/1\nM004,twitter,@mentalhealth_tx,\"wish more practices used this kind of tech\",positive,0.74,2026-03-08,https://twitter.com/mentalhealth_tx/1\nM005,g2,Mike R.,\"Solid platform, easy setup, great support team\",positive,0.86,2026-03-07,https://g2.com/review/1\nM006,reddit,u/private_practice,\"intake completion rate went from 60% to 94%\",positive,0.88,2026-03-06,https://reddit.com/r/privatepractice/1\nM007,twitter,@dallascounselor,\"not a fan of the mobile experience\",negative,-0.52,2026-03-10,https://twitter.com/dallascounselor/1\nM008,google,James T.,\"Took a bit to set up but worth it\",neutral,0.45,2026-03-09,https://g.co/review/2" },
      ],
      "data-enrichment-pipeline": [
        { id: "enriched-csv", label: "Enriched Leads Export", type: "file", icon: "file", filename: "enriched-leads-2026-03-12.csv", size: "124 KB", downloadContent: "lead_id,company_name,contact_name,email,phone,website,industry,employee_count,annual_revenue,city,state,zip,linkedin_url,insurance_accepted,specialties,tech_stack,enrichment_source,enrichment_date\nL001,Serenity Wellness Center,Dr. Amanda Chen,amanda@serenitywellness.com,(214) 555-0142,serenitywellness.com,Mental Health,12,$1.8M,Dallas,TX,75219,linkedin.com/in/amandachen,\"BlueCross, Aetna, Cigna\",\"Anxiety, Depression, PTSD\",\"SimplePractice, Mailchimp\",clearbit,2026-03-12\nL002,MindBridge Therapy Group,Sarah Walters,sarah@mindbridgetherapy.com,(214) 555-0287,mindbridgetherapy.com,Behavioral Health,8,$1.2M,Dallas,TX,75201,linkedin.com/in/sarahwalters,\"Aetna, UnitedHealth\",\"CBT, DBT, Family Therapy\",\"TherapyNotes, Google Workspace\",clearbit,2026-03-12\nL003,Dallas Auto Parts Inc,Mike Torres,mike@dallasautoparts.com,(214) 555-0391,dallasautoparts.com,Automotive,45,$8.2M,Dallas,TX,75247,,,,\"Shopify, QuickBooks\",clearbit,2026-03-12\nL004,Recovery Path Clinic,Dr. James Wright,james@recoverypath.org,(817) 555-0156,recoverypath.org,Substance Abuse,22,$3.4M,Fort Worth,TX,76107,linkedin.com/in/jameswright,\"Medicaid, BlueCross, Tricare\",\"Addiction, Dual Diagnosis, MAT\",\"Kipu, Salesforce\",clearbit,2026-03-12\nL005,Harmony Counseling PLLC,Lisa Nguyen,lisa@harmonycounseling.net,(214) 555-0423,harmonycounseling.net,Counseling,5,$620K,Plano,TX,75024,linkedin.com/in/lisanguyen,\"Cigna, Aetna\",\"Couples, Individual, Teens\",SimplePractice,clearbit,2026-03-12\nL006,Lone Star Pediatric Therapy,Dr. Rachel Kim,rachel@lsptherapy.com,(972) 555-0518,lsptherapy.com,Pediatric Therapy,18,$2.6M,Richardson,TX,75080,linkedin.com/in/rachelkim,\"BlueCross, UnitedHealth, Medicaid\",\"ABA, Speech, Occupational\",\"CentralReach, HubSpot\",clearbit,2026-03-12\nL007,Peak Performance Counseling,Brian Okafor,brian@peakperformance.therapy,(214) 555-0672,peakperformance.therapy,Sports Psychology,3,$340K,Dallas,TX,75205,linkedin.com/in/brianokafor,\"Self-pay, Aetna\",\"Sports Psychology, Performance Anxiety\",\"Jane App, Stripe\",clearbit,2026-03-12\nL008,Thrive Mental Health Associates,Dr. Maria Santos,maria@thrivemha.com,(469) 555-0834,thrivemha.com,Mental Health,15,$2.1M,Irving,TX,75038,linkedin.com/in/mariasantos,\"BlueCross, Cigna, Aetna, UnitedHealth\",\"Anxiety, Depression, OCD, Trauma\",\"SimplePractice, Mailchimp, Zapier\",clearbit,2026-03-12", mimeType: "text/csv" },
        { id: "scoring-report", label: "ICP Scoring Report", type: "file", icon: "file", filename: "icp-scores-2026-03-12.csv", size: "42 KB", previewContent: "lead_id,company,score,reasoning\nL001,Serenity Wellness,92,\"Mental health, 12 employees, TX, accepts insurance\"\nL002,MindBridge Therapy,88,\"Behavioral health, 8 employees, TX\"\nL003,Dallas Auto Parts,14,\"Automotive, not healthcare vertical\"\nL004,Recovery Path Clinic,85,\"Substance abuse, 22 employees, TX\"\n... 238 more rows", downloadContent: "lead_id,company,icp_score,vertical_match,employee_range_match,geo_match,insurance_match,tech_readiness,total_signals,reasoning,recommended_action\nL001,Serenity Wellness Center,92,true,true,true,true,high,6,\"Mental health vertical match. 12 employees in ideal 5-25 range. Dallas TX geo match. Accepts 3 major insurers. Uses SimplePractice (integration-ready). Active Mailchimp = marketing-aware.\",nurture_high\nL002,MindBridge Therapy Group,88,true,true,true,true,medium,5,\"Behavioral health vertical match. 8 employees in range. Dallas TX. 2 major insurers. Uses TherapyNotes (integration available).\",nurture_high\nL003,Dallas Auto Parts Inc,14,false,false,true,false,low,1,\"Automotive industry — not healthcare vertical. Only geo match. No insurance relevance. Disqualified.\",disqualify\nL004,Recovery Path Clinic,85,true,true,true,true,high,6,\"Substance abuse vertical match. 22 employees. Fort Worth TX (DFW metro). Accepts Medicaid + major insurers. Salesforce CRM = integration-ready.\",nurture_high\nL005,Harmony Counseling PLLC,71,true,true,true,true,medium,4,\"Counseling match. 5 employees (lower end). Plano TX. 2 insurers. SimplePractice. Small but qualified.\",nurture_medium\nL006,Lone Star Pediatric Therapy,79,true,true,true,true,high,5,\"Pediatric therapy — adjacent vertical. 18 employees. Richardson TX. 3 insurers + Medicaid. Uses CentralReach + HubSpot (marketing-mature).\",nurture_medium\nL007,Peak Performance Counseling,38,true,false,true,false,low,2,\"Sports psych — niche vertical. Only 3 employees (below minimum). Mostly self-pay. Limited tech stack.\",monitor\nL008,Thrive Mental Health Associates,94,true,true,true,true,high,7,\"Mental health vertical — perfect match. 15 employees. Irving TX (DFW). 4 major insurers. Full tech stack with SimplePractice + Mailchimp + Zapier (automation-ready). Highest scored lead.\",nurture_high", mimeType: "text/csv" },
        { id: "validation-report", label: "Email Validation Report", type: "file", icon: "file", filename: "email-validation-2026-03-12.csv", size: "16 KB", downloadContent: "email,status,score,mx_found,smtp_check,is_catchall,is_disposable,is_role_account,suggestion,checked_at\namanda@serenitywellness.com,valid,0.96,true,true,false,false,false,,2026-03-12T08:14:22Z\nsarah@mindbridgetherapy.com,valid,0.94,true,true,false,false,false,,2026-03-12T08:14:23Z\nmike@dallasautoparts.com,valid,0.91,true,true,true,false,false,,2026-03-12T08:14:23Z\njames@recoverypath.org,valid,0.93,true,true,false,false,false,,2026-03-12T08:14:24Z\nlisa@harmonycounseling.net,valid,0.89,true,true,false,false,false,,2026-03-12T08:14:24Z\nrachel@lsptherapy.com,valid,0.92,true,true,false,false,false,,2026-03-12T08:14:25Z\nbrian@peakperformance.therapy,risky,0.61,true,false,false,false,false,\"SMTP check failed — may bounce\",2026-03-12T08:14:25Z\nmaria@thrivemha.com,valid,0.95,true,true,false,false,false,,2026-03-12T08:14:26Z\n\n# Summary: 7 valid, 1 risky, 0 invalid | Avg deliverability score: 0.89", mimeType: "text/csv" },
        { id: "hubspot-link", label: "HubSpot → New Leads Pipeline", type: "link", icon: "globe", url: "#" },
      ],
      "ig-reels-generator": [
        { id: "reel-pack-1", label: "Reel Pack #1 — \"5 Signs You Need Therapy\"", type: "file", icon: "video", filename: "reel-1-signs-therapy.html", size: "7.2 KB", mimeType: "text/html", downloadContent: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reel #1 — 5 Signs You Need Therapy</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;overflow:hidden}.reel{width:360px;height:640px;border-radius:32px;overflow:hidden;position:relative;background:linear-gradient(135deg,#667eea,#764ba2);background-size:200% 200%;animation:bg 25s ease infinite}.s{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 28px;text-align:center;opacity:0;color:#fff;animation-fill-mode:forwards}.s1{animation:f 4s ease 0s forwards}.s2{animation:f 3.5s ease 4s forwards}.s3{animation:f 3.5s ease 7.5s forwards}.s4{animation:f 3.5s ease 11s forwards}.s5{animation:f 3.5s ease 14.5s forwards}.s6{animation:f 3.5s ease 18s forwards}.s7{animation:f 4s ease 21.5s forwards}h1{font-size:26px;font-weight:700;line-height:1.3;text-shadow:0 2px 12px rgba(0,0,0,.3);margin-bottom:12px}p{font-size:15px;opacity:.85;line-height:1.5}.num{font-size:72px;font-weight:800;opacity:.2;position:absolute;top:20px;right:28px}.emoji{font-size:48px;margin-bottom:16px}.cta{display:inline-block;padding:14px 32px;background:#fff;color:#764ba2;border-radius:12px;font-weight:700;font-size:16px;margin-top:16px;box-shadow:0 4px 20px rgba(0,0,0,.2)}.bar{position:absolute;bottom:0;left:0;height:3px;background:rgba(255,255,255,.7);animation:p 25s linear forwards}@keyframes bg{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}@keyframes f{0%{opacity:0;transform:translateY(24px)}10%{opacity:1;transform:translateY(0)}88%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-16px)}}@keyframes p{from{width:0}to{width:100%}}</style></head><body><div class="reel"><div class="s s1"><div class="emoji">⚠️</div><h1>Are you ignoring these 5 warning signs?</h1><p>It might be time to talk to someone</p></div><div class="s s2"><div class="num">1</div><h1>Persistent sadness lasting 2+ weeks</h1><p>More than just a bad day</p></div><div class="s s3"><div class="num">2</div><h1>Significant changes in sleep patterns</h1><p>Too much or too little</p></div><div class="s s4"><div class="num">3</div><h1>Withdrawing from activities you loved</h1><p>Nothing feels fun anymore</p></div><div class="s s5"><div class="num">4</div><h1>Difficulty concentrating at work</h1><p>Brain fog that won't lift</p></div><div class="s s6"><div class="num">5</div><h1>Feeling overwhelmed by daily tasks</h1><p>Everything feels like too much</p></div><div class="s s7"><h1>You deserve support 💛</h1><p>Save this for someone who needs it</p><div class="cta">Link in bio ↓</div></div><div class="bar"></div></div></body></html>` },
        { id: "reel-pack-2", label: "Reel Pack #2 — \"Therapy Myths Debunked\"", type: "file", icon: "video", filename: "reel-2-myths-debunked.html", size: "6.8 KB", mimeType: "text/html", downloadContent: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reel #2 — Therapy Myths Debunked</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;overflow:hidden}.reel{width:360px;height:640px;border-radius:32px;overflow:hidden;position:relative;background:linear-gradient(135deg,#f093fb,#f5576c);background-size:200% 200%;animation:bg 20s ease infinite}.s{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 28px;text-align:center;opacity:0;color:#fff;animation-fill-mode:forwards}.s1{animation:f 3.5s ease 0s forwards}.s2{animation:f 4s ease 3.5s forwards}.s3{animation:f 4s ease 7.5s forwards}.s4{animation:f 4s ease 11.5s forwards}.s5{animation:f 4.5s ease 15.5s forwards}h1{font-size:26px;font-weight:700;line-height:1.3;text-shadow:0 2px 12px rgba(0,0,0,.3);margin-bottom:12px}p{font-size:15px;opacity:.85;line-height:1.5}.tag{display:inline-block;padding:8px 20px;border-radius:20px;font-weight:700;font-size:14px;margin-bottom:16px}.myth{background:rgba(255,255,255,.2);backdrop-filter:blur(8px)}.truth{background:rgba(255,255,255,.9);color:#f5576c}.emoji{font-size:48px;margin-bottom:16px}.x{font-size:64px;margin-bottom:12px;opacity:.6}.cta{display:inline-block;padding:14px 32px;background:#fff;color:#f5576c;border-radius:12px;font-weight:700;font-size:16px;margin-top:16px;box-shadow:0 4px 20px rgba(0,0,0,.2)}.bar{position:absolute;bottom:0;left:0;height:3px;background:rgba(255,255,255,.7);animation:p 20s linear forwards}@keyframes bg{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}@keyframes f{0%{opacity:0;transform:scale(.9)}10%{opacity:1;transform:scale(1)}88%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.05)}}@keyframes p{from{width:0}to{width:100%}}</style></head><body><div class="reel"><div class="s s1"><div class="emoji">🚫</div><h1>Stop believing these therapy myths</h1><p>Let's set the record straight</p></div><div class="s s2"><div class="x">✗</div><span class="tag myth">MYTH</span><h1>"Therapy is only for people with severe issues"</h1><p>Everyone can benefit from professional support</p></div><div class="s s3"><div class="x">✗</div><span class="tag myth">MYTH</span><h1>"A good therapist will give you all the answers"</h1><p>They help YOU find your answers</p></div><div class="s s4"><div class="x">✗</div><span class="tag myth">MYTH</span><h1>"Therapy takes years to see results"</h1><p>Many people feel better in 8-12 sessions</p></div><div class="s s5"><span class="tag truth">✓ TRUTH</span><h1>Everyone deserves support 💛</h1><p>Which myth surprised you? Comment below 👇</p><div class="cta">Follow for more</div></div><div class="bar"></div></div></body></html>` },
        { id: "reel-pack-3", label: "Reel Pack #3 — \"What Happens in Session\"", type: "file", icon: "video", filename: "reel-3-first-session.html", size: "7.4 KB", mimeType: "text/html", downloadContent: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reel #3 — What Happens in Session</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:'DM Sans',system-ui,sans-serif;overflow:hidden}.reel{width:360px;height:640px;border-radius:32px;overflow:hidden;position:relative;background:linear-gradient(135deg,#a8edea,#fed6e3,#c3cfe2);background-size:300% 300%;animation:bg 24s ease infinite}.s{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:36px 28px;text-align:center;opacity:0;color:#2d3748;animation-fill-mode:forwards}.s1{animation:f 3.5s ease 0s forwards}.s2{animation:f 4s ease 3.5s forwards}.s3{animation:f 4s ease 7.5s forwards}.s4{animation:f 4s ease 11.5s forwards}.s5{animation:f 4s ease 15.5s forwards}.s6{animation:f 4.5s ease 19.5s forwards}h1{font-size:24px;font-weight:700;line-height:1.3;margin-bottom:12px}p{font-size:15px;opacity:.75;line-height:1.5}.step{width:56px;height:56px;border-radius:50%;background:rgba(45,55,72,.1);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;margin-bottom:16px;border:2px solid rgba(45,55,72,.15)}.emoji{font-size:48px;margin-bottom:16px}.cta{display:inline-block;padding:14px 32px;background:#2d3748;color:#fff;border-radius:12px;font-weight:700;font-size:16px;margin-top:16px;box-shadow:0 4px 20px rgba(0,0,0,.15)}.bar{position:absolute;bottom:0;left:0;height:3px;background:rgba(45,55,72,.4);animation:p 24s linear forwards}@keyframes bg{0%,100%{background-position:0% 50%}33%{background-position:50% 100%}66%{background-position:100% 50%}}@keyframes f{0%{opacity:0;transform:translateY(24px)}10%{opacity:1;transform:translateY(0)}88%{opacity:1;transform:translateY(0)}100%{opacity:0;transform:translateY(-16px)}}@keyframes p{from{width:0}to{width:100%}}</style></head><body><div class="reel"><div class="s s1"><div class="emoji">🤝</div><h1>Nervous about your first therapy session?</h1><p>Here's exactly what to expect</p></div><div class="s s2"><div class="step">1</div><h1>Introductions & paperwork</h1><p>Your therapist makes you feel comfortable and handles logistics</p></div><div class="s s3"><div class="step">2</div><h1>They ask about your goals</h1><p>What brings you here? What would you like to work on?</p></div><div class="s s4"><div class="step">3</div><h1>You share at YOUR pace</h1><p>No pressure to reveal everything at once. You're in control.</p></div><div class="s s5"><div class="step">4</div><h1>Together you create a plan</h1><p>A roadmap for the sessions ahead — at your comfort level</p></div><div class="s s6"><div class="emoji">💛</div><h1>You've got this</h1><p>Save this for when you're ready to start</p><div class="cta">Link in bio ↓</div></div><div class="bar"></div></div></body></html>` },
        { id: "storyboard", label: "Storyboards JSON (all 5 reels)", type: "code", icon: "code", filename: "storyboards-2026-03-12.json", size: "12 KB", previewContent: "[\n  {\n    \"reel_id\": 1,\n    \"hook\": \"Are you ignoring these 5 warning signs?\",\n    \"body\": [\"Persistent sadness\", \"Sleep changes\", ...],\n    \"cta\": \"Save this for later ↓\",\n    \"slides\": 5,\n    \"bg_style\": \"Gradient Abstract\"\n  }\n  // ... 4 more reels\n]", downloadContent: "[\n  {\n    \"reel_id\": 1,\n    \"title\": \"5 Signs You Need Therapy\",\n    \"hook\": \"Are you ignoring these 5 warning signs?\",\n    \"slides\": [\n      { \"type\": \"hook\", \"text\": \"Are you ignoring these 5 warning signs?\", \"duration_ms\": 3000, \"animation\": \"fade-zoom\" },\n      { \"type\": \"content\", \"text\": \"1. Persistent sadness lasting 2+ weeks\", \"duration_ms\": 4000, \"animation\": \"slide-left\" },\n      { \"type\": \"content\", \"text\": \"2. Significant changes in sleep patterns\", \"duration_ms\": 4000, \"animation\": \"slide-left\" },\n      { \"type\": \"content\", \"text\": \"3. Withdrawing from activities you loved\", \"duration_ms\": 4000, \"animation\": \"slide-left\" },\n      { \"type\": \"content\", \"text\": \"4. Difficulty concentrating at work\", \"duration_ms\": 4000, \"animation\": \"slide-left\" },\n      { \"type\": \"cta\", \"text\": \"5. Feeling overwhelmed daily — Save this for later ↓\", \"duration_ms\": 5000, \"animation\": \"bounce\" }\n    ],\n    \"total_duration_ms\": 28000,\n    \"bg_style\": \"gradient-abstract\",\n    \"bg_colors\": [\"#667eea\", \"#764ba2\"],\n    \"font\": \"DM Sans\",\n    \"audio\": \"ambient-trending-01.mp3\",\n    \"aspect_ratio\": \"9:16\",\n    \"resolution\": \"1080x1920\"\n  },\n  {\n    \"reel_id\": 2,\n    \"title\": \"Therapy Myths Debunked\",\n    \"hook\": \"Stop believing these therapy myths\",\n    \"slides\": [\n      { \"type\": \"hook\", \"text\": \"Stop believing these therapy myths 🚫\", \"duration_ms\": 3000, \"animation\": \"fade-zoom\" },\n      { \"type\": \"content\", \"text\": \"MYTH: Therapy is only for severe issues\", \"duration_ms\": 5000, \"animation\": \"slide-left\" },\n      { \"type\": \"content\", \"text\": \"MYTH: A good therapist gives all answers\", \"duration_ms\": 5000, \"animation\": \"slide-left\" },\n      { \"type\": \"content\", \"text\": \"MYTH: Therapy takes years to work\", \"duration_ms\": 5000, \"animation\": \"slide-left\" },\n      { \"type\": \"cta\", \"text\": \"TRUTH: Everyone deserves support 💛\", \"duration_ms\": 4000, \"animation\": \"bounce\" }\n    ],\n    \"total_duration_ms\": 24000,\n    \"bg_style\": \"gradient-warm\",\n    \"bg_colors\": [\"#f093fb\", \"#f5576c\"],\n    \"font\": \"DM Sans\",\n    \"audio\": \"upbeat-motivation-02.mp3\",\n    \"aspect_ratio\": \"9:16\",\n    \"resolution\": \"1080x1920\"\n  },\n  {\n    \"reel_id\": 3,\n    \"title\": \"What Happens in Session\",\n    \"hook\": \"Nervous about your first session?\",\n    \"slides\": [\n      { \"type\": \"hook\", \"text\": \"Nervous about your first session? 🤝\", \"duration_ms\": 3000, \"animation\": \"fade-zoom\" },\n      { \"type\": \"content\", \"text\": \"1. Introductions and paperwork\", \"duration_ms\": 4500, \"animation\": \"slide-left\" },\n      { \"type\": \"content\", \"text\": \"2. Your therapist asks about your goals\", \"duration_ms\": 4500, \"animation\": \"slide-left\" },\n      { \"type\": \"content\", \"text\": \"3. You share at YOUR pace\", \"duration_ms\": 4500, \"animation\": \"slide-left\" },\n      { \"type\": \"content\", \"text\": \"4. Together you create a plan\", \"duration_ms\": 4500, \"animation\": \"slide-left\" },\n      { \"type\": \"cta\", \"text\": \"Ready to start? Link in bio 💛\", \"duration_ms\": 4000, \"animation\": \"bounce\" }\n    ],\n    \"total_duration_ms\": 32000,\n    \"bg_style\": \"gradient-calm\",\n    \"bg_colors\": [\"#a8edea\", \"#fed6e3\"],\n    \"font\": \"DM Sans\",\n    \"audio\": \"calm-piano-03.mp3\",\n    \"aspect_ratio\": \"9:16\",\n    \"resolution\": \"1080x1920\"\n  }\n]", mimeType: "application/json" },
        { id: "frames-preview", label: "Frame Previews — All 3 Reels", type: "file", icon: "image", filename: "reel-frames-preview.html", size: "8.6 KB", mimeType: "text/html", downloadContent: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reel Frame Previews — Marketing Powered</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#111;font-family:'DM Sans',system-ui,sans-serif;color:#fff;padding:32px}h1{text-align:center;font-size:24px;margin-bottom:8px}p.sub{text-align:center;color:#888;font-size:14px;margin-bottom:32px}.row{margin-bottom:40px}.row h2{font-size:16px;color:#aaa;margin-bottom:16px;padding-left:4px}.frames{display:flex;gap:12px;overflow-x:auto;padding-bottom:8px}.frame{min-width:140px;height:248px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 12px;text-align:center;font-size:11px;font-weight:600;line-height:1.3;color:#fff;flex-shrink:0;position:relative;overflow:hidden}.frame .num{position:absolute;top:8px;left:12px;font-size:10px;opacity:.5}.g1{background:linear-gradient(135deg,#667eea,#764ba2)}.g2{background:linear-gradient(135deg,#f093fb,#f5576c)}.g3{background:linear-gradient(135deg,#a8edea,#fed6e3);color:#2d3748}.em{font-size:24px;margin-bottom:8px}</style></head><body><h1>Reel Frame Previews</h1><p class="sub">15 frames across 3 reels — 1080×1920 (9:16)</p><div class="row"><h2>Reel 1 — "5 Signs You Need Therapy"</h2><div class="frames"><div class="frame g1"><div class="num">1/7</div><div class="em">⚠️</div>Are you ignoring these 5 warning signs?</div><div class="frame g1"><div class="num">2/7</div><div class="em">1</div>Persistent sadness lasting 2+ weeks</div><div class="frame g1"><div class="num">3/7</div><div class="em">2</div>Significant changes in sleep</div><div class="frame g1"><div class="num">4/7</div><div class="em">3</div>Withdrawing from activities you loved</div><div class="frame g1"><div class="num">5/7</div><div class="em">4</div>Difficulty concentrating at work</div></div></div><div class="row"><h2>Reel 2 — "Therapy Myths Debunked"</h2><div class="frames"><div class="frame g2"><div class="num">1/5</div><div class="em">🚫</div>Stop believing these therapy myths</div><div class="frame g2"><div class="num">2/5</div><div class="em">✗</div>MYTH: Only for severe issues</div><div class="frame g2"><div class="num">3/5</div><div class="em">✗</div>MYTH: Therapist gives all answers</div><div class="frame g2"><div class="num">4/5</div><div class="em">✗</div>MYTH: Takes years to work</div><div class="frame g2"><div class="num">5/5</div><div class="em">✓</div>Everyone deserves support 💛</div></div></div><div class="row"><h2>Reel 3 — "What Happens in Session"</h2><div class="frames"><div class="frame g3"><div class="num">1/6</div><div class="em">🤝</div>Nervous about your first session?</div><div class="frame g3"><div class="num">2/6</div><div class="em">1</div>Introductions & paperwork</div><div class="frame g3"><div class="num">3/6</div><div class="em">2</div>They ask about your goals</div><div class="frame g3"><div class="num">4/6</div><div class="em">3</div>You share at YOUR pace</div><div class="frame g3"><div class="num">5/6</div><div class="em">4</div>Together you create a plan</div></div></div></body></html>` },
      ],
      "seo-directory": [
        { id: "directory-link", label: "Live Directory Site → Preview", type: "link", icon: "globe", url: "#" },
        { id: "sitemap", label: "Sitemap (352 URLs)", type: "file", icon: "file", filename: "sitemap.xml", size: "34 KB", downloadContent: "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n  <url>\n    <loc>https://dallas-therapy-directory.com/</loc>\n    <lastmod>2026-03-12</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n  <url>\n    <loc>https://dallas-therapy-directory.com/therapists/anxiety</loc>\n    <lastmod>2026-03-12</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n  <url>\n    <loc>https://dallas-therapy-directory.com/therapists/depression</loc>\n    <lastmod>2026-03-12</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.9</priority>\n  </url>\n  <url>\n    <loc>https://dallas-therapy-directory.com/therapists/couples</loc>\n    <lastmod>2026-03-12</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n  <url>\n    <loc>https://dallas-therapy-directory.com/serenity-wellness-center</loc>\n    <lastmod>2026-03-12</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n  <url>\n    <loc>https://dallas-therapy-directory.com/mindbridge-therapy-group</loc>\n    <lastmod>2026-03-12</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n  <url>\n    <loc>https://dallas-therapy-directory.com/recovery-path-clinic</loc>\n    <lastmod>2026-03-12</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n  <url>\n    <loc>https://dallas-therapy-directory.com/thrive-mental-health</loc>\n    <lastmod>2026-03-12</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>\n  <!-- ... 344 more URLs -->\n  <!-- Total: 352 URLs | Generated by Marketing Powered SEO Directory Builder -->\n</urlset>", mimeType: "application/xml" },
        { id: "listings-export", label: "Cleaned Listings Export", type: "file", icon: "file", filename: "directory-listings-2026-03-12.csv", size: "86 KB", downloadContent: "listing_id,business_name,slug,category,subcategory,address,city,state,zip,phone,website,email,rating,review_count,insurance_accepted,specialties,hours,image_count,image_quality_score,schema_valid,last_verified\nDIR001,Serenity Wellness Center,serenity-wellness-center,Mental Health,Therapy,\"4521 Oak Lawn Ave\",Dallas,TX,75219,(214) 555-0142,serenitywellness.com,info@serenitywellness.com,4.8,127,\"BlueCross, Aetna, Cigna\",\"Anxiety, Depression, PTSD\",\"Mon-Fri 8am-7pm, Sat 9am-2pm\",8,94,true,2026-03-12\nDIR002,MindBridge Therapy Group,mindbridge-therapy-group,Mental Health,Behavioral,\"1200 Main St Ste 400\",Dallas,TX,75201,(214) 555-0287,mindbridgetherapy.com,hello@mindbridgetherapy.com,4.6,89,\"Aetna, UnitedHealth\",\"CBT, DBT, Family\",\"Mon-Fri 9am-6pm\",5,88,true,2026-03-12\nDIR003,Recovery Path Clinic,recovery-path-clinic,Substance Abuse,Addiction,\"800 W Magnolia Ave\",Fort Worth,TX,76107,(817) 555-0156,recoverypath.org,intake@recoverypath.org,4.7,203,\"Medicaid, BlueCross, Tricare\",\"Addiction, Dual Diagnosis, MAT\",\"Mon-Sun 7am-9pm\",12,91,true,2026-03-12\nDIR004,Thrive Mental Health Associates,thrive-mental-health,Mental Health,Therapy,\"2100 N MacArthur Blvd\",Irving,TX,75038,(469) 555-0834,thrivemha.com,contact@thrivemha.com,4.9,156,\"BlueCross, Cigna, Aetna, UnitedHealth\",\"Anxiety, Depression, OCD, Trauma\",\"Mon-Fri 8am-8pm, Sat 10am-4pm\",10,96,true,2026-03-12\nDIR005,Lone Star Pediatric Therapy,lone-star-pediatric-therapy,Pediatric,Developmental,\"3300 N Central Expy Ste 200\",Richardson,TX,75080,(972) 555-0518,lsptherapy.com,info@lsptherapy.com,4.8,178,\"BlueCross, UnitedHealth, Medicaid\",\"ABA, Speech, Occupational\",\"Mon-Fri 7am-6pm\",7,87,true,2026-03-12\nDIR006,Harmony Counseling PLLC,harmony-counseling,Counseling,Individual,\"5800 Granite Pkwy Ste 100\",Plano,TX,75024,(214) 555-0423,harmonycounseling.net,lisa@harmonycounseling.net,4.5,62,\"Cigna, Aetna\",\"Couples, Individual, Teens\",\"Mon-Thu 10am-7pm, Fri 10am-3pm\",4,82,true,2026-03-12", mimeType: "text/csv" },
        { id: "images-zip", label: "Curated Images (654 passed QA)", type: "file", icon: "image", filename: "directory-images.zip", size: "142 MB", downloadContent: "// Marketing Powered SEO Directory Builder — Curated Images Package\n// Generated: 2026-03-12\n//\n// QA Pipeline Results:\n//   Total scraped: 1,247 images\n//   Passed QA: 654 (52.4%)\n//   Failed QA: 593 (low res, watermarks, duplicates, irrelevant)\n//\n// QA Criteria:\n//   - Minimum resolution: 800x600\n//   - No watermarks (AI detection score < 0.15)\n//   - No duplicates (perceptual hash dedup, threshold: 0.92)\n//   - Relevance score > 0.7 (CLIP model classification)\n//   - Face detection: blurred if non-staff (privacy compliance)\n//\n// Directory Structure:\n// images/\n// ├── serenity-wellness-center/ (8 images)\n// │   ├── exterior-front.jpg (1200x800)\n// │   ├── reception-area.jpg (1200x900)\n// │   ├── therapy-room-1.jpg (1200x800)\n// │   └── ... 5 more\n// ├── mindbridge-therapy-group/ (5 images)\n// ├── recovery-path-clinic/ (12 images)\n// ├── thrive-mental-health/ (10 images)\n// ├── lone-star-pediatric/ (7 images)\n// ├── harmony-counseling/ (4 images)\n// └── ... 346 more listings\n//\n// Total size: 142 MB (WebP optimized, avg 217 KB/image)\n//\n// [Binary ZIP data would be here in production]\n// This is a demo export manifest from Marketing Powered Pipeline" },
        { id: "schema-sample", label: "Schema.org Markup Sample", type: "code", icon: "code", previewContent: "{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"LocalBusiness\",\n  \"name\": \"Serenity Wellness Center\",\n  \"address\": {\n    \"@type\": \"PostalAddress\",\n    \"streetAddress\": \"4521 Oak Lawn Ave\",\n    \"addressLocality\": \"Dallas\",\n    \"addressRegion\": \"TX\"\n  },\n  \"aggregateRating\": {\n    \"ratingValue\": \"4.8\",\n    \"reviewCount\": \"127\"\n  }\n}", downloadContent: "{\n  \"@context\": \"https://schema.org\",\n  \"@type\": \"LocalBusiness\",\n  \"name\": \"Serenity Wellness Center\",\n  \"description\": \"Full-service mental health practice specializing in anxiety, depression, and PTSD treatment in Dallas, TX.\",\n  \"url\": \"https://dallas-therapy-directory.com/serenity-wellness-center\",\n  \"telephone\": \"(214) 555-0142\",\n  \"email\": \"info@serenitywellness.com\",\n  \"address\": {\n    \"@type\": \"PostalAddress\",\n    \"streetAddress\": \"4521 Oak Lawn Ave\",\n    \"addressLocality\": \"Dallas\",\n    \"addressRegion\": \"TX\",\n    \"postalCode\": \"75219\",\n    \"addressCountry\": \"US\"\n  },\n  \"geo\": {\n    \"@type\": \"GeoCoordinates\",\n    \"latitude\": 32.8105,\n    \"longitude\": -96.8103\n  },\n  \"openingHoursSpecification\": [\n    {\n      \"@type\": \"OpeningHoursSpecification\",\n      \"dayOfWeek\": [\"Monday\", \"Tuesday\", \"Wednesday\", \"Thursday\", \"Friday\"],\n      \"opens\": \"08:00\",\n      \"closes\": \"19:00\"\n    },\n    {\n      \"@type\": \"OpeningHoursSpecification\",\n      \"dayOfWeek\": \"Saturday\",\n      \"opens\": \"09:00\",\n      \"closes\": \"14:00\"\n    }\n  ],\n  \"aggregateRating\": {\n    \"@type\": \"AggregateRating\",\n    \"ratingValue\": \"4.8\",\n    \"bestRating\": \"5\",\n    \"ratingCount\": \"127\",\n    \"reviewCount\": \"127\"\n  },\n  \"image\": [\n    \"https://dallas-therapy-directory.com/images/serenity-wellness-center/exterior-front.jpg\",\n    \"https://dallas-therapy-directory.com/images/serenity-wellness-center/reception-area.jpg\"\n  ],\n  \"sameAs\": [\n    \"https://serenitywellness.com\",\n    \"https://linkedin.com/company/serenity-wellness-center\"\n  ],\n  \"priceRange\": \"$$\",\n  \"paymentAccepted\": \"BlueCross, Aetna, Cigna, Cash, Credit Card\",\n  \"areaServed\": {\n    \"@type\": \"City\",\n    \"name\": \"Dallas\",\n    \"containedInPlace\": {\n      \"@type\": \"State\",\n      \"name\": \"Texas\"\n    }\n  }\n}", mimeType: "application/json", filename: "schema-sample.json" },
      ],
    };
    return outputs[toolId] || [];
  };

  // Tool-specific simulation messages
  const getRunSimulation = (t: Tool) => {
    const sims: Record<string, { steps: [number, string, string][]; final: { duration: string; summary: string; details: string[] } }> = {
      "vibe-marketing-funnel": {
        steps: [
          [2000, "Launching stealth Playwright browser with anti-detect fingerprint...", "8s..."],
          [4000, "Scraping competitor pages via residential proxy rotation...", "22s..."],
          [6000, "Running Claude Vision analysis on page layouts + CTAs...", "48s..."],
          [8000, "Generating landing page variants with React + shadcn/ui...", "1m 12s..."],
        ],
        final: {
          duration: "1m 42s",
          summary: "Analyzed 3 competitor pages, generated 2 LP variants + 3 video assets",
          details: [
            "Stealth mode: Anti-detect fingerprint applied (Chrome 122, macOS)",
            "Proxy: Residential IP rotation enabled — 3 unique IPs used",
            "Scraped 3 competitor pages (0 Cloudflare blocks) ✓",
            "Claude Vision analysis — 92% CTA confidence score",
            "Generated LP variant A (Modern Minimal) — 1,340 words",
            "Generated LP variant B (Healthcare Trust) — 1,180 words",
            "Rendered 3 Remotion videos (15s each, 1080x1920)",
          ],
        },
      },
      "gtm-ad-bidding": {
        steps: [
          [2000, "Mining Reddit threads and Twitter conversations via Perplexity API...", "14s..."],
          [4000, "Extracting pain points and generating ad creatives...", "32s..."],
          [7000, "Deploying ads to Facebook and evaluating live campaign performance...", "1m 05s..."],
        ],
        final: {
          duration: "2m 18s",
          summary: "Mined 34 pain points, created 4 ads, paused 1 underperformer, scaled 2 winners",
          details: [
            "Perplexity API: Scraped 18 Reddit threads, 24 Twitter conversations",
            "Extracted 34 unique pain points (de-duped from 61 raw)",
            "Generated 4 ad creatives (2 image, 2 carousel)",
            "Deployed to Facebook Ads account ✓",
            "Auto-paused: 1 ad (CPA $57.80 > $45 threshold)",
            "Auto-scaled: 2 ads (+20% budget, avg ROAS 5.2x)",
          ],
        },
      },
      "seo-content-machine": {
        steps: [
          [2000, "Querying Ahrefs API for keyword opportunities (KD<20, Vol>500)...", "10s..."],
          [4500, "Scraping top 10 SERP results with Playwright...", "38s..."],
          [7000, "Running Claude content gap analysis and generating articles...", "1m 24s..."],
          [9000, "Creating DALL-E hero images and publishing to WordPress...", "2m 02s..."],
        ],
        final: {
          duration: "2m 38s",
          summary: "Found 8 keyword opportunities, published 2 articles to WordPress",
          details: [
            "Ahrefs API: 8 opportunities found (KD<20, Vol>500)",
            "SERP scraped for top 2 keywords (20 pages total)",
            "Claude gap analysis identified 5 content gaps",
            "Generated 2 articles (avg 2,200 words each)",
            "DALL-E 3: Created 2 hero images (1200x630)",
            "Published 2 drafts to WordPress (pending review) ✓",
          ],
        },
      },
      "social-proof-engine": {
        steps: [
          [2000, "Connecting to Twitter API, Reddit API, Google Reviews...", "6s..."],
          [4500, "Scanning 4 platforms for brand mentions and sentiment...", "28s..."],
          [7000, "Filtering positive testimonials (sentiment > 0.7)...", "52s..."],
          [9000, "Generating embeddable social proof widgets...", "1m 18s..."],
        ],
        final: {
          duration: "1m 48s",
          summary: "Found 31 mentions, captured 12 testimonials, generated 3 proof widgets + 1 case study draft",
          details: [
            "Twitter/X: 14 mentions found (9 positive, 3 neutral, 2 negative)",
            "Reddit: 8 mentions found (6 positive, 2 neutral)",
            "Google Reviews: 6 new reviews (avg 4.6 stars)",
            "G2: 3 new reviews (avg 4.8 stars)",
            "Sentiment filter: 12 testimonials passed (score > 0.7)",
            "Widget gen: 2 notification popups + 1 review carousel created",
            "Claude case study: 1 draft generated from 4 clustered success signals",
            "Supabase: All widgets and testimonials stored ✓",
          ],
        },
      },
      "data-enrichment-pipeline": {
        steps: [
          [2000, "Importing and deduplicating lead CSV (245 rows)...", "8s..."],
          [4000, "Validating emails and enriching with Clearbit firmographics...", "32s..."],
          [6500, "Running Claude ICP scoring on 198 enriched leads...", "58s..."],
          [8500, "Syncing qualified leads to HubSpot CRM...", "1m 22s..."],
        ],
        final: {
          duration: "1m 44s",
          summary: "Processed 245 leads: 198 enriched, 189 valid emails, 142 synced to HubSpot (ICP >= 70)",
          details: [
            "CSV imported: 245 raw leads",
            "Deduplication: 12 duplicates removed → 233 unique",
            "Email validation: 189/233 valid (81.1%)",
            "Clearbit enrichment: 198/233 matched (85.0%)",
            "Claude ICP scoring: avg score 64.2, median 68",
            "Leads above threshold (ICP >= 70): 142 qualified",
            "HubSpot sync: 142 leads pushed to 'New Leads' pipeline ✓",
            "Enrichment report saved to /exports/enrichment-2026-03-12.csv",
          ],
        },
      },
      "ig-reels-generator": {
        steps: [
          [2000, "Scanning Obsidian vault for tagged notes (#content-idea, #reel)...", "5s..."],
          [4500, "Extracting topic clusters and generating Claude storyboards...", "34s..."],
          [7000, "Creating DALL-E 3 background images (1080x1920)...", "1m 08s..."],
          [9500, "Compositing text overlays with Pillow and exporting asset packs...", "1m 42s..."],
        ],
        final: {
          duration: "2m 06s",
          summary: "Scanned vault, extracted 5 topics, generated 5 Reel asset packs (15 frames total)",
          details: [
            "Vault scan: 234 notes found, 89 tagged with target tags",
            "Topic extraction: 5 new high-value clusters identified",
            "Claude storyboards: 5 JSON scripts generated (hook → body → CTA)",
            "DALL-E 3: 15 background images rendered (3 per Reel, 1080x1920)",
            "Pillow compositing: 15 text-overlay frames exported as PNG",
            "Font: DM Sans Bold applied with brand color overlay",
            "Output: 5 asset packs saved to /exports/reels-2026-03-12/",
            "Ready for IG upload via Creator Studio ✓",
          ],
        },
      },
      "seo-directory": {
        steps: [
          [2000, "Cleaning business CSV with Pandas (412 rows)...", "10s..."],
          [5000, "Crawling business websites via BrightData proxies (async batch)...", "1m 24s..."],
          [8000, "Running Claude Vision image curation and quality scoring...", "2m 38s..."],
          [11000, "Building Next.js directory pages with ISR + Schema.org...", "3m 52s..."],
        ],
        final: {
          duration: "4m 28s",
          summary: "Processed 340 listings across 12 cities, generated directory site with 352 pages",
          details: [
            "CSV cleaned: 340 valid listings from 412 raw rows (72 rejected)",
            "Web crawl: 298/340 sites responded (87.6%) via BrightData proxy",
            "Claude Vision: 892 images scored, 654 passed quality threshold (73.3%)",
            "Supabase: 340 listings + 654 images stored",
            "Next.js: Generated 12 city pages + 340 listing detail pages",
            "Schema.org: LocalBusiness markup applied to all listings",
            "Sitemap: 352 URLs generated and submitted",
            "ISR: Revalidation set to 3600s for all pages ✓",
          ],
        },
      },
    };
    return sims[t.id] || {
      steps: [
        [2000, "Processing inputs and connecting to APIs...", "12s..."],
        [4000, "Running main pipeline tasks...", "28s..."],
      ],
      final: {
        duration: "1m 42s",
        summary: "Pipeline completed successfully. All tasks processed.",
        details: [
          "Configuration validated ✓",
          "API connections established ✓",
          "Main pipeline executed ✓",
          "Results stored and synced ✓",
        ],
      },
    };
  };

  const handleDownload = (artifact: OutputArtifact) => {
    const content = artifact.downloadContent || artifact.previewContent || `// ${artifact.label}\n// Generated by Marketing Powered on ${new Date().toISOString()}\n// Filename: ${artifact.filename || "output.txt"}`;
    const mimeType = artifact.mimeType || (artifact.filename?.endsWith(".json") ? "application/json" : artifact.filename?.endsWith(".csv") ? "text/csv" : artifact.filename?.endsWith(".xml") ? "application/xml" : artifact.filename?.endsWith(".md") ? "text/markdown" : artifact.filename?.endsWith(".html") ? "text/html" : "text/plain");
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = artifact.filename || "output.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRun = () => {
    setIsRunning(true);
    setActiveTab("logs");

    const sim = getRunSimulation(tool);

    const newLog: ToolRunLog = {
      id: `run-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: "running",
      duration: "0s...",
      summary: "Initializing pipeline...",
    };
    setRunLogs((prev) => [newLog, ...prev]);

    // Simulate tool-specific progress steps
    sim.steps.forEach(([delay, msg, dur]) => {
      setTimeout(() => {
        setRunLogs((prev) =>
          prev.map((l) =>
            l.id === newLog.id
              ? { ...l, summary: msg, duration: dur }
              : l
          )
        );
      }, delay);
    });

    // Complete after last step + buffer
    const lastStepDelay = sim.steps[sim.steps.length - 1]?.[0] ?? 4000;
    setTimeout(() => {
      setIsRunning(false);
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === newLog.id
            ? {
                ...l,
                status: "success" as const,
                duration: sim.final.duration,
                summary: sim.final.summary,
                details: sim.final.details,
              }
            : l
        )
      );
      setOutputArtifacts(getOutputArtifacts(tool.id));
      setActiveTab("output");
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    }, lastStepDelay + 2000);
  };

  const handleRetry = (failedLog: ToolRunLog) => {
    setIsRunning(true);
    setActiveTab("logs");

    // Remove the original failed entry and replace with a running retry
    const retryLog: ToolRunLog = {
      id: `retry-${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: "running",
      duration: "0s...",
      summary: `Retrying with Stealth + Proxy rotation...`,
    };
    setRunLogs((prev) =>
      [retryLog, ...prev.filter((l) => l.id !== failedLog.id)]
    );

    setTimeout(() => {
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === retryLog.id
            ? { ...l, summary: "Stealth fingerprint applied — rotating to new residential proxy...", duration: "6s..." }
            : l
        )
      );
    }, 2000);

    setTimeout(() => {
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === retryLog.id
            ? { ...l, summary: "Cloudflare challenge detected → solving with stealth bypass...", duration: "14s..." }
            : l
        )
      );
    }, 4000);

    setTimeout(() => {
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === retryLog.id
            ? { ...l, summary: "Cloudflare passed ✓ — scraping page content...", duration: "22s..." }
            : l
        )
      );
    }, 6000);

    setTimeout(() => {
      setIsRunning(false);
      setRunLogs((prev) =>
        prev.map((l) =>
          l.id === retryLog.id
            ? {
                ...l,
                status: "success" as const,
                duration: "1m 38s",
                summary: "Retry succeeded — Cloudflare bypassed with stealth mode + proxy rotation",
                details: [
                  "Stealth mode: Anti-detect fingerprint applied (Chrome 122, macOS)",
                  "Proxy: Rotated to residential IP (new region)",
                  "Cloudflare challenge detected → auto-solved in 2.1s",
                  "Page fully loaded and scraped ✓",
                  "Claude Vision analysis complete — 89% CTA confidence",
                  "Generated 1 LP variant + 1 video asset",
                ],
              }
            : l
        )
      );
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    }, 8000);
  };

  const handleStop = () => {
    setIsRunning(false);
    setRunLogs((prev) =>
      prev.map((l) =>
        l.status === "running"
          ? { ...l, status: "error" as const, summary: "Run cancelled by user", duration: l.duration.replace("...", "") }
          : l
      )
    );
  };

  const handleSaveConfig = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div>
      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg bg-brand-green text-white text-[13px] font-medium shadow-lg animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4" />
          Operation completed successfully
        </div>
      )}

      {/* Back button + Header */}
      <div className="mb-6">
        <Link
          href="/tools"
          className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-brand-blue transition-colors mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Tools
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${tool.color}15` }}
            >
              <Icon className="w-7 h-7" style={{ color: tool.color }} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[20px] md:text-[24px] font-semibold">
                  {tool.name}
                </h1>
                <span
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `${status.color}15`,
                    color: status.color,
                  }}
                >
                  {status.label}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-medium text-text-muted uppercase tracking-wide">
                  Blueprint {tool.blueprint}
                </span>
              </div>
              <p className="text-[13px] text-text-secondary mt-1.5 max-w-2xl leading-relaxed">
                {tool.longDescription}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="px-2.5 py-1 rounded-lg bg-surface text-[11px] font-medium text-text-muted border border-border">
                  {category}
                </span>
                {tool.techStack.map((tech) => (
                  <span
                    key={tech}
                    className="px-2 py-0.5 rounded-md bg-surface text-[10px] text-text-muted font-medium border border-border"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isRunning ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 transition-colors"
              >
                <Square className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleRun}
                disabled={tool.status === "development"}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-blue text-white text-[13px] font-medium hover:bg-brand-blue-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="w-4 h-4" />
                Run Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Metrics bar */}
      {tool.metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {tool.metrics.map((m) => (
            <div
              key={m.label}
              className="bg-surface-raised rounded-xl border border-border p-4"
            >
              <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
                {m.label}
              </div>
              <div className="text-[22px] font-semibold">{m.value}</div>
            </div>
          ))}
          <div className="bg-surface-raised rounded-xl border border-border p-4">
            <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
              Schedule
            </div>
            <div className="text-[14px] font-semibold">{tool.schedule}</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              Next: {tool.nextRun}
            </div>
          </div>
          <div className="bg-surface-raised rounded-xl border border-border p-4">
            <div className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
              Last Run
            </div>
            <div className="text-[14px] font-semibold">{tool.lastRun}</div>
            <div className="text-[11px] text-text-muted mt-0.5">
              {runLogs[0]?.duration || "—"}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        {(
          [
            { id: "config", label: "Configuration", icon: Settings2 },
            { id: "logs", label: "Run History", icon: Activity },
            { id: "schedule", label: "Schedule", icon: Calendar },
            { id: "output", label: "Output", icon: Package },
          ] as const
        ).map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-brand-blue text-brand-blue"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <TabIcon className="w-4 h-4" />
              {tab.label}
              {tab.id === "logs" && runLogs.some((l) => l.status === "running") && (
                <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "config" && (
        <div className="bg-surface-raised rounded-xl border border-border p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-semibold">Tool Configuration</h2>
            <button
              onClick={handleSaveConfig}
              className="px-4 py-2 rounded-lg bg-brand-blue text-white text-[12px] font-medium hover:bg-brand-blue-dark transition-colors"
            >
              Save Configuration
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {tool.configFields.map((field) => (
              <div
                key={field.id}
                className={
                  field.type === "textarea" ? "md:col-span-2" : ""
                }
              >
                <ConfigFieldInput
                  field={field}
                  value={config[field.id] ?? ""}
                  onChange={(val) =>
                    setConfig((prev) => ({ ...prev, [field.id]: val }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-3">
          {runLogs.length === 0 ? (
            <div className="bg-surface-raised rounded-xl border border-border p-12 text-center">
              <Clock className="w-8 h-8 text-text-muted mx-auto mb-3" />
              <p className="text-[14px] text-text-muted">
                No runs yet. Configure the tool and click Run Now.
              </p>
            </div>
          ) : (
            runLogs.map((log) => {
              const LogIcon = statusIconMap[log.status] || Clock;
              const logColor = statusColorMap[log.status] || "#6B7280";
              const isExpanded = expandedLog === log.id;

              return (
                <div
                  key={log.id}
                  className="bg-surface-raised rounded-xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedLog(isExpanded ? null : log.id)
                    }
                    className="w-full p-4 md:p-5 text-left hover:bg-surface/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: `${logColor}15` }}
                        >
                          <LogIcon
                            className={`w-4 h-4 ${
                              log.status === "running" ? "animate-spin" : ""
                            }`}
                            style={{ color: logColor }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium leading-snug">
                            {log.summary}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-[11px] text-text-muted">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                            <span
                              className="text-[11px] font-medium"
                              style={{ color: logColor }}
                            >
                              {log.status === "running"
                                ? "Running"
                                : log.status === "queued"
                                  ? "Queued"
                                  : log.status === "error"
                                    ? "Failed"
                                    : "Completed"}
                            </span>
                            <span className="text-[11px] text-text-muted">
                              Duration: {log.duration}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {log.status === "error" && !isRunning && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRetry(log);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium hover:bg-amber-100 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Retry with Stealth
                          </button>
                        )}
                        {log.details && (
                          <>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-text-muted" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-text-muted" />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  {isExpanded && log.details && (
                    <div className="px-5 pb-5 pt-0">
                      <div className="bg-gray-50 rounded-lg p-4 border border-border">
                        <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide mb-2">
                          Execution Details
                        </p>
                        <div className="space-y-1.5">
                          {log.details.map((detail, i) => (
                            <div
                              key={i}
                              className={`flex items-start gap-2 text-[12px] ${
                                detail.startsWith("⚠")
                                  ? "text-amber-700 bg-amber-50 -mx-2 px-2 py-1 rounded-md border border-amber-200"
                                  : "text-text-secondary"
                              }`}
                            >
                              <span className="text-text-muted shrink-0 font-mono text-[10px] mt-0.5">
                                {String(i + 1).padStart(2, "0")}
                              </span>
                              <span className="font-mono">{detail}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="bg-surface-raised rounded-xl border border-border p-5 md:p-6">
          <h2 className="text-[16px] font-semibold mb-5">Run Schedule</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Schedule Type
              </label>
              <select
                defaultValue={tool.schedule?.includes("Daily") ? "daily" : tool.schedule?.includes("Weekly") ? "weekly" : tool.schedule?.includes("Every") ? "interval" : "manual"}
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50"
              >
                <option value="manual">Manual (Run on demand)</option>
                <option value="interval">Interval (Every X hours)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="cron">Custom Cron Expression</option>
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Run Time
              </label>
              <input
                type="time"
                defaultValue="08:00"
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50"
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Timezone
              </label>
              <select
                defaultValue="America/Chicago"
                className="w-full px-3 py-2.5 rounded-lg bg-white border border-border text-[13px] focus:outline-none focus:border-brand-blue/50"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="block text-[12px] font-medium text-text-secondary">
                  Send Notification on Completion
                </label>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Get notified via email/Slack when a run finishes.
                </p>
              </div>
              <button
                type="button"
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-brand-blue transition-colors"
              >
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6 shadow-sm" />
              </button>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <label className="block text-[12px] font-medium text-text-secondary">
                  Retry on Failure
                </label>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Automatically retry up to 2 times if a run fails.
                </p>
              </div>
              <button
                type="button"
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors"
              >
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1 shadow-sm" />
              </button>
            </div>
            <div className="pt-2">
              <button className="px-4 py-2 rounded-lg bg-brand-blue text-white text-[12px] font-medium hover:bg-brand-blue-dark transition-colors">
                Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "output" && (
        <div className="bg-surface-raised rounded-xl border border-border p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[16px] font-semibold">Output Artifacts</h2>
            {outputArtifacts.length > 0 && (
              <span className="text-[11px] text-text-muted bg-surface-overlay px-2 py-1 rounded-full">
                {outputArtifacts.length} items
              </span>
            )}
          </div>

          {outputArtifacts.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
              <p className="text-[13px] text-text-muted">No output yet.</p>
              <p className="text-[11px] text-text-muted mt-1">
                Run the tool to generate output artifacts.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {outputArtifacts.map((artifact) => {
                const ArtifactIcon = outputIconMap[artifact.icon] || Package;
                return (
                  <div
                    key={artifact.id}
                    className="bg-surface-overlay rounded-lg border border-border p-4 hover:border-brand-blue/40 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                        <ArtifactIcon className="w-4 h-4 text-brand-blue" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-text-primary truncate">
                          {artifact.label}
                        </p>
                        {artifact.filename && (
                          <p className="text-[11px] text-text-muted mt-0.5 font-mono truncate">
                            {artifact.filename}
                          </p>
                        )}
                        {artifact.size && (
                          <p className="text-[10px] text-text-muted mt-0.5">
                            {artifact.size}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/60">
                      {artifact.type === "file" && (
                        <button
                          onClick={() => handleDownload(artifact)}
                          className="flex items-center gap-1.5 text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      )}
                      {artifact.type === "link" && artifact.url && (
                        <button
                          onClick={() => window.open(artifact.url, "_blank")}
                          className="flex items-center gap-1.5 text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open
                        </button>
                      )}
                      {artifact.type === "code" && artifact.previewContent && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(artifact.previewContent || "");
                          }}
                          className="flex items-center gap-1.5 text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </button>
                      )}
                      {(artifact.type === "code" || artifact.type === "preview") && (artifact.downloadContent || artifact.previewContent) && (
                        <button
                          onClick={() => handleDownload(artifact)}
                          className="flex items-center gap-1.5 text-[11px] text-brand-blue hover:text-brand-blue-dark font-medium transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      )}
                      {artifact.previewContent && (
                        <button
                          onClick={() => setPreviewArtifact(artifact)}
                          className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary font-medium transition-colors ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewArtifact && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setPreviewArtifact(null)}
        >
          <div
            className="bg-surface-raised rounded-xl border border-border w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                {(() => {
                  const ModalIcon = outputIconMap[previewArtifact.icon] || Package;
                  return <ModalIcon className="w-4 h-4 text-brand-blue" />;
                })()}
                <h3 className="text-[14px] font-semibold">{previewArtifact.label}</h3>
              </div>
              <div className="flex items-center gap-2">
                {previewArtifact.previewContent && (
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(previewArtifact.previewContent || "")
                    }
                    className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary px-2 py-1 rounded-md hover:bg-surface-overlay transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                )}
                <button
                  onClick={() => setPreviewArtifact(null)}
                  className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-surface-overlay transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <pre className="text-[12px] leading-relaxed text-text-secondary font-mono whitespace-pre-wrap bg-surface-overlay rounded-lg p-4 border border-border/60">
                {previewArtifact.previewContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
