import { InitialsBadge } from "@/components/ui/initials-badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { CognitiveSignature } from "./cognitive-signature";
import { ConstructMapEmployee } from "./construct-map-employee";
import { EvidenceLayer } from "./evidence-layer";
import { RoleFitDeltaPanel } from "./role-fit-delta-panel";
import type { EvidenceLayerEntry, OrgConstructDistribution } from "@/lib/data";
import type { RoleDemandProfileEntry } from "@/lib/assessment/role-demand-resolution";

interface EmployeeDossierProps {
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    primaryRole: { name: string; slug: string };
    assessment: {
      id: string;
      completedAt: string | null;
      department: string | null;
      roleFamily: string | null;
      employeeStatus: "ACTIVE" | "REASSESSMENT_DUE" | "IN_TRANSITION" | null;
      cognitiveSignature: string | null;
      subtestResults: { construct: string; percentile: number; layer: string | null }[];
    };
  };
  initialEvidence: EvidenceLayerEntry[];
  orgDistributions: OrgConstructDistribution[];
  /** PRO-135: optional radar overlay. `undefined` means no role demand profile
   *  resolved for this employee's roleFamily — the radar renders a single polygon. */
  roleDemandProfile?: RoleDemandProfileEntry[];
}

export function EmployeeDossier({
  candidate,
  initialEvidence,
  orgDistributions,
  roleDemandProfile,
}: EmployeeDossierProps) {
  const { firstName, lastName, email, primaryRole, assessment } = candidate;
  const completed = assessment.completedAt
    ? new Date(assessment.completedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="bg-card border border-border p-5">
        <div className="flex items-start gap-4">
          <InitialsBadge firstName={firstName} lastName={lastName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1
                  className="text-xl font-bold text-foreground"
                  style={{ fontFamily: "var(--font-dm-sans)" }}
                >
                  {firstName} {lastName}
                </h1>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{email}</p>
              </div>
              {assessment.employeeStatus && (
                <StatusBadge status={assessment.employeeStatus} size="sm" mode="employee" />
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Current Role" value={primaryRole.name} />
              <Field label="Department" value={assessment.department ?? "—"} />
              <Field label="Role Family" value={assessment.roleFamily ?? "—"} />
              <Field label="Assessment Date" value={completed} />
            </dl>
          </div>
        </div>
      </div>

      {/* Layer 1: Cognitive Signature */}
      <CognitiveSignature
        candidateId={candidate.id}
        firstName={firstName}
        initialSignature={assessment.cognitiveSignature}
        subtestResults={assessment.subtestResults}
      />

      {/* Layer 2: Construct Map */}
      <section className="bg-card border border-border p-6">
        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Construct Map
        </h2>
        <ConstructMapEmployee
          subtestResults={assessment.subtestResults}
          orgDistributions={orgDistributions}
          roleDemandProfile={roleDemandProfile}
        />
      </section>

      {/* PRO-136: Role Fit Delta — P0 insight, per-construct shape comparison */}
      <section className="bg-card border border-border p-6">
        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Role Fit Delta
        </h2>
        <RoleFitDeltaPanel
          subtestResults={assessment.subtestResults}
          roleDemandProfile={roleDemandProfile}
        />
      </section>

      {/* Layer 3: Evidence */}
      <section className="bg-card border border-border p-6">
        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Evidence
        </h2>
        <EvidenceLayer candidateId={candidate.id} initialEvidence={initialEvidence} />
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </dt>
      <dd className="text-sm text-foreground mt-0.5">{value}</dd>
    </div>
  );
}
