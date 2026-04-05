"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { BrandLogoMark, BrandWordmark } from "./BrandLogo";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  LayoutDashboard,
  Bot,
  GitBranch,
  Users,
  Settings,
  MessageSquare,
  Plug,
  Clock,
  Brain,
  Menu,
  X,
  BarChart3,
  Bell,
  Megaphone,
  Wrench,
  Activity,
  Workflow,
  LogOut,
  User,
  MapPin,
} from "lucide-react";
import { getConversations } from "@/lib/conversations";

interface RecentChat {
  id: string;
  title: string;
  updated_at: string;
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/pipelines", label: "Pipelines", icon: GitBranch },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/knowledge", label: "Knowledge Base", icon: Brain },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/local-seo", label: "Local SEO", icon: MapPin },
  { href: "/observability", label: "Observability", icon: Activity },
  { href: "/team", label: "Team", icon: Users },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/settings", label: "Settings", icon: Settings },
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
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();

  useEffect(() => {
    getConversations({ limit: 5 })
      .then((convos) =>
        setRecentChats(convos.map((c) => ({ id: c.id, title: c.title, updated_at: c.updated_at })))
      )
      .catch(() => setRecentChats([]));
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
          <BrandLogoMark size={32} />
          <BrandWordmark />
        </Link>
        <div className="mt-3 px-0.5">
          <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-text-muted">
            AI Operating System
          </span>
        </div>
      </div>

      {/* Scrollable middle section */}
      <div className="flex-1 overflow-y-auto min-h-0">
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
                  {timeAgo(new Date(conv.updated_at).getTime())}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
      </div>

      {/* User Profile & Sign Out */}
      {user && (
        <div className="p-3 border-t border-border-dark">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-brand-blue/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-brand-blue" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-white truncate">
                {user.user_metadata?.full_name || user.email?.split("@")[0]}
              </p>
              <p className="text-[10px] text-text-muted truncate">{user.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 md:hidden bg-surface-dark flex items-center justify-between px-4 py-3 border-b border-border-dark">
        <Link href="/" className="flex items-center gap-2">
          <BrandLogoMark size={28} />
          <span className="text-white text-[14px] font-semibold tracking-tight">
            marketing<span className="text-brand-blue">powered</span>
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
