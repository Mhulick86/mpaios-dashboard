"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  Users,
  Settings,
  MessageSquare,
  Zap,
  Plug,
  Clock,
  Brain,
  Menu,
  X,
  BarChart3,
  Bell,
  Megaphone,
} from "lucide-react";
import { getAllConversations, type Conversation } from "@/lib/chatStorage";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/pipelines", label: "Pipelines", icon: GitBranch },
  { href: "/knowledge", label: "Knowledge Base", icon: Brain },
  { href: "/clients", label: "Clients", icon: Users },
];

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export function Sidebar() {
  const pathname = usePathname();
  const [recentChats, setRecentChats] = useState<Conversation[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const convos = getAllConversations();
    setRecentChats(convos.slice(0, 5));
  }, [pathname]);

  // Close mobile menu on nav
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-6 pb-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-blue rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="leading-none">
            <span className="text-white text-[15px] font-semibold tracking-tight block">
              marketing
            </span>
            <span className="text-brand-blue text-[15px] font-semibold tracking-tight">
              powered
            </span>
          </div>
        </Link>
        <div className="mt-3 px-0.5">
          <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-text-muted">
            AI Operating System
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                isActive
                  ? "bg-brand-blue/15 text-brand-blue"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Recent Conversations */}
      {recentChats.length > 0 && (
        <div className="mt-4 px-3">
          <div className="flex items-center gap-2 px-3 mb-1.5">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-[10px] font-medium tracking-[0.1em] uppercase text-gray-500">
              Recent Chats
            </span>
          </div>
          <div className="space-y-0.5">
            {recentChats.map((conv) => (
              <Link
                key={conv.id}
                href="/chat"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] text-gray-400 hover:text-white hover:bg-white/5 transition-colors group"
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-gray-500 group-hover:text-gray-300" />
                <span className="truncate flex-1">{conv.title}</span>
                <span className="text-[10px] text-gray-600 shrink-0">
                  {timeAgo(conv.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* System Status */}
      <div className="p-4 mx-3 mb-3 rounded-lg bg-surface-dark-raised border border-border-dark">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
          <span className="text-[11px] font-medium text-gray-400">System Online</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Agents</span>
            <span className="text-gray-300">24 registered</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Active</span>
            <span className="text-brand-green">2 running</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-gray-500">Mode</span>
            <span className="text-gray-300">Hybrid</span>
          </div>
        </div>
      </div>

      {/* Bottom links */}
      <div className="px-3 pb-4 space-y-0.5">
        <Link
          href="/integrations"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
            pathname.startsWith("/integrations")
              ? "bg-brand-blue/15 text-brand-blue"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Plug className="w-[18px] h-[18px]" />
          Integrations
        </Link>
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
            pathname.startsWith("/settings")
              ? "bg-brand-blue/15 text-brand-blue"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Settings className="w-[18px] h-[18px]" />
          Settings
        </Link>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-surface-dark flex items-center justify-between px-4 py-3 border-b border-border-dark">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-brand-blue rounded-lg flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-white text-[14px] font-semibold tracking-tight">
            MPAIOS
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar - desktop: static, mobile: slide-in overlay */}
      <aside
        className={`
          fixed md:static z-30 top-0 left-0 h-screen
          w-[260px] bg-surface-dark flex flex-col shrink-0
          transition-transform duration-300 ease-in-out
          ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
          pt-14 md:pt-0
        `}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
