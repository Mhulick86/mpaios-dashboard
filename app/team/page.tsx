"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";
import { RequireRole } from "@/components/RequireRole";
import { ALLOWED_EMAIL_DOMAIN, isOwnerRole } from "@/lib/access";
import type { Invitation as InvitationRow } from "@/lib/supabase/types";
import {
  Users, Shield, Clock, CheckCircle2, XCircle, Loader2,
  AlertCircle, Crown, Eye, Edit3, User, Lock, LogIn,
} from "lucide-react";

interface TeamMember {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
}

/** Columns this page selects from public.invitations (see supabase/migrations/0005). */
type Invitation = Pick<InvitationRow, "id" | "email" | "role" | "status" | "expires_at" | "created_at">;

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string; desc: string }> = {
  owner: { label: "Owner", icon: Crown, color: "#F59E0B", desc: "Super admin: everything, incl. roles" },
  admin: { label: "Admin", icon: Shield, color: "#2CACE8", desc: "Business data, integrations, team" },
  member: { label: "Member", icon: Edit3, color: "#08AE67", desc: "Chat and agents, no business data" },
  viewer: { label: "Viewer", icon: Eye, color: "#6B7280", desc: "Read-only access" },
};

/** Roles the owner may assign. `owner` is never assignable from the UI. */
const ASSIGNABLE_ROLES = ["admin", "member", "viewer"] as const;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function RoleBadge({ role, locked }: { role: string; locked?: boolean }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.member;
  const Icon = config.icon;
  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium"
      style={{ color: config.color, backgroundColor: `${config.color}10` }}
      title={locked ? "The owner role is fixed" : undefined}
    >
      <Icon className="w-3 h-3" />
      {config.label}
      {locked && <Lock className="w-3 h-3 opacity-70" />}
    </div>
  );
}

