/**
 * PRO-139: Promotion Fit verdict thresholds.
 *
 * ⚠️ CALIBRATION PENDING.
 *
 * These constants control which of the three verdict strings a Promotion Fit
 * computation emits. The shape of the decision (count + magnitude of
 * under-spec gaps) is fixed by the AC; the *numbers* are placeholders awaiting
 * design-partner data and Dani's sign-off — see follow-up ticket.
 *
 * Quarantined in this one module so the calibration ticket has a single file
 * to touch when real data arrives. No magic numbers elsewhere.
 *
 * Scale: all magnitudes are on the 0-100 internal scale (same as
 * `computeRoleFitDelta`'s `delta`). The panel divides by 10 at the display
 * boundary; thresholds stay on 0-100 to keep the math co-located with the
 * compute function.
 */

/** Max under-spec gap count for the "aligns now" verdict. 0 means: any gap
 *  at all bumps the verdict out of "ready now." */
export const ALIGNED_NOW_MAX_GAPS = 0;

/** Gap count at or above which the verdict becomes "lateral trajectory" —
 *  too many growth edges for a stretch path to close in reasonable time. */
export const LATERAL_TRIGGER_GAP_COUNT = 3;

/** Magnitude (0-100) at which any single gap bumps the verdict to "lateral"
 *  regardless of gap count. A single very-large gap dominates the readiness
 *  picture even if it's the only one. */
export const LATERAL_TRIGGER_MAGNITUDE = 30;

/** Months-of-stretch per under-spec gap when the verdict is the middle case.
 *  N = gapCount * STRETCH_MONTHS_PER_GAP. */
export const STRETCH_MONTHS_PER_GAP = 3;
