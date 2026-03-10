"use client";

import { useState, useEffect, useCallback } from "react";
import { UserPlus, MoreHorizontal, RefreshCw, UserX, UserCheck, Shield, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getRoleLabel, getAssignableRoles } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: AppUserRole;
  isActive: boolean;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  email: string;
  name: string | null;
  role: AppUserRole;
  inviter: { name: string };
  createdAt: string;
  expiresAt: string;
  status: string;
}

const ROLE_DESCRIPTIONS: Record<string, string> = {
  TA_LEADER: "Full pipeline analytics, team management, psychometric validity data, and exports",
  RECRUITING_MANAGER: "Candidate assessments, predictive insights, red flags, and comparisons",
  HIRING_MANAGER: "Candidate profiles, construct breakdowns, AI transcripts, and summaries",
  RECRUITER_COORDINATOR: "Candidate status, fit scores, interview focus areas, and pipeline",
  EXTERNAL_COLLABORATOR: "View assigned candidates only — composite scores, interview guides, and contact info",
};

const ROLE_COLORS: Record<string, string> = {
  TA_LEADER: "bg-aci-blue/10 text-aci-blue border-aci-blue/20",
  RECRUITING_MANAGER: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  HIRING_MANAGER: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  RECRUITER_COORDINATOR: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  EXTERNAL_COLLABORATOR: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
};

