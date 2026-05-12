/**
 * PRO-137: shared color-banded chip for the under-leverage score.
 *
 * Three bands:
 *   <= 30  → aci-green   ("well-matched to current role")
 *   <= 60  → aci-amber   ("some growth headroom")
 *   >= 61  → aci-blue    ("significant cognitive headroom")
 *
 * `aci-blue` deliberately replaces the AC's "red" — PRO-134 vocabulary
 * discipline: no evaluative or culturally-loaded color in Employee Mode
 * UI. No "flight risk" copy anywhere; the vocabulary audit script's
 * existing `\brisk\b/i` pattern guards reintroduction.
 *
 * Theme tokens resolve via the `@theme inline` block in
 * `src/app/globals.css` — no hardcoded hex. Light/dark parity automatic.
 *
 * Used in:
 *   - People Table cell (compact variant; just the number colored)
 *   - Employee Dossier headline row (prominent variant; large number)
 */

interface UnderLeverageChipProps {
  score: number | null;
  /** Compact = table cell (text-xs, just the number). Prominent = dossier
   *  headline (text-2xl bold number). Defaults to compact. */
  variant?: "compact" | "prominent";
}

export function UnderLeverageChip({ score, variant = "compact" }: UnderLeverageChipProps) {
  if (score == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const colorClass = scoreColorClass(score);
  const sizeClass =
    variant === "prominent" ? "text-2xl font-bold" : "text-xs font-medium";
  return <span className={`${sizeClass} ${colorClass}`}>{score}</span>;
}

function scoreColorClass(score: number): string {
  if (score <= 30) return "text-aci-green";
  if (score <= 60) return "text-aci-amber";
  return "text-aci-blue";
}

/**
 * Single-line developmental interpretation matched to the same three
 * bands. PRO-134 vocabulary-clean.
 */
export function underLeverageDescription(score: number | null): string | null {
  if (score == null) return null;
  if (score <= 30) return "Cognitive demands are well-matched to current role.";
  if (score <= 60) return "Some growth headroom relative to current role demands.";
  return "Significant cognitive headroom available for stretch opportunities.";
}
