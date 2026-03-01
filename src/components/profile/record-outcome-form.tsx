"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

const METRIC_OPTIONS = [
  { value: "TRAINING_COMPLETION_DAYS", label: "Training Completion (days)" },
  { value: "RAMP_TIME_MONTHS", label: "Ramp Time (months)" },
  { value: "NINETY_DAY_RETENTION", label: "90-Day Retention (1=yes, 0=no)" },
  { value: "SUPERVISOR_RATING", label: "Supervisor Rating (1–5)" },
  { value: "QUALITY_SCORE", label: "Quality Score (%)" },
  { value: "SAFETY_INCIDENT", label: "Safety Incident (1=yes, 0=no)" },
  { value: "TRAINING_TEST_SCORE", label: "Training Test Score (%)" },
  { value: "PROMOTION", label: "Promotion (1=yes, 0=no)" },
];

interface OutcomeRecord {
  id: string;
  metricType: string;
  metricValue: number;
  notes: string | null;
  observedAt: string;
}

interface RecordOutcomeFormProps {
  candidateId: string;
  existingOutcomes?: OutcomeRecord[];
}

export function RecordOutcomeForm({ candidateId, existingOutcomes = [] }: RecordOutcomeFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [metricType, setMetricType] = useState("");
  const [metricValue, setMetricValue] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>(existingOutcomes);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch(`/api/candidates/${candidateId}/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metricType, metricValue, observedAt, notes: notes || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to record outcome");
        return;
      }

      const newOutcome = await res.json();
      setOutcomes((prev) => [newOutcome, ...prev]);
      setMetricType("");
      setMetricValue("");
      setObservedAt("");
      setNotes("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const metricLabel = (type: string) =>
    METRIC_OPTIONS.find((m) => m.value === type)?.label ?? type;

  return (
    <div className="border border-border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            Outcome Tracking
          </span>
          {outcomes.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              {outcomes.length} recorded
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Record post-hire outcomes to improve future predictions. Data is used anonymously for model refinement.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wider">
                Metric
              </label>
              <select
                value={metricType}
                onChange={(e) => setMetricType(e.target.value)}
                required
                className="w-full h-9 px-3 text-sm bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-aci-gold"
              >
                <option value="">Select metric…</option>
                {METRIC_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wider">
                  Value
                </label>
                <Input
                  type="number"
                  step="any"
                  value={metricValue}
                  onChange={(e) => setMetricValue(e.target.value)}
                  placeholder="e.g. 45"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wider">
                  Observed Date
                </label>
                <Input
                  type="date"
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                  required
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1 uppercase tracking-wider">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any context about this measurement…"
                rows={2}
                className="w-full px-3 py-2 text-sm bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-aci-gold resize-none"
              />
            </div>

            {error && (
              <p className="text-xs text-aci-red">{error}</p>
            )}

            {success && (
              <p className="flex items-center gap-1 text-xs text-aci-green">
                <CheckCircle2 className="w-3.5 h-3.5" /> Outcome recorded.
              </p>
            )}

            <Button type="submit" variant="gold" className="w-full h-9 text-xs" disabled={loading}>
              {loading ? "Saving…" : "Record Outcome"}
            </Button>
          </form>

          {outcomes.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-medium text-foreground uppercase tracking-wider">
                Recorded
              </p>
              {outcomes.map((o) => (
                <div
                  key={o.id}
                  className="flex items-start justify-between text-xs border border-border px-3 py-2 bg-muted/20"
                >
                  <div>
                    <span className="font-medium text-foreground">{metricLabel(o.metricType)}</span>
                    {o.notes && (
                      <p className="text-muted-foreground mt-0.5">{o.notes}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className="font-mono text-aci-gold">{o.metricValue}</span>
                    <p className="text-muted-foreground">
                      {new Date(o.observedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
