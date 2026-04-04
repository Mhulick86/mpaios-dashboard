"use client";

import { useRef } from "react";
import {
  Cpu,
  Server,
  Rocket,
  BarChart3,
  Users,
  Zap,
  Shield,
  TrendingUp,
  Clock,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  Monitor,
  Database,
  Layers,
  Globe,
  Brain,
  Target,
  PieChart,
  Workflow,
  Lock,
  ChevronDown,
  Play,
  Quote,
  Star,
  Link2,
  Gauge,
  HardDrive,
} from "lucide-react";

/* ============================================================
   Marketing Powered — Internal Pitch Deck (Web Version)
   ============================================================ */

export default function PitchPage() {
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div className="min-h-screen bg-white text-gray-900 -m-4 md:-m-8 -mt-16 md:-mt-8">
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-50">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 pt-12 pb-20">
          <div className="flex items-center justify-between mb-16">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xl font-black tracking-tight leading-none">
                  marketing
                </div>
                <div className="text-xl font-black tracking-tight leading-none">
                  powered
                </div>
              </div>
            </div>
            <span className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-[11px] font-mono uppercase tracking-widest text-gray-500">
              <Lock className="w-3 h-3" /> Internal Infrastructure Only
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black leading-[0.95] tracking-tight max-w-3xl">
            The World&apos;s Most Powerful{" "}
            <span className="text-cyan-500">Marketing OS</span>
          </h1>

          <div className="w-16 h-1 bg-cyan-500 mt-6 mb-8 rounded-full" />

          <p className="text-lg sm:text-xl text-gray-500 max-w-2xl leading-relaxed">
            Sovereign infrastructure running 1T+ parameter models locally. Zero
            latency. Absolute data privacy. Built on Mac Studio M3 Ultra
            clusters.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 max-w-3xl">
            <StatCard
              label="COMPUTE POWER"
              value="2TB Memory"
              sub="1T+ Param Models"
              detail="Mac Studio M3 Ultra Cluster"
              icon={<Cpu className="w-5 h-5 text-gray-400" />}
            />
            <StatCard
              label="NODE CONFIG"
              value="512GB / Node"
              sub="16TB SSD Per Node"
              detail="4-Node Configuration"
              icon={<Server className="w-5 h-5 text-gray-400" />}
            />
            <StatCard
              label="PERFORMANCE"
              value="10x Force"
              sub="Multiplier"
              detail="Sub-2s Inference · Zero Cloud"
              icon={<Rocket className="w-5 h-5 text-cyan-500" />}
              accent
            />
          </div>
        </div>

        <div className="flex justify-center pb-8">
          <ChevronDown className="w-6 h-6 text-gray-300 animate-bounce" />
        </div>
      </section>

      {/* ===== VIDEO DEMO ===== */}
      <section className="bg-gray-900 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <SectionLabel dark>Live Demo</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-black text-white mt-4">
              See the OS in Action
            </h2>
            <p className="text-gray-400 mt-3 max-w-xl mx-auto">
              Watch how 24 AI agents coordinate a full-service marketing
              operation from a single command center.
            </p>
          </div>
          <div className="relative rounded-2xl overflow-hidden border border-gray-700 shadow-2xl">
            <video
              ref={videoRef}
              controls
              playsInline
              className="w-full aspect-video bg-black"
              poster=""
            >
              <source src="/demo-video.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      </section>

      {/* ===== PROBLEM / SOLUTION ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16">
            {/* Problem */}
            <div>
              <SectionLabel muted>Traditional Model</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-black mt-4 leading-tight">
                <span className="text-gray-400">Linear Scaling &</span>
                <br />
                Manual Bottlenecks
              </h2>
              <div className="mt-10 space-y-6">
                <ProblemItem
                  title="Manual Workflow Dependency"
                  desc="Client delivery speed is capped by human hours. Reporting, QA, and optimizations consume 30%+ of billable time."
                />
                <ProblemItem
                  title="Fragile SaaS Ecosystem"
                  desc="Reliant on fragmented 3rd-party APIs (Zapier/Make) that break, leak data, and introduce latency."
                />
                <ProblemItem
                  title="Expensive Headcount"
                  desc="Scaling requires hiring more juniors for rote tasks, eroding margins and increasing management overhead."
                />
                <ProblemItem
                  title="Slow Feedback Loops"
                  desc="Campaign learnings are manually analyzed weekly, missing real-time optimization windows."
                />
              </div>
            </div>

            {/* Solution */}
            <div>
              <SectionLabel>Our Infrastructure Advantage</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-black mt-4 leading-tight">
                Sovereign AI
                <br />
                <span className="text-cyan-500">Workflow OS</span>
              </h2>
              <div className="mt-10">
                <BrowserMockup url="ui-iota-rust.vercel.app/dashboard">
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-bold text-sm">Command Center</div>
                        <div className="text-[10px] text-gray-400">
                          Orchestrator Online · v2.4.0
                        </div>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-1 bg-green-50 text-green-600 rounded-full border border-green-200">
                        Agent 15 Active
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <MiniStat label="ACTIVE AGENTS" value="24" />
                      <MiniStat label="CAMPAIGNS" value="8" color="green" />
                      <MiniStat label="REVENUE" value="$316k" color="green" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <ActionCard
                        icon={<Zap className="w-4 h-4 text-cyan-500" />}
                        title="Launch Campaign"
                        sub="Full automated setup"
                      />
                      <ActionCard
                        icon={<Users className="w-4 h-4 text-cyan-500" />}
                        title="Onboard Client"
                        sub="Discovery pipeline"
                      />
                      <ActionCard
                        icon={<TrendingUp className="w-4 h-4 text-cyan-500" />}
                        title="Optimize Performance"
                        sub="AI audit cycle"
                      />
                      <ActionCard
                        icon={<Layers className="w-4 h-4 text-cyan-500" />}
                        title="Content Engine"
                        sub="Generate assets"
                      />
                    </div>
                  </div>
                </BrowserMockup>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INFRASTRUCTURE ===== */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-cyan-50 text-cyan-600 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider border border-cyan-100">
              <Cpu className="w-3.5 h-3.5" /> 2TB Unified Memory → 1T+ Param
              Models
            </span>
          </div>
          <SectionLabel>Sovereign Infrastructure</SectionLabel>
          <h2 className="text-3xl sm:text-5xl font-black mt-4 leading-tight max-w-2xl">
            1 Trillion+ Parameter
            <br />
            <span className="text-cyan-500">Local Inference Cluster</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-2xl text-lg">
            Combined 2TB unified memory across the cluster enables hosting 1T+
            parameter models locally — no cloud vendor required. Marketing
            Powered runs on 4 clustered Apple Mac Studio M3 Ultra nodes.
          </p>

          <div className="grid md:grid-cols-2 gap-12 mt-16">
            <div className="space-y-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <Server className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Massive Model Capacity</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    4x Mac Studio nodes (512GB each) pooled via
                    Thunderbolt/10GbE to load Llama-3-400B+ and other frontier
                    models entirely in RAM.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
                  <HardDrive className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">
                    200TB+ NVMe Asset Library
                  </h3>
                  <p className="text-gray-500 text-sm mt-1">
                    Instant-access storage with 16TB SSD per Mac Studio node. No
                    cloud egress fees, no download wait times.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                    TOTAL CLUSTER MEMORY
                  </div>
                  <div className="text-2xl font-black">
                    2TB{" "}
                    <span className="text-sm text-cyan-500 font-medium">
                      Unified
                    </span>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                    NODE CONFIG
                  </div>
                  <div className="text-2xl font-black">
                    4{" "}
                    <span className="text-sm text-gray-400 font-medium">
                      x 512GB
                    </span>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl p-4 bg-white">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                    MAX MODEL SIZE
                  </div>
                  <div className="text-2xl font-black text-cyan-500">
                    1T+ Params
                  </div>
                </div>
              </div>
            </div>

            {/* Cluster Diagram */}
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <div className="text-center mb-6">
                <div className="w-10 h-10 bg-gray-900 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
                  Cluster M3-Ultra x4
                </div>
              </div>
              <div className="relative">
                {/* 10GbE Switch */}
                <div className="bg-gray-900 text-white rounded-lg px-4 py-3 text-center mx-auto max-w-[200px] mb-6">
                  <div className="text-[10px] font-mono uppercase tracking-wider">
                    10GbE SWITCH
                  </div>
                </div>
                {/* Nodes */}
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="border border-green-200 rounded-xl p-4 bg-green-50/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold">
                          MAC STUDIO 0{n}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-500">
                          512GB
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 rounded-full"
                          style={{ width: `${55 + n * 8}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        MEM: {380 + n * 30}GB
                      </div>
                    </div>
                  ))}
                </div>
                {/* NVMe */}
                <div className="mt-4 bg-cyan-50 border border-cyan-200 rounded-xl p-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-600">
                    NVMe ARRAY MAIN
                  </span>
                  <span className="text-[10px] font-mono text-cyan-500">
                    200TB+
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 6 AGENT DIVISIONS ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <SectionLabel>Internal Capacity & Infrastructure</SectionLabel>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-4">
            <div>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight">
                6 Specialist Agent Divisions
              </h2>
              <p className="text-gray-500 mt-2">
                Sovereign Capacity for High-Volume Workflow
              </p>
            </div>
            <div className="flex gap-3">
              <MetricBadge label="INFERENCE" value="< 1.9s" />
              <MetricBadge label="THROUGHPUT" value="2.5K+" accent />
              <MetricBadge label="MULTIPLIER" value="10x" accent />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12">
            <DivisionCard
              num="01"
              icon={<BarChart3 className="w-5 h-5 text-cyan-500" />}
              title="Strategy & Intelligence"
              desc="Competitor deep-dives, campaign roadmaps, market positioning."
            />
            <DivisionCard
              num="02"
              icon={<Layers className="w-5 h-5 text-orange-500" />}
              title="Content & Creative"
              desc="High-vol articles, dynamic ad creative, landing page copy."
            />
            <DivisionCard
              num="03"
              icon={<Target className="w-5 h-5 text-red-500" />}
              title="Paid Media Operations"
              desc="Budget pacing, bid adjustments, auto-pause logic."
            />
            <DivisionCard
              num="04"
              icon={<Globe className="w-5 h-5 text-green-500" />}
              title="Organic & Authority"
              desc="SEO optimization, sentiment radar, reputation monitoring."
            />
            <DivisionCard
              num="05"
              icon={<PieChart className="w-5 h-5 text-blue-500" />}
              title="Analytics & Ops"
              desc="Attribution reporting, CRO tests, compliance QA."
            />
            <DivisionCard
              num="06"
              icon={<Monitor className="w-5 h-5 text-gray-500" />}
              title="Infrastructure"
              desc="Workflow routing, local memory, sovereign data handling."
            />
          </div>

          {/* Agent Table */}
          <div className="mt-12 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left py-3 px-4 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Agent Division
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Status
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Active Nodes
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Efficiency
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Current Process
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AgentRow
                    name="Strategy & Intelligence"
                    status="Online"
                    nodes="3 Agents"
                    eff="91%"
                    process="Generating competitor analysis for Client_ID_882"
                  />
                  <AgentRow
                    name="Content & Creative"
                    status="Processing"
                    statusColor="orange"
                    nodes="5 Agents"
                    eff="91%"
                    process="Rendering 4k video assets for campaign launch"
                  />
                  <AgentRow
                    name="Paid Media Ops"
                    status="Online"
                    nodes="3 Agents"
                    eff="93%"
                    process="Optimizing bid strategy (Meta/Google)"
                  />
                  <AgentRow
                    name="Organic & Authority"
                    status="Online"
                    nodes="5 Agents"
                    eff="93%"
                    process="Indexing 45 new pages to Search Console"
                  />
                  <AgentRow
                    name="Ops & Infrastructure"
                    status="Online"
                    nodes="2 Agents"
                    eff="94%"
                    process="System check: 200TB Storage Integrity OK"
                  />
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                System Healthy · Latency: 12ms
              </div>
              <span>Agent 15 Orchestrator Active</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== MARGIN PREDICTIONS ===== */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <SectionLabel>Internal Economics</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-black mt-4">
                Margin Predictions{" "}
                <span className="text-gray-400 font-normal text-xl">
                  | Force Multiplier Analysis
                </span>
              </h2>
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 text-[11px] font-mono">
              <Monitor className="w-3.5 h-3.5" /> Model: Q2 2026 Forecast
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            <KPICard
              label="TARGET NET MARGIN"
              value="65%"
              sub="vs 20-30% Industry Avg"
              color="cyan"
            />
            <KPICard
              label="EMPLOYEE EFFICIENCY"
              value="10.5x"
              sub="Output per Human FTE"
              color="green"
            />
            <KPICard
              label="OPEX REDUCTION"
              value="-72%"
              sub="Labor & Tool Consolidation"
              color="gray"
            />
            <KPICard
              label="CLIENT BREAK-EVEN"
              value="Day 4"
              sub="Previously Day 45"
              color="green"
            />
          </div>

          {/* Unit Economics Table */}
          <div className="mt-12 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold">
                Unit Economics: Traditional vs. AI-Native
              </h3>
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 border border-gray-200 px-2 py-1 rounded">
                Cost Per Output Unit
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left py-3 px-6 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Metric
                    </th>
                    <th className="text-left py-3 px-6 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Traditional Agency
                    </th>
                    <th className="text-left py-3 px-6 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Marketing Powered OS
                    </th>
                    <th className="text-left py-3 px-6 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Advantage
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <EconRow
                    metric="SEO Article"
                    trad="$350 - $600"
                    mp="$12.50"
                    adv="28x Lower"
                  />
                  <EconRow
                    metric="Campaign Launch"
                    trad="40 Hours ($4K)"
                    mp="2 Hours ($200)"
                    adv="20x Faster"
                  />
                  <EconRow
                    metric="Weekly Reporting"
                    trad="5 Hours/Client"
                    mp="Automated"
                    adv="Infinite Scale"
                  />
                  <EconRow
                    metric="Comp. Analysis"
                    trad="$1,500 One-off"
                    mp="Continuous"
                    adv="Always On"
                  />
                  <EconRow
                    metric="Staff Ratio"
                    trad="1 FTE : 4 Clients"
                    mp="1 FTE : 25 Clients"
                    adv="6x Capacity"
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Headcount Avoidance */}
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2">
                Headcount Avoidance
              </div>
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Traditional</div>
                  <div className="flex gap-1">
                    {[...Array(6)].map((_, i) => (
                      <Users key={i} className="w-4 h-4 text-gray-300" />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-cyan-500 mb-1">Powered OS</div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4 text-cyan-500" />
                    <span className="text-[10px] text-gray-400">
                      +24 Agents
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <span className="text-lg font-black text-green-500">
                Saving $850k/yr
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CLIENT ACQUISITION ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div>
              <SectionLabel>Strategic Planning</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-black mt-4">
                Client Acquisition Trajectory
              </h2>
              <p className="text-gray-500 mt-2 max-w-lg">
                Leveraging AI capacity to scale from 5 to 50 clients in 24
                months with linear headcount growth.
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                Projected Growth (24 Mo)
              </div>
              <div className="text-4xl font-black text-green-500 flex items-center gap-2 justify-end mt-1">
                <TrendingUp className="w-8 h-8" /> 900%
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <GrowthCard
              period="Q1 2026"
              label="CURRENT STATE"
              clients={5}
              desc="Foundation built. Core OS active. Sovereign hardware deployed."
            />
            <GrowthCard
              period="Q1 2027"
              label="12-MO TARGET"
              clients={25}
              desc="400% Capacity Scale"
              accent
            />
            <GrowthCard
              period="Q1 2028"
              label="24-MO VISION"
              clients={50}
              desc="900% Total Growth"
              accent
            />
          </div>
        </div>
      </section>

      {/* ===== PLATFORM CONNECTIVITY ===== */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <SectionLabel>Workflow & Connectivity</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-black mt-4">
                Platform Connectivity Engine
              </h2>
              <p className="text-gray-500 mt-2 max-w-xl">
                Unified orchestration layer syncing data, budget, and strategy
                across 10+ major ad networks.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 text-sm font-medium">
              <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                Live Sync
              </span>{" "}
              10 Platforms Connected
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <BrowserMockup url="ui-iota-rust.vercel.app/automations/active">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-[10px] font-mono uppercase tracking-wider font-bold">
                    Automation Blueprints
                  </div>
                  <span className="text-[10px] text-green-600">
                    · Active
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <AutoCard
                    title="VIBE MARKETING FUNNEL"
                    status="RUNNING"
                    color="blue"
                    value="148"
                    metric="Pages Optimized"
                  />
                  <AutoCard
                    title="GTM AD BIDDING"
                    status="OPTIMIZED"
                    color="green"
                    value="4.2x"
                    metric="Avg ROAS"
                  />
                  <AutoCard
                    title="SEO CONTENT"
                    status="GEN"
                    color="purple"
                    value=""
                    metric=""
                  />
                  <AutoCard
                    title="ASANA SYNC"
                    status="SYNC"
                    color="orange"
                    value=""
                    metric=""
                  />
                </div>
              </div>
            </BrowserMockup>

            {/* Connected Platforms */}
            <div className="flex flex-col justify-center">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-cyan-50 border-2 border-cyan-200 rounded-full flex items-center justify-center mx-auto">
                  <Zap className="w-8 h-8 text-gray-900" />
                </div>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  "Meta",
                  "Instagram",
                  "TikTok",
                  "Google Ads",
                  "LinkedIn",
                  "Snapchat",
                  "Pinterest",
                  "X",
                  "YouTube",
                  "Facebook Ads",
                ].map((p) => (
                  <span
                    key={p}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div className="flex justify-center gap-4 mt-8">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                  <Zap className="w-3 h-3 text-green-500" /> Real-Time API Sync
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                  <DollarSign className="w-3 h-3 text-green-500" /> Auto-Budget
                  Allocation
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
                  <BarChart3 className="w-3 h-3 text-green-500" />{" "}
                  Cross-Platform Analytics
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== INTEGRATIONS & SOVEREIGN STACK ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <SectionLabel>Internal Infrastructure</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-black mt-4">
                Integrations & Sovereign Stack
              </h2>
            </div>
            <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 text-[11px]">
              <span className="w-2 h-2 bg-green-400 rounded-full" /> Sovereign
              Hardware: Online
            </span>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {/* Integration Hub */}
            <div className="border-2 border-dashed border-cyan-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Link2 className="w-5 h-5 text-cyan-500" />
                <h3 className="font-bold text-lg">Integration Hub</h3>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">
                Active Connections
              </div>
              <div className="space-y-3 mb-6">
                <IntegrationItem name="Asana" sub="2-Way Sync" live />
                <IntegrationItem
                  name="Google Analytics 4"
                  sub="Data Stream"
                  live
                />
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">
                10+ Marketing Platforms Connected
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "Meta",
                  "Insta",
                  "TikTok",
                  "Ads",
                  "Linkd",
                  "Snap",
                  "Pin",
                  "X",
                  "YT",
                  "FB Ads",
                ].map((p) => (
                  <span
                    key={p}
                    className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-[9px] font-bold text-gray-500"
                  >
                    {p}
                  </span>
                ))}
              </div>
              <div className="mt-4 text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2">
                Upcoming Pipeline
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs font-medium">HubSpot CRM</span>
                <span className="text-[10px] text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded">
                  Q3
                </span>
              </div>
            </div>

            {/* Sovereign Models */}
            <div className="border-2 border-dashed border-cyan-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Brain className="w-5 h-5 text-cyan-500" />
                <h3 className="font-bold text-lg">Sovereign Models</h3>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-green-500 mb-3">
                Primary: Local & Private
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Local LLM Host</span>
                  <Shield className="w-4 h-4 text-green-500" />
                </div>
                <div className="text-xs text-gray-400 mb-2">
                  Zero data egress. 100% internal.
                </div>
                <div className="flex gap-2">
                  <Tag>Llama 3 70B</Tag>
                  <Tag>Mixtral 8x7B</Tag>
                  <Tag>Ollama</Tag>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <span className="font-medium text-sm">Custom Endpoints</span>
                <div className="flex gap-2 mt-2">
                  <Tag>LM Studio</Tag>
                  <Tag>vLLM</Tag>
                  <Tag>LocalAI</Tag>
                </div>
              </div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-3">
                Fallback: External API
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">Public Models</span>
                  <span className="text-[9px] font-mono text-gray-400">
                    ANONYMIZED
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <Tag>GPT-4o</Tag>
                  <Tag>Claude 3.5</Tag>
                  <Tag>Perplexity</Tag>
                </div>
              </div>
            </div>

            {/* Infrastructure */}
            <div className="border border-gray-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <Database className="w-5 h-5 text-gray-500" />
                <h3 className="font-bold text-lg">Infrastructure</h3>
              </div>
              <p className="text-gray-500 text-sm mb-6">
                Our OS runs on self-hosted, sovereign hardware. We own the
                compute, storage, and intelligence.
              </p>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Zero
                  external dependencies
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Full data
                  sovereignty
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" /> Custom
                  internal APIs
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <Database className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <div className="text-2xl font-black">200TB+</div>
                <div className="text-xs text-gray-400">
                  Local NVMe Storage
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== PROVEN IMPACT ===== */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="w-10 h-0.5 bg-cyan-500 mb-4" />
              <h2 className="text-3xl sm:text-4xl font-black">
                Proven Impact & Results
              </h2>
              <p className="text-gray-500 mt-2 max-w-xl">
                Real-world performance metrics from active client deployments
                demonstrating massive efficiency gains.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-200 bg-green-50 text-[11px] text-green-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Verified Data: Q1 2026
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <ResultCard
              icon={<Clock className="w-5 h-5 text-gray-400" />}
              value="90%"
              label="TIME REDUCTION"
              before="Manual: 120 hrs/mo"
              after="AI-Assisted: 12 hrs/mo"
              badge="108 Hours Saved"
              badgeColor="green"
            />
            <ResultCard
              icon={<Rocket className="w-5 h-5 text-green-500" />}
              value="85%"
              label="FASTER LAUNCH"
              before="Traditional: 2 Weeks"
              after="OS Powered: 2 Days"
              badge="rapid deployment"
              badgeColor="green"
            />
            <ResultCard
              icon={<DollarSign className="w-5 h-5 text-white" />}
              value="$180k"
              label="ANNUAL SAVINGS"
              before="Staffing costs avoided per"
              after="client pod"
              badge="Immediate ROI"
              badgeColor="cyan"
              dark
            />

            {/* Testimonial + Zero Churn */}
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <Quote className="w-5 h-5 text-cyan-500 mb-3" />
                <p className="text-sm italic text-gray-600 leading-relaxed">
                  &quot;The velocity is unmatched. We launched 5 full-funnel
                  campaigns in the time it used to take to brief a single
                  creative concept. The sovereign data aspect was the closer for
                  our legal team.&quot;
                </p>
                <div className="flex items-center gap-3 mt-4">
                  <div className="w-8 h-8 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center text-xs font-bold">
                    SC
                  </div>
                  <div>
                    <div className="text-sm font-bold">Sarah Chen</div>
                    <div className="text-xs text-gray-400">
                      CMO, TechFlow SaaS
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center">
                <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="text-lg font-black">Zero Churn</div>
                <div className="text-xs text-gray-400 mt-1">
                  100% Client Retention Rate since OS
                  <br />
                  implementation in Q1 2024
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== COMPETITIVE ADVANTAGE ===== */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <SectionLabel>Strategic Analysis</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-black mt-4">
                Competitive Advantage
              </h2>
              <p className="text-gray-500 mt-2">
                Why sovereign infrastructure outperforms traditional cloud
                dependencies in the AI era.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 text-white text-sm font-bold">
              <Shield className="w-4 h-4" /> Sovereign Advantage
            </span>
          </div>

          <div className="mt-12 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left py-3 px-6 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Core Capability
                    </th>
                    <th className="text-left py-3 px-6 text-[10px] font-mono uppercase tracking-wider text-cyan-500">
                      <Zap className="w-3 h-3 inline mr-1" /> Marketing Powered
                    </th>
                    <th className="text-left py-3 px-6 text-[10px] font-mono uppercase tracking-wider text-gray-400">
                      Public Cloud/SaaS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <CompRow
                    cap="Data Sovereignty"
                    sub="Privacy & Ownership"
                    mp="100% Local & Private"
                    cloud="Vendor Access"
                  />
                  <CompRow
                    cap="Cost Structure"
                    sub="Scale Economics"
                    mp="Fixed CapEx (Flat)"
                    cloud="Variable OpEx (High)"
                  />
                  <CompRow
                    cap="Inference Latency"
                    sub="Speed to Output"
                    mp="Sub-2 Seconds"
                    cloud="500ms - 5s+ API"
                  />
                  <CompRow
                    cap="Model Control"
                    sub="Fine-tuning & LoRAs"
                    mp="Unlimited / Custom"
                    cloud="Restricted / Generic"
                  />
                  <CompRow
                    cap="Vendor Lock-in"
                    sub="Platform Dependency"
                    mp="Zero Dependency"
                    cloud="Total Dependence"
                  />
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <div className="bg-gray-50 rounded-2xl p-6 text-center">
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                <Gauge className="w-3.5 h-3.5 inline mr-1 text-cyan-500" />{" "}
                Throughput
              </div>
              <div className="text-3xl font-black">No Limits</div>
              <div className="text-xs text-gray-400">Zero Rate Limiting</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-6 text-center">
              <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-1">
                <Rocket className="w-3.5 h-3.5 inline mr-1 text-green-500" />{" "}
                Marginal Cost
              </div>
              <div className="text-3xl font-black">$0.00</div>
              <div className="text-xs text-gray-400">
                Per Additional Token
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== ROADMAP ===== */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <SectionLabel>Future State</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-black mt-4">
                Roadmap & Vision
              </h2>
              <p className="text-gray-500 mt-2 max-w-xl">
                Continuous platform evolution focusing on autonomous multi-modal
                agents and enterprise-grade scalability.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 text-[11px] font-mono">
              <Rocket className="w-3.5 h-3.5 text-green-500" /> Strategic
              Horizon: 2026-2027
            </span>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
            <RoadmapCard
              quarter="Q2 2026"
              items={[
                { icon: <Link2 className="w-4 h-4" />, title: "New Integrations", sub: "Reddit Ads & Bing Ads API" },
                { icon: <Play className="w-4 h-4" />, title: "Voice Cloning", sub: "Enhanced synthesis for video" },
              ]}
            />
            <RoadmapCard
              quarter="Q3 2026"
              items={[
                { icon: <Layers className="w-4 h-4" />, title: "Multi-Modal Agents", sub: "Native image + text generation" },
                { icon: <Target className="w-4 h-4" />, title: "Competitor Intel", sub: "Real-time tracking dashboard" },
              ]}
            />
            <RoadmapCard
              quarter="Q4 2026"
              items={[
                { icon: <DollarSign className="w-4 h-4" />, title: "Predictive Budget", sub: "AI allocation optimization" },
                { icon: <Users className="w-4 h-4" />, title: "Client Portal", sub: "Self-service analytics access" },
              ]}
            />
            <RoadmapCard
              quarter="2027 VISION"
              accent
              items={[
                { icon: <Globe className="w-4 h-4" />, title: "Massive Scale", sub: "100+ Client Capacity" },
                { icon: <Monitor className="w-4 h-4" />, title: "White-Label", sub: "Enterprise Licensing Model" },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ===== CTA / FOOTER ===== */}
      <section className="py-24 bg-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-50 text-cyan-600 rounded-full text-xs font-mono font-bold uppercase tracking-wider border border-cyan-100 mb-6">
            <Lock className="w-3.5 h-3.5" /> Internal Operating System
          </span>
          <h2 className="text-4xl sm:text-5xl font-black leading-tight">
            Team Enablement
            <br />
            <span className="text-cyan-500">& Onboarding</span>
          </h2>
          <p className="text-gray-500 mt-4 max-w-xl mx-auto">
            Ready to scale client operations? Access our internal training
            portal, standard operating procedures (SOPs), and agent
            orchestration guides.
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mt-12">
            <OnboardCard
              icon={<Star className="w-6 h-6 text-cyan-500" />}
              title="Documentation"
              sub="Access full SOP library & API docs"
            />
            <OnboardCard
              icon={<Play className="w-6 h-6 text-cyan-500" />}
              title="Training Portal"
              sub="Video modules for Agent 15 setup"
            />
            <OnboardCard
              icon={<Users className="w-6 h-6 text-cyan-500" />}
              title="Support"
              sub="Internal slack #marketing-ops"
            />
          </div>

          <a
            href="/chat"
            className="inline-flex items-center gap-2 px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold rounded-full text-lg mt-12 transition-colors"
          >
            Access Internal Portal <ArrowRight className="w-5 h-5" />
          </a>

          <div className="flex items-center justify-center gap-6 mt-8 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />{" "}
              internal.marketingpowered.local
            </span>
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Sovereign Infra Access
              Required
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-900 rounded flex items-center justify-center">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-gray-400">
              MARKETING POWERED
            </span>
          </div>
          <span className="text-[10px] text-gray-300">
            v2.4.0 (Internal Release)
          </span>
        </div>
      </section>
    </div>
  );
}

/* ============================================================
   Sub-components
   ============================================================ */

function SectionLabel({
  children,
  dark,
  muted,
}: {
  children: React.ReactNode;
  dark?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-0.5 rounded-full ${dark ? "bg-cyan-400" : muted ? "bg-gray-300" : "bg-cyan-500"}`}
      />
      <span
        className={`text-[11px] font-mono font-bold uppercase tracking-widest ${dark ? "text-cyan-400" : muted ? "text-gray-400" : "text-cyan-500"}`}
      >
        {children}
      </span>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  detail: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-5 ${accent ? "border-2 border-cyan-200 bg-cyan-50/30" : "border border-gray-200 bg-white"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono uppercase tracking-widest text-gray-400">
          {label}
        </span>
        {icon}
      </div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{sub}</div>
      <div className="text-[10px] text-gray-400 mt-0.5">{detail}</div>
    </div>
  );
}

function ProblemItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-gray-400 text-xs font-bold">x</span>
      </div>
      <div>
        <h4 className="font-bold text-sm">{title}</h4>
        <p className="text-sm text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function BrowserMockup({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-3">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white border border-gray-200 rounded-md px-3 py-1 text-[11px] text-gray-400 font-mono">
          <Lock className="w-3 h-3 inline mr-1 text-green-500" /> {url}
        </div>
      </div>
      {children}
    </div>
  );
}

function MiniStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
      <div className="text-[8px] font-mono uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div
        className={`text-lg font-black ${color === "green" ? "text-green-500" : "text-gray-900"}`}
      >
        {value}
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="mb-1.5">{icon}</div>
      <div className="text-xs font-bold">{title}</div>
      <div className="text-[10px] text-gray-400">{sub}</div>
    </div>
  );
}

function MetricBadge({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`px-4 py-2 rounded-lg text-center ${accent ? "bg-gray-900 text-white" : "bg-gray-100"}`}
    >
      <div
        className={`text-[9px] font-mono uppercase tracking-wider ${accent ? "text-gray-400" : "text-gray-400"}`}
      >
        {label}
      </div>
      <div className="text-lg font-black">{value}</div>
    </div>
  );
}

function DivisionCard({
  num,
  icon,
  title,
  desc,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-5 bg-white hover:border-cyan-200 transition-colors">
      <div className="flex items-center justify-between mb-3">
        {icon}
        <span className="text-[10px] font-mono text-gray-300">DIV-{num}</span>
      </div>
      <h3 className="font-bold">{title}</h3>
      <p className="text-xs text-gray-500 mt-1">{desc}</p>
    </div>
  );
}

function AgentRow({
  name,
  status,
  statusColor,
  nodes,
  eff,
  process,
}: {
  name: string;
  status: string;
  statusColor?: string;
  nodes: string;
  eff: string;
  process: string;
}) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50">
      <td className="py-3 px-4 font-medium text-sm">{name}</td>
      <td className="py-3 px-4">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium ${statusColor === "orange" ? "text-orange-500" : "text-green-500"}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${statusColor === "orange" ? "bg-orange-400" : "bg-green-400"}`}
          />
          {status}
        </span>
      </td>
      <td className="py-3 px-4 text-xs text-gray-500">{nodes}</td>
      <td className="py-3 px-4 text-xs font-medium">{eff}</td>
      <td className="py-3 px-4 text-xs text-gray-500">{process}</td>
    </tr>
  );
}

function KPICard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    cyan: "border-cyan-200 bg-cyan-50/30",
    green: "border-green-200 bg-green-50/30",
    gray: "border-gray-200 bg-gray-50",
  };
  return (
    <div className={`rounded-xl p-5 border ${colors[color] || colors.gray}`}>
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2">
        {label}
      </div>
      <div className="text-3xl font-black">{value}</div>
      <div
        className={`text-xs mt-1 ${color === "green" ? "text-green-500" : "text-gray-400"}`}
      >
        {sub}
      </div>
    </div>
  );
}

function EconRow({
  metric,
  trad,
  mp,
  adv,
}: {
  metric: string;
  trad: string;
  mp: string;
  adv: string;
}) {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-3 px-6 font-medium text-sm">{metric}</td>
      <td className="py-3 px-6 text-sm text-gray-500">{trad}</td>
      <td className="py-3 px-6 text-sm">{mp}</td>
      <td className="py-3 px-6">
        <span className="text-sm font-bold text-cyan-500">{adv}</span>
      </td>
    </tr>
  );
}

function GrowthCard({
  period,
  label,
  clients,
  desc,
  accent,
}: {
  period: string;
  label: string;
  clients: number;
  desc: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-6 ${accent ? "border-2 border-green-200 bg-white" : "border border-gray-200 bg-white"}`}
    >
      <span
        className={`text-[10px] font-mono px-2 py-1 rounded border ${accent ? "border-green-200 text-green-600" : "border-gray-200 text-gray-400"}`}
      >
        {period}
      </span>
      <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mt-4 mb-1">
        {label}
      </div>
      <div className="text-4xl font-black">
        {clients}{" "}
        <span className="text-lg font-normal text-gray-400">Clients</span>
      </div>
      {accent && (
        <div className="mt-3">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full"
              style={{ width: `${(clients / 50) * 100}%` }}
            />
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-3">{desc}</p>
    </div>
  );
}

