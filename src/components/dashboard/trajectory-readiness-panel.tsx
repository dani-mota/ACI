/**
 * PRO-138: Trajectory Readiness panel — renders the archetype-fit ranking
 * on the Employee Dossier.
 *
 * Pure presentation. Math lives in
 * `src/lib/assessment/insights/trajectory-readiness.ts`. Library content
 * lives in `src/lib/assessment/archetypes.ts`.
 *
 * Three states:
 *   - Real data → top section (up to 5 archetypes) + "Less aligned"
 *     section (up to 2 archetypes), each row showing name, description,
 *     fit %, and top-3 driving constructs as text.
 *   - `data === null` → "Trajectory matches will appear once the full
 *     assessment is complete." (Compute fn returns null only for
 *     incomplete subtest results — library size is guaranteed.)
 *
 * Vocabulary discipline (PRO-134): no "fit", "poor fit", "ready" in
 * evaluative senses. "Less aligned with your current profile" is the
 * sanctioned framing for the bottom section per AC.
 */

import { CONSTRUCTS } from "@/lib/constructs";
import type {
  ArchetypeFit,
  TrajectoryReadiness,
} from "@/lib/assessment/insights/trajectory-readiness";

interface Props {
  data: TrajectoryReadiness | null;
}

function constructLabel(key: string): string {
  return CONSTRUCTS[key]?.name ?? key;
}

function ArchetypeRow({
  fit,
  tone,
}: {
  fit: ArchetypeFit;
  tone: "top" | "muted";
}) {
  // Top archetype (index 0 of the top list) gets aci-blue for the fit %.
  // Other top rows + muted rows use default / muted-foreground.
  const fitClass =
    tone === "muted" ? "text-muted-foreground" : "text-foreground font-semibold";
  const driverLabels = fit.drivingConstructs.map(constructLabel).join(", ");

  return (
    <div className="border-b border-border last:border-0 py-3 px-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{fit.archetypeName}</h3>
        <span className={`text-sm tabular-nums ${fitClass}`}>{fit.fitScore}%</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{fit.archetypeDescription}</p>
      {driverLabels && (
        <p className="text-[10px] text-muted-foreground mt-1.5">
          <span className="font-medium">Driven by:</span> {driverLabels}
        </p>
      )}
    </div>
  );
}

export function TrajectoryReadinessPanel({ data }: Props) {
  if (!data) {
    return (
      <section className="bg-card border border-border p-6">
        <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Trajectory Readiness
        </h2>
        <p className="text-xs text-muted-foreground">
          Trajectory matches will appear once the full assessment is complete.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-card border border-border p-6">
      <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Trajectory Readiness
      </h2>

      <div className="border border-border">
        {data.top.map((fit) => (
          <ArchetypeRow key={fit.archetypeId} fit={fit} tone="top" />
        ))}
      </div>

      {data.bottom.length > 0 && (
        <>
          <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-3">
            Less aligned with your current profile
          </h3>
          <div className="border border-border">
            {data.bottom.map((fit) => (
              <ArchetypeRow key={fit.archetypeId} fit={fit} tone="muted" />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