function TeamPageInner() {
  const { user, isOwner } = useAuth();
  const supabase = createClient();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsAvailable, setInvitationsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const load = useCallback(async () => {
    setLoadError("");
    const membersRes = await supabase
      .from("profiles")
      .select("id, email, full_name, role, created_at")
      .order("created_at");
    if (membersRes.error) {
      setLoadError(membersRes.error.message);
    } else {
      setMembers((membersRes.data || []) as TeamMember[]);
    }

    // Legacy invitations table: read-only, and only shown if it still exists.
    try {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, role, status, expires_at, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setInvitations((data || []) as Invitation[]);
      setInvitationsAvailable(true);
    } catch {
      setInvitations([]);
      setInvitationsAvailable(false);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  // Only the owner can change roles; the owner row itself is locked.
  const updateRole = async (member: TeamMember, newRole: string) => {
    if (!isOwner) return;
    if (isOwnerRole(member.role)) return;
    if (!(ASSIGNABLE_ROLES as readonly string[]).includes(newRole)) return;
    setSavingId(member.id);
    setSaveError("");
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", member.id);
    if (error) {
      setSaveError(`Could not update ${member.email || "member"}: ${error.message}`);
    } else {
      setMembers(prev => prev.map(m => (m.id === member.id ? { ...m, role: newRole } : m)));
    }
    setSavingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const owners = members.filter(m => isOwnerRole(m.role)).length;
  const admins = members.filter(m => m.role === "admin").length;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-blue" />
            Team
          </h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""} &middot; {owners} owner &middot; {admins} admin{admins !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Sign-in note (Google-only, domain restricted) */}
      <div className="bg-surface-raised rounded-xl border border-border p-5 mb-6">
        <h3 className="text-[14px] font-semibold mb-2 flex items-center gap-2">
          <LogIn className="w-4 h-4 text-brand-blue" />
          How people join
        </h3>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          Anyone with an @{ALLOWED_EMAIL_DOMAIN} Google account can sign in and starts as a Member.
        </p>
        <p className="text-[11px] text-text-muted mt-2 leading-relaxed">
          There are no email invitations. Members can use Chat and agents but cannot see clients, campaigns,
          financials, integrations or this page. {isOwner ? "As the owner you can promote or demote people below." : "Only the owner can change roles."}
        </p>
      </div>

      {/* Role Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        {Object.entries(ROLE_CONFIG).map(([key, config]) => {
          const Icon = config.icon;
          return (
            <div key={key} className="bg-surface-raised rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                <span className="text-[12px] font-semibold">{config.label}</span>
              </div>
              <p className="text-[10px] text-text-muted">{config.desc}</p>
            </div>
          );
        })}
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-2 text-[12px] text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4" /> Could not load team members: {loadError}
        </div>
      )}
      {saveError && (
        <div className="mb-4 flex items-center gap-2 text-[12px] text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4" /> {saveError}
        </div>
      )}

      {/* Members table */}
      <div className="bg-surface-raised rounded-xl border border-border overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-[13px] font-semibold">Members</h3>
          {!isOwner && (
            <span className="text-[10px] text-text-muted flex items-center gap-1">
              <Lock className="w-3 h-3" /> Roles are managed by the owner
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-text-muted border-b border-border">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Email</th>
                <th className="px-4 py-2 font-semibold">Role</th>
                <th className="px-4 py-2 font-semibold whitespace-nowrap">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-[12px] text-text-muted">
                    No members yet. The first @{ALLOWED_EMAIL_DOMAIN} Google sign-in will appear here.
                  </td>
                </tr>
              )}
              {members.map(member => {
                const isCurrentUser = member.id === user?.id;
                const rowIsOwner = isOwnerRole(member.role);
                const canEdit = isOwner && !rowIsOwner;
                return (
                  <tr key={member.id} className="hover:bg-gray-50/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-brand-blue" />
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-medium truncate">
                            {member.full_name || member.email?.split("@")[0] || "Unknown"}
                          </span>
                          {isCurrentUser && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue">You</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-text-muted whitespace-nowrap">{member.email || "—"}</td>
                    <td className="px-4 py-3">
                      {canEdit ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={(ASSIGNABLE_ROLES as readonly string[]).includes(member.role) ? member.role : "member"}
                            onChange={e => updateRole(member, e.target.value)}
                            disabled={savingId === member.id}
                            className="px-2 py-1 rounded border border-border text-[11px] bg-surface-raised disabled:opacity-50"
                          >
                            {ASSIGNABLE_ROLES.map(r => (
                              <option key={r} value={r}>{ROLE_CONFIG[r].label}</option>
                            ))}
                          </select>
                          {savingId === member.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-text-muted" />}
                        </div>
                      ) : (
                        <RoleBadge role={member.role} locked={rowIsOwner} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-text-muted whitespace-nowrap">{formatDate(member.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legacy invitations (read-only; hidden when the table no longer exists) */}
      {invitationsAvailable && invitations.length > 0 && (
        <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[13px] font-semibold">Past invitations</h3>
            <p className="text-[10px] text-text-muted mt-0.5">Kept for reference. Sign-in no longer requires an invitation.</p>
          </div>
          <div className="divide-y divide-border">
            {invitations.map(invite => (
              <div key={invite.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  invite.status === "pending" ? "bg-[#F59E0B]/10" : invite.status === "accepted" ? "bg-brand-green/10" : "bg-gray-100"
                }`}>
                  {invite.status === "pending" ? <Clock className="w-4 h-4 text-[#F59E0B]" /> :
                   invite.status === "accepted" ? <CheckCircle2 className="w-4 h-4 text-brand-green" /> :
                   <XCircle className="w-4 h-4 text-text-muted" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{invite.email}</p>
                  <p className="text-[10px] text-text-muted">
                    {formatDate(invite.created_at)} &middot; {ROLE_CONFIG[invite.role]?.label || invite.role}
                  </p>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                  invite.status === "pending" ? "bg-[#F59E0B]/10 text-[#F59E0B]" :
                  invite.status === "accepted" ? "bg-brand-green/10 text-brand-green" :
                  "bg-gray-100 text-text-muted"
                }`}>
                  {invite.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TeamPage() {
  return (
    <RequireRole min="admin">
      <TeamPageInner />
    </RequireRole>
  );
}