function AutoCard({
  title,
  status,
  color,
  value,
  metric,
}: {
  title: string;
  status: string;
  color: string;
  value: string;
  metric: string;
}) {
  const borderColors: Record<string, string> = {
    blue: "border-t-blue-400",
    green: "border-t-green-400",
    purple: "border-t-purple-400",
    orange: "border-t-orange-400",
  };
  return (
    <div
      className={`bg-gray-50 rounded-lg border border-gray-100 border-t-2 ${borderColors[color]} p-3`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-mono font-bold uppercase">
          {title}
        </span>
        <span className="text-[8px] font-mono text-gray-400 uppercase">
          {status}
        </span>
      </div>
      {value && <div className="text-xl font-black">{value}</div>}
      {metric && <div className="text-[10px] text-gray-400">{metric}</div>}
    </div>
  );
}

function IntegrationItem({
  name,
  sub,
  live,
}: {
  name: string;
  sub: string;
  live?: boolean;
}) {
  return (
    <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-gray-100">
      <div>
        <div className="text-sm font-medium">{name}</div>
        <div className="text-[10px] text-gray-400">{sub}</div>
      </div>
      {live && (
        <span className="text-[9px] font-bold text-green-500 bg-green-50 px-2 py-0.5 rounded border border-green-200">
          LIVE
        </span>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-2 py-1 bg-white border border-gray-200 rounded text-gray-500 font-mono">
      {children}
    </span>
  );
}

function ResultCard({
  icon,
  value,
  label,
  before,
  after,
  badge,
  badgeColor,
  dark,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  before: string;
  after: string;
  badge: string;
  badgeColor: string;
  dark?: boolean;
}) {
  const badgeColors: Record<string, string> = {
    green: "bg-green-50 text-green-600 border-green-200",
    cyan: "bg-cyan-50 text-cyan-600 border-cyan-200",
  };
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col ${dark ? "bg-gray-900 text-white border-2 border-dashed border-cyan-200" : "bg-white border-2 border-dashed border-cyan-200"}`}
    >
      <div className="mb-4">{icon}</div>
      <div className="flex-1">
        <div
          className={`text-3xl font-black ${dark ? "text-white" : "text-cyan-500"}`}
        >
          {value}
        </div>
        <div
          className={`text-[10px] font-mono uppercase tracking-wider mt-1 ${dark ? "text-gray-400" : "text-gray-400"}`}
        >
          {label}
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100/20">
        <div className={`text-xs ${dark ? "text-gray-400" : "text-gray-400"}`}>
          {before}
        </div>
        <div className={`text-xs font-bold ${dark ? "text-white" : ""}`}>
          {after}
        </div>
      </div>
      <div className="mt-3">
        <span
          className={`text-[10px] font-medium px-2 py-1 rounded border ${dark ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" : badgeColors[badgeColor]}`}
        >
          {badge}
        </span>
      </div>
    </div>
  );
}

function CompRow({
  cap,
  sub,
  mp,
  cloud,
}: {
  cap: string;
  sub: string;
  mp: string;
  cloud: string;
}) {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-4 px-6">
        <div className="font-bold text-sm">{cap}</div>
        <div className="text-[10px] text-gray-400">{sub}</div>
      </td>
      <td className="py-4 px-6">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> {mp}
        </span>
      </td>
      <td className="py-4 px-6 text-sm text-gray-400">{cloud}</td>
    </tr>
  );
}

function RoadmapCard({
  quarter,
  items,
  accent,
}: {
  quarter: string;
  items: { icon: React.ReactNode; title: string; sub: string }[];
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-5 ${accent ? "border-2 border-green-300 bg-green-50/30" : "border border-gray-200 bg-white"}`}
    >
      <span
        className={`text-[11px] font-mono font-bold px-2 py-1 rounded ${accent ? "text-green-600 bg-green-100" : "text-cyan-500 bg-cyan-50"}`}
      >
        {quarter}
      </span>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-500">
              {item.icon}
            </div>
            <div>
              <div className="text-sm font-bold">{item.title}</div>
              <div className="text-xs text-gray-400">{item.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnboardCard({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <div className="bg-gray-50/50 border border-gray-200 rounded-2xl p-6 text-center">
      <div className="flex justify-center mb-3">{icon}</div>
      <h3 className="font-bold">{title}</h3>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
