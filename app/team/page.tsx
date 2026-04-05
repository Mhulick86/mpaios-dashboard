"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  Users, Mail, Shield, UserPlus, Clock, CheckCircle2,
  XCircle, Trash2, Copy, Loader2, AlertCircle, Crown,
  Eye, Edit3, User,
} from "lucide-react";

interface TeamMember {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  created_at: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  expires_at: string;
  created_at: string;
}

const ROLE_CONFIG: Record<string, { label: string; icon: typeof Crown; color: string; desc: string }> = {
  owner: { label: "Owner", icon: Crown, color: "#F59E0B", desc: "Full access, billing, delete" },
  admin: { label: "Admin", icon: Shield, color: "#2CACE8", desc: "Full access, manage team" },
  member: { label: "Member", icon: Edit3, color: "#08AE67", desc: "Use agents, run pipelines" },
  viewer: { label: "Viewer", icon: Eye, color: "#6B7280", desc: "Read-only access" },
};

export default function TeamPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteError, setInviteError] = useState("");

  // Load team data
  useEffect(() => {
    async function load() {
      const [membersRes, invitesRes] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, role, created_at").order("created_at"),
        supabase.from("invitations").select("*").order("created_at", { ascending: false }),
      ]);
      setMembers((membersRes.data || []) as TeamMember[]);
      setInvitations((invitesRes.data || []) as Invitation[]);
      setLoading(false);
    }
    load();
  }, [supabase]);

  // Send invitation
  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      // Check if already invited
      const existing = invitations.find(i => i.email === inviteEmail && i.status === "pending");
      if (existing) {
        setInviteError("This email already has a pending invitation.");
        setInviting(false);
        return;
      }

      // Check if already a member
      const existingMember = members.find(m => m.email === inviteEmail);
      if (existingMember) {
        setInviteError("This person is already a team member.");
        setInviting(false);
        return;
      }

      // Create invitation record
      const { data, error } = await supabase.from("invitations").insert({
        invited_by: user?.id,
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
      }).select().single();

      if (error) throw error;

      // Send invitation email via Supabase Auth
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: inviteEmail.trim().toLowerCase(),
        options: {
          data: { invited_role: inviteRole, invitation_id: data.id },
          shouldCreateUser: true,
        },
      });

      if (authError) {
        // Non-critical - invitation is saved, they can sign up manually
        console.warn("OTP send failed:", authError.message);
      }

      setInvitations(prev => [data as Invitation, ...prev]);
      setInviteSuccess(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");
      setInviteRole("member");
      setTimeout(() => setInviteSuccess(""), 5000);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  // Revoke invitation
  const handleRevoke = async (id: string) => {
    await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
    setInvitations(prev => prev.map(i => i.id === id ? { ...i, status: "revoked" } : i));
  };

  // Copy invite link
  const copyInviteLink = (token: string) => {
    const link = `${window.location.origin}/signup?invite=${token}`;
    navigator.clipboard.writeText(link);
  };

  // Update member role
  const updateRole = async (memberId: string, newRole: string) => {
    await supabase.from("profiles").update({ role: newRole }).eq("id", memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[20px] md:text-[24px] font-semibold flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-blue" />
            Team Management
          </h1>
          <p className="text-[12px] md:text-[14px] text-text-secondary mt-1">
            {members.length} member{members.length !== 1 ? "s" : ""} &middot; {invitations.filter(i => i.status === "pending").length} pending invites
          </p>
        </div>
      </div>

      {/* Invite Form */}
      <div className="bg-surface-raised rounded-xl border border-border p-5 mb-6">
        <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-brand-blue" />
          Invite Team Member
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
              onKeyDown={e => e.key === "Enter" && handleInvite()}
            />
          </div>
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="px-3 py-2.5 border border-border rounded-lg text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="px-5 py-2.5 bg-brand-blue text-white font-semibold rounded-lg text-[13px] hover:bg-brand-blue-dark disabled:opacity-40 flex items-center gap-2 transition-colors shrink-0"
          >
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Send Invite
          </button>
        </div>

        {inviteSuccess && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-brand-green bg-brand-green/10 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4" /> {inviteSuccess}
          </div>
        )}
        {inviteError && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4" /> {inviteError}
          </div>
        )}
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

      {/* Team Members */}
      <div className="bg-surface-raised rounded-xl border border-border overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-[13px] font-semibold">Team Members</h3>
        </div>
        <div className="divide-y divide-border">
          {members.map(member => {
            const roleConfig = ROLE_CONFIG[member.role] || ROLE_CONFIG.member;
            const isCurrentUser = member.id === user?.id;
            const RoleIcon = roleConfig.icon;
            return (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/30 transition-colors">
                <div className="w-9 h-9 rounded-full bg-brand-blue/10 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-brand-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium truncate">
                      {member.full_name || member.email?.split("@")[0] || "Unknown"}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue">You</span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted truncate">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isCurrentUser ? (
                    <div className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium" style={{ color: roleConfig.color, backgroundColor: `${roleConfig.color}10` }}>
                      <RoleIcon className="w-3 h-3" />
                      {roleConfig.label}
                    </div>
                  ) : (
                    <select
                      value={member.role}
                      onChange={e => updateRole(member.id, e.target.value)}
                      className="px-2 py-1 rounded border border-border text-[11px] bg-white"
                    >
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="bg-surface-raised rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[13px] font-semibold">Invitations</h3>
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
                    {invite.status === "pending" ? `Expires ${new Date(invite.expires_at).toLocaleDateString()}` :
                     invite.status === "accepted" ? "Accepted" : "Revoked"} &middot; {ROLE_CONFIG[invite.role]?.label || invite.role}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                    invite.status === "pending" ? "bg-[#F59E0B]/10 text-[#F59E0B]" :
                    invite.status === "accepted" ? "bg-brand-green/10 text-brand-green" :
                    "bg-gray-100 text-text-muted"
                  }`}>
                    {invite.status}
                  </span>
                  {invite.status === "pending" && (
                    <>
                      <button
                        onClick={() => copyInviteLink(invite.token)}
                        className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                        title="Copy invite link"
                      >
                        <Copy className="w-3.5 h-3.5 text-text-muted" />
                      </button>
                      <button
                        onClick={() => handleRevoke(invite.id)}
                        className="p-1.5 rounded hover:bg-red-50 transition-colors"
                        title="Revoke"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