export function TeamManagement({
  currentUser,
}: {
  currentUser: { id: string; role: AppUserRole; name: string; email: string };
}) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "deactivate" | "reactivate" | "role";
    userId: string;
    userName: string;
    newRole?: AppUserRole;
  } | null>(null);

  const assignableRoles = getAssignableRoles(currentUser.role);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
        setInvites(data.pendingInvitations);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleConfirmAction = async () => {
    if (!confirmAction) return;

    const { type, userId, newRole } = confirmAction;
    let body: Record<string, unknown> = {};

    if (type === "deactivate") body = { active: false };
    else if (type === "reactivate") body = { active: true };
    else if (type === "role" && newRole) body = { role: newRole };

    const res = await fetch(`/api/team/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setConfirmAction(null);
      fetchTeam();
    } else {
      const data = await res.json();
      alert(data.error || "Action failed");
    }
  };

  const handleRevoke = async (invitationId: string) => {
    const res = await fetch(`/api/team/invite/${invitationId}`, { method: "DELETE" });
    if (res.ok) fetchTeam();
  };

  const handleResend = async (invitationId: string) => {
    const res = await fetch(`/api/team/invite/${invitationId}`, { method: "POST" });
    if (res.ok) {
      alert("Invitation resent.");
      fetchTeam();
    }
  };

  return (
    <TooltipProvider>
      <div className="px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Team</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage your organization&apos;s team members and pending invitations.
            </p>
          </div>
          <Button variant="blue" onClick={() => setInviteOpen(true)} className="gap-2" disabled={assignableRoles.length === 0}>
            <UserPlus className="w-4 h-4" />
            Invite Team Member
          </Button>
        </div>

        {/* Team Members Table */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Team Members ({members.length})
          </h2>
          <div className="border border-border rounded-none overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : members.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No team members yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  members.map((member) => {
                    const isSelf = member.id === currentUser.id;
                    return (
                      <TableRow key={member.id} className={!member.isActive ? "opacity-50" : ""}>
                        <TableCell className="font-medium">
                          {member.name}
                          {isSelf && (
                            <span className="ml-2 text-[10px] text-muted-foreground">(you)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{member.email}</TableCell>
                        <TableCell>
                          {!isSelf && assignableRoles.length > 0 && member.role !== "ADMIN" ? (
                            <Select
                              value={member.role}
                              onValueChange={(newRole) =>
                                setConfirmAction({
                                  type: "role",
                                  userId: member.id,
                                  userName: member.name,
                                  newRole: newRole as AppUserRole,
                                })
                              }
                            >
                              <SelectTrigger className="h-7 w-auto min-w-[160px] text-xs border-slate-200 rounded-lg">
                                <div className="flex items-center gap-1.5">
                                  {member.role === "TA_LEADER" && <Shield className="w-3 h-3" />}
                                  {member.role === "EXTERNAL_COLLABORATOR" && <ExternalLink className="w-3 h-3" />}
                                  <SelectValue />
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {assignableRoles.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {getRoleLabel(r)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border rounded-full ${ROLE_COLORS[member.role] || "bg-muted text-muted-foreground border-border"}`}
                            >
                              {member.role === "TA_LEADER" && <Shield className="w-3 h-3" />}
                              {member.role === "EXTERNAL_COLLABORATOR" && <ExternalLink className="w-3 h-3" />}
                              {getRoleLabel(member.role)}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.isActive ? (
                            <Badge variant="recommended" className="text-[10px]">Active</Badge>
                          ) : (
                            <Badge variant="doNotAdvance" className="text-[10px]">Deactivated</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {isSelf ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" disabled className="w-8 h-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>You cannot modify your own account</TooltipContent>
                            </Tooltip>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-8 h-8">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {assignableRoles
                                  .filter((r) => r !== member.role)
                                  .map((r) => (
                                    <DropdownMenuItem
                                      key={r}
                                      onClick={() =>
                                        setConfirmAction({
                                          type: "role",
                                          userId: member.id,
                                          userName: member.name,
                                          newRole: r,
                                        })
                                      }
                                    >
                                      Change to {getRoleLabel(r)}
                                    </DropdownMenuItem>
                                  ))}
                                {member.isActive ? (
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() =>
                                      setConfirmAction({
                                        type: "deactivate",
                                        userId: member.id,
                                        userName: member.name,
                                      })
                                    }
                                  >
                                    <UserX className="w-4 h-4 mr-2" />
                                    Deactivate
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setConfirmAction({
                                        type: "reactivate",
                                        userId: member.id,
                                        userName: member.name,
                                      })
                                    }
                                  >
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Reactivate
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pending Invitations */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Pending Invitations ({invites.length})
          </h2>
          <div className="border border-border rounded-none overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No pending invitations.
                    </TableCell>
                  </TableRow>
                ) : (
                  invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {invite.name || "—"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium border rounded-full ${ROLE_COLORS[invite.role] || "bg-muted text-muted-foreground border-border"}`}
                        >
                          {getRoleLabel(invite.role)}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {invite.inviter.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(invite.expiresAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7"
                                onClick={() => handleResend(invite.id)}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Resend invitation</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7 text-destructive hover:text-destructive"
                                onClick={() => handleRevoke(invite.id)}
                              >
                                <UserX className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Revoke invitation</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Invite Modal */}
        <InviteModal
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          assignableRoles={assignableRoles}
          onSuccess={fetchTeam}
        />

        {/* Confirm Action Dialog */}
        <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {confirmAction?.type === "deactivate" && "Deactivate User"}
                {confirmAction?.type === "reactivate" && "Reactivate User"}
                {confirmAction?.type === "role" && "Change Role"}
              </DialogTitle>
              <DialogDescription>
                {confirmAction?.type === "deactivate" &&
                  `Are you sure you want to deactivate ${confirmAction.userName}? They will no longer be able to log in.`}
                {confirmAction?.type === "reactivate" &&
                  `Are you sure you want to reactivate ${confirmAction.userName}? They will be able to log in again.`}
                {confirmAction?.type === "role" && confirmAction.newRole &&
                  `Change ${confirmAction.userName}'s role to ${getRoleLabel(confirmAction.newRole)}?`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>
                Cancel
              </Button>
              <Button
                variant={confirmAction?.type === "deactivate" ? "destructive" : "default"}
                onClick={handleConfirmAction}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

function InviteModal({
  open,
  onClose,
  assignableRoles,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  assignableRoles: AppUserRole[];
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AppUserRole>(assignableRoles[0] || "RECRUITER_COORDINATOR");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);

    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, role }),
      });

      if (res.ok) {
        setEmail("");
        setName("");
        onClose();
        onSuccess();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to send invitation");
      }
    } catch {
      setError("Network error");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join your organization on ACI. Non-domain emails will automatically be assigned the External Collaborator role with limited access.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 text-xs text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">
              Email *
            </label>
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">
              Name
            </label>
            <Input
              type="text"
              placeholder="Optional — pre-fill their name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5 uppercase tracking-wider">
              Role *
            </label>
            <Select value={role} onValueChange={(v) => setRole(v as AppUserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {getRoleLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ROLE_DESCRIPTIONS[role] && (
              <p className="mt-2 text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[role]}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
