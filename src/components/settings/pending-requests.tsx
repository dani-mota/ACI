"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, AlertTriangle } from "lucide-react";
import { getAssignableRoles, getRoleLabel } from "@/lib/rbac";
import type { AppUserRole } from "@/lib/rbac";

interface AccessRequestItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  reason: string | null;
  requestedRole: string;
  createdAt: string;
  deactivatedUserExists?: boolean;
}

interface PendingRequestsProps {
  requests: AccessRequestItem[];
  currentUserRole: AppUserRole;
}

const ROLE_COLORS: Record<string, string> = {
  TA_LEADER: "text-blue-400",
  RECRUITING_MANAGER: "text-purple-400",
  HIRING_MANAGER: "text-amber-400",
  RECRUITER_COORDINATOR: "text-slate-400",
};

export function PendingRequests({ requests: initialRequests, currentUserRole }: PendingRequestsProps) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [approveDialog, setApproveDialog] = useState<AccessRequestItem | null>(null);
  const [rejectDialog, setRejectDialog] = useState<AccessRequestItem | null>(null);

  if (requests.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Access Requests ({requests.length})
      </h2>
      <div className="bg-card border border-border mb-8">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Name</th>
              <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Email</th>
              <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Job Title</th>
              <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Reason</th>
              <th className="text-left py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Requested</th>
              <th className="text-right py-2.5 px-3 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((req) => (
              <tr key={req.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                <td className="py-2.5 px-3 font-medium text-foreground">
                  <div className="flex items-center gap-1.5">
                    {req.firstName} {req.lastName}
                    {req.deactivatedUserExists && (
                      <span title="A deactivated account with this email exists in your org">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-3 text-muted-foreground">{req.email}</td>
                <td className="py-2.5 px-3 text-muted-foreground">{req.jobTitle || "—"}</td>
                <td className="py-2.5 px-3 text-muted-foreground max-w-[200px] truncate">{req.reason || "—"}</td>
                <td className="py-2.5 px-3 text-muted-foreground">
                  {new Date(req.createdAt).toLocaleDateString()}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 px-2.5 text-[10px] bg-aci-green hover:bg-aci-green/90 text-white"
                      onClick={() => setApproveDialog(req)}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-[10px] text-aci-red border-aci-red/30 hover:bg-aci-red/10"
                      onClick={() => setRejectDialog(req)}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {approveDialog && (
        <ApproveRequestDialog
          request={approveDialog}
          currentUserRole={currentUserRole}
          onClose={() => setApproveDialog(null)}
          onApproved={(id) => {
            setRequests((prev) => prev.filter((r) => r.id !== id));
            setApproveDialog(null);
            router.refresh();
          }}
        />
      )}

      {rejectDialog && (
        <RejectRequestDialog
          request={rejectDialog}
          onClose={() => setRejectDialog(null)}
          onRejected={(id) => {
            setRequests((prev) => prev.filter((r) => r.id !== id));
            setRejectDialog(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ApproveRequestDialog({
  request,
  currentUserRole,
  onClose,
  onApproved,
}: {
  request: AccessRequestItem;
  currentUserRole: AppUserRole;
  onClose: () => void;
  onApproved: (id: string) => void;
}) {
  const assignableRoles = getAssignableRoles(currentUserRole);
  const [role, setRole] = useState<AppUserRole>(assignableRoles[0] || "RECRUITER_COORDINATOR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/team/access-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", role }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to approve");
      setLoading(false);
      return;
    }

    onApproved(request.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border p-6 w-full max-w-md shadow-xl">
        <h3 className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Approve Access Request
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {request.firstName} {request.lastName} ({request.email})
        </p>

        {request.deactivatedUserExists && (
          <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 mb-4 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>A deactivated account with this email already exists in your organization. Consider reactivating the existing account instead.</span>
          </div>
        )}

        {error && (
          <div className="p-2 bg-aci-red/10 border border-aci-red/20 text-xs text-aci-red mb-4">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label className="block text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
            Assign Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AppUserRole)}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {assignableRoles.map((r) => (
              <option key={r} value={r}>
                {getRoleLabel(r)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-aci-green hover:bg-aci-green/90 text-white"
            onClick={handleApprove}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Approving...</>
            ) : (
              <><Check className="w-3 h-3 mr-1" />Approve</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RejectRequestDialog({
  request,
  onClose,
  onRejected,
}: {
  request: AccessRequestItem;
  onClose: () => void;
  onRejected: (id: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReject() {
    setLoading(true);

    const res = await fetch(`/api/team/access-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reject",
        rejectionReason: reason.trim() || undefined,
      }),
    });

    if (res.ok) {
      onRejected(request.id);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-border p-6 w-full max-w-md shadow-xl">
        <h3 className="text-sm font-bold text-foreground mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Reject Access Request
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {request.firstName} {request.lastName} ({request.email})
        </p>

        <div className="mb-6">
          <label className="block text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
            Reason (optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-background border border-border rounded-md p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-aci-gold resize-none"
            rows={3}
            placeholder="Provide a reason for rejection..."
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-aci-red hover:bg-aci-red/90 text-white"
            onClick={handleReject}
            disabled={loading}
          >
            {loading ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Rejecting...</>
            ) : (
              <><X className="w-3 h-3 mr-1" />Reject</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
