"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MessageSquare, TrendingUp, TrendingDown, Minus, Target } from "lucide-react";
import { CONSTRUCTS, LAYER_INFO, type LayerType } from "@/lib/constructs";
import { ScoreBar } from "@/components/ui/score-bar";

interface LayerResultsProps {
  subtestResults: any[];
  aiInteractions: any[];
  roleSlug?: string;
}

const LAYERS: LayerType[] = ["COGNITIVE_CORE", "TECHNICAL_APTITUDE", "BEHAVIORAL_INTEGRITY"];

function getPerformanceTier(p: number): { label: string; color: string; Icon: any; description: string } {
  if (p >= 90) return { label: "EXCEPTIONAL", color: "text-aci-green", Icon: TrendingUp, description: "Top 10% — a standout capability that sets this candidate apart from the vast majority of the talent pool." };
  if (p >= 75) return { label: "STRONG", color: "text-aci-green", Icon: TrendingUp, description: "Above average — a reliable strength that can be leveraged for immediate contribution and peer mentoring." };
  if (p >= 50) return { label: "SOLID", color: "text-foreground", Icon: Minus, description: "At or above the midpoint — adequate for standard role demands with no special intervention needed." };
  if (p >= 25) return { label: "DEVELOPING", color: "text-aci-amber", Icon: TrendingDown, description: "Below average — may require additional support, training, or compensating team strengths to meet role demands." };
  return { label: "LIMITED", color: "text-aci-red", Icon: TrendingDown, description: "Bottom quartile — a significant gap that should factor into hiring decisions for roles where this construct is weighted." };
}

function getConstructInsight(construct: string, percentile: number): string {
  const p = percentile;

  const insights: Record<string, Record<string, string>> = {
    FLUID_REASONING: {
      high: `At the scaled score of ${p}, this candidate solves novel problems significantly faster than peers. Expect them to troubleshoot unfamiliar equipment failures, optimize processes with limited guidance, and develop creative solutions to first-time challenges. This is the construct most predictive of long-term career ceiling — high FL scorers disproportionately advance to senior technical roles within 2-3 years.`,
      mid: `Fluid reasoning at the scaled score of ${p} is adequate for most standard role responsibilities. The candidate can work through new problems but may need more time or guidance than top performers. They'll handle routine troubleshooting but may struggle with truly novel, multi-variable problems. Provide decision trees and troubleshooting guides to support them.`,
      low: `At the scaled score of ${p}, novel problem-solving is a limitation. This candidate will perform best in well-defined, repetitive roles where procedures cover most scenarios. When encountering situations not covered by SOPs, they'll likely need supervisor support. This is not a trainable skill — role design and team structure should compensate.`,
    },
    EXECUTIVE_CONTROL: {
      high: `Executive control at the scaled score of ${p} indicates exceptional ability to maintain focus under production pressure. This candidate can manage multiple priorities, resist distractions from noisy floor environments, and sustain accuracy during long shifts. They're the person who catches the detail others miss when everyone is tired at the end of a 12-hour run.`,
      mid: `At the scaled score of ${p}, attention management is adequate for standard production demands. The candidate can maintain quality in typical conditions but may see accuracy drops during high-pressure periods or when managing multiple machines. Consider structured break schedules and clear priority hierarchies to maintain performance consistency.`,
      low: `Executive control at the scaled score of ${p} is a concern for roles requiring sustained concentration. This candidate may struggle with quality consistency during long runs, multi-machine operation, or environments with frequent interruptions. Assign single-focus tasks where possible and implement additional quality checkpoints. Consider roles where task-switching is by design rather than distraction.`,
    },
    COGNITIVE_FLEXIBILITY: {
      high: `Cognitive flexibility at the scaled score of ${p} — this candidate pivots effortlessly between approaches when Plan A fails. In manufacturing, this translates to: when a tool breaks mid-run, when material behaves unexpectedly, when a process change is announced mid-shift. They don't freeze or rigidly stick to what isn't working. High CF also predicts positive response to cross-training and role rotations.`,
      mid: `At the scaled score of ${p}, cognitive flexibility is average. The candidate can adapt to changes with reasonable notice but may need transition time when unexpected pivots are required. They benefit from advance communication about process changes and clear reasons for why the change is happening. Not a concern for roles with stable, predictable processes.`,
      low: `Low cognitive flexibility (scaled score of ${p}) suggests this candidate strongly prefers routine and established methods. Unexpected changes, last-minute process modifications, or being reassigned mid-shift will be stressful and may cause performance drops. If the role involves frequent changes, this is a significant concern. In stable, predictable roles, it's manageable — they'll excel at consistent execution of the same process.`,
    },
    METACOGNITIVE_CALIBRATION: {
      high: `Metacognitive calibration at the scaled score of ${p} is a standout score. This candidate accurately assesses what they know and — critically — what they don't know. In manufacturing, this means: they stop and verify instead of guessing, they ask for help at the right moment, and they don't approve questionable parts hoping they're okay. This is the #1 predictor of safety and quality behavior. High MC scorers have 60% fewer first-year quality escapes on average.`,
      mid: `At the scaled score of ${p}, metacognitive calibration is average. The candidate generally recognizes their limits but may occasionally overestimate competence in familiar-seeming situations. The highest-risk window is 3-6 months into the role, when confidence grows faster than actual competence. Schedule explicit calibration check-ins: "What are you confident about? What are you unsure about?" — compare to supervisor observations.`,
      low: `Metacognitive calibration at the scaled score of ${p} is a red flag for any role involving independent judgment. This candidate may not recognize when they're making errors or operating beyond their competence. They need mandatory verification steps, peer review for critical decisions, and explicit checkpoints before advancing to independent work. Without these safeguards, they're the profile most associated with preventable quality escapes and safety near-misses.`,
    },
    LEARNING_VELOCITY: {
      high: `Learning velocity at the scaled score of ${p} — this candidate absorbs new skills rapidly and will reach productive contribution 40-60% faster than average. They can handle front-loaded, intensive training and don't need excessive repetition. The risk with fast learners: they sometimes assume mastery before achieving it. Combine with their metacognitive calibration score to assess whether they know when they've truly learned something vs. when they've just been exposed to it.`,
      mid: `At the scaled score of ${p}, learning velocity is standard. Budget for normal onboarding timelines and don't try to compress training. This candidate benefits from hands-on practice over classroom instruction, spaced repetition of critical procedures, and incremental complexity increases. They'll get there — it just takes the standard number of reps and exposure time.`,
      low: `Learning velocity at the scaled score of ${p} means extended onboarding is non-negotiable. Budget 2-3x the standard ramp timeline and pair with a dedicated mentor (not just whoever is available). Break complex procedures into small, masterable sub-steps. The upside: slow learners often retain deeply once they've learned — they may become extremely reliable operators after the longer ramp period. Weigh extended training cost against the candidate's other strengths.`,
    },
    SYSTEMS_DIAGNOSTICS: {
      high: `Systems diagnostics at the scaled score of ${p} — this candidate understands how interconnected systems work and can isolate root causes efficiently. They're the person who traces a quality issue back to a specific parameter change two shifts ago, or who realizes that a coolant temperature variation is causing dimensional drift three operations downstream. This skill takes years to build experientially; having it innately is a significant advantage.`,
      mid: `At the scaled score of ${p}, systems diagnostics is adequate for standard troubleshooting. The candidate can follow diagnostic procedures and trace obvious cause-and-effect chains. They may miss subtle interactions between systems or need guidance when problems span multiple process steps. Cross-functional exposure (quality, maintenance, process engineering) accelerates systems thinking development.`,
      low: `Systems diagnostics at the scaled score of ${p} suggests difficulty understanding how different parts of a production system interact. The candidate may fix symptoms without addressing root causes, or miss how a change in one area cascades to others. For diagnostic-heavy roles, this is a significant limitation. Provide structured troubleshooting guides with decision trees. Pair with a strong systems thinker for complex problems.`,
    },
    PATTERN_RECOGNITION: {
      high: `Pattern recognition at the scaled score of ${p} — this candidate spots trends, anomalies, and drift before they become defects. They're the one who notices the tool is starting to wear based on subtle sound changes, or who catches a dimensional trend in SPC data that's still within spec but heading toward trouble. This anticipatory awareness prevents defects rather than detecting them — the highest-leverage quality capability.`,
      mid: `At the scaled score of ${p}, pattern recognition is average. The candidate can identify clear anomalies and obvious trends but may miss subtle drift or unusual patterns that precede failures. They benefit from structured visual aids: control charts with annotated warning signs, reference images showing acceptable vs. concerning patterns, and color-coded data displays. Train their eye with specific examples of what to look for.`,
      low: `Pattern recognition at the scaled score of ${p} means this candidate may not notice quality drift, tool wear, or process anomalies until they become obvious. In practice, they'll catch defects after they happen rather than preventing them. Compensate with more frequent automated inspection, tighter SPC alert thresholds, and shorter check intervals. Technology can compensate for what human pattern recognition doesn't catch.`,
    },
    QUANTITATIVE_REASONING: {
      high: `Quantitative reasoning at the scaled score of ${p} — strong mathematical and numerical aptitude. This candidate handles tolerances, GD&T, feeds/speeds, and process calculations with confidence. They can perform mental math on the floor, validate measurement results intuitively, and catch numerical errors in documentation. Especially valuable in precision manufacturing where fractions of thousandths matter.`,
      mid: `At the scaled score of ${p}, quantitative reasoning is adequate for standard numerical demands. The candidate can work with basic tolerances and measurements but may need support for complex calculations (tolerance stacking, statistical analysis, process capability calculations). Provide reference charts and calculation tools to supplement. They can verify their own basic math but should double-check complex numerical work.`,
      low: `Quantitative reasoning at the scaled score of ${p} is a limitation for roles involving significant numerical work. Basic measurement and tolerance interpretation may require additional training and support. GD&T, statistical analysis, and multi-step calculations will be challenging. This is one of the more trainable technical constructs — structured practice with real-world manufacturing math problems shows measurable improvement in 3-6 months.`,
    },
    SPATIAL_VISUALIZATION: {
      high: `Spatial visualization at the scaled score of ${p} — exceptional ability to mentally rotate 3D objects and understand how 2D drawings map to physical parts. This candidate can look at a blueprint and immediately visualize the finished part, plan tool approach angles, and understand how complex geometries nest together. This is the #1 construct for CAM programming, fixture design, and 5-axis machining roles.`,
      mid: `At the scaled score of ${p}, spatial visualization is adequate for standard interpretation of drawings and assemblies. The candidate can work with most engineering documentation but may need more time with complex 3D geometries, multi-angle views, or visualizing tool access in tight spaces. 3D models on screen compensate well — consider software tools that provide visual simulation alongside 2D drawings.`,
      low: `Spatial visualization at the scaled score of ${p} is a significant limitation for roles requiring 3D thinking. The candidate may struggle to interpret complex drawings, visualize how parts fit together, or plan tool paths through challenging geometry. This is largely an innate aptitude — training can help but won't close a large gap. Consider roles that rely more on 2D work, standardized setups, or where software handles spatial planning.`,
    },
    MECHANICAL_REASONING: {
      high: `Mechanical reasoning at the scaled score of ${p} — strong intuition for how physical systems, forces, and mechanisms behave. This candidate understands why tools deflect under cutting forces, how clamping pressure affects thin-wall parts, and what happens when you change spindle speed on a different material. They debug mechanical problems by thinking about physics, not just following troubleshooting scripts.`,
      mid: `At the scaled score of ${p}, mechanical reasoning is adequate for standard operational understanding. The candidate grasps basic cause-and-effect in mechanical systems but may not intuitively predict how changes in forces, pressures, or speeds will cascade through a process. They'll follow mechanical troubleshooting guides effectively but may miss the "physics first" reasoning that top performers use.`,
      low: `Mechanical reasoning at the scaled score of ${p} suggests limited intuition for physical systems. The candidate may not understand why certain procedures exist (clamping sequences, warm-up procedures, tool engagement limits) — they follow them without grasping the underlying physics. Invest in "why it matters" explanations during training, not just "what to do." For roles requiring mechanical intuition (machine setup, process development), this is a significant concern.`,
    },
    PROCEDURAL_RELIABILITY: {
      high: `Procedural reliability at the scaled score of ${p} — this candidate follows established procedures consistently, even when shortcuts are tempting or when nobody is watching. They complete the checklist every time, document every measurement, and don't skip steps at the end of a long shift. This is the behavioral foundation of manufacturing quality. Combined with strong ethical judgment, it's the profile associated with lowest defect rates.`,
      mid: `At the scaled score of ${p}, procedural reliability is average. The candidate follows procedures most of the time but may occasionally take shortcuts when confident in their judgment or when under time pressure. Periodic audits, clear communication about which procedures are absolutely non-negotiable, and transparent accountability mechanisms help maintain consistency. They respond well to understanding the "why" behind critical procedures.`,
      low: `Procedural reliability at the scaled score of ${p} raises compliance concerns. This candidate tends to improvise, take shortcuts, or modify procedures based on personal judgment. In some roles (creative, engineering), this independence can be an asset. In production and quality roles where procedure compliance directly impacts product integrity, it's a significant risk factor. Requires explicit, written communication about non-negotiable procedures with clear consequences for deviation.`,
    },
    ETHICAL_JUDGMENT: {
      high: `Ethical judgment at the scaled score of ${p} — this candidate makes the right call under pressure. They report borderline parts even at the end of a long shift, flag concerns even when the senior machinist insists it's fine, and prioritize integrity over convenience. In aerospace and defense manufacturing, this is non-negotiable. High EJ scorers are the cultural immune system that prevents systemic quality issues from taking root.`,
      mid: `At the scaled score of ${p}, ethical judgment is adequate. The candidate will generally follow quality and safety standards, but may face difficulty in ambiguous situations — especially when under social or time pressure. They benefit from clear, pre-defined escalation paths and a culture where raising concerns is explicitly rewarded. Don't rely on their judgment in situations where the "right" answer is socially costly — make it easy and expected to speak up.`,
      low: `Ethical judgment at the scaled score of ${p} is a serious concern for manufacturing roles. This candidate may let borderline quality pass, defer to authority rather than raising concerns, or prioritize production speed over standards when pressured. In defense, aerospace, or any safety-critical manufacturing environment, this profile requires mandatory peer review for all quality decisions and close supervision during the critical first year. Culture can improve ethics behavior, but it starts with clear, non-punitive reporting systems.`,
    },
  };

  const construct_insights = insights[construct];
  if (!construct_insights) return "";

  if (p >= 75) return construct_insights.high;
  if (p >= 40) return construct_insights.mid;
  return construct_insights.low;
}

function getDevelopmentRec(construct: string, percentile: number): string | null {
  if (percentile >= 75) return null;

  const recs: Record<string, string> = {
    FLUID_REASONING: "Not directly trainable — compensate with structured problem-solving frameworks, decision trees, and paired troubleshooting with stronger analytical teammates.",
    EXECUTIVE_CONTROL: "Practice mindfulness and focus exercises. Reduce environmental distractions. Use structured task lists and timers to build sustained attention habits.",
    COGNITIVE_FLEXIBILITY: "Expose to gradually increasing variety in assignments. Practice switching between different task types. Frame changes as opportunities rather than disruptions.",
    METACOGNITIVE_CALIBRATION: "Use prediction exercises: before tasks, have them estimate their performance, then compare to actuals. Regular calibration sessions with honest, specific feedback.",
    LEARNING_VELOCITY: "Use spaced repetition, hands-on practice, and multi-modal instruction. Break complex skills into smaller mastery steps. Allow extra time — don't compress training.",
    SYSTEMS_DIAGNOSTICS: "Cross-functional shadowing (quality, maintenance, engineering). Root cause analysis workshops. Practice tracing effects across process steps with guided examples.",
    PATTERN_RECOGNITION: "Train with annotated examples of good vs. concerning patterns. Use before/after comparisons of wear, drift, and anomalies. SPC chart reading practice with real data.",
    QUANTITATIVE_REASONING: "Daily math practice with manufacturing-relevant problems (tolerance stacking, speed/feed calculations). Use calculation reference cards. Responsive to structured practice.",
    SPATIAL_VISUALIZATION: "Largely innate — compensate with 3D software visualization tools, physical models, and step-by-step setup guides with multiple camera angle photos.",
    MECHANICAL_REASONING: "Invest in 'physics of machining' training that explains forces, deflection, thermal effects. Shop floor demonstrations connecting theory to observable outcomes.",
    PROCEDURAL_RELIABILITY: "Pair with procedurally disciplined colleagues. Make non-negotiable procedures visually distinct. Explain the 'why' behind each critical step. Regular audits with constructive feedback.",
    ETHICAL_JUDGMENT: "Build a speak-up culture with non-punitive reporting. Use scenario-based training with realistic dilemmas. Publicly recognize instances of integrity over convenience.",
  };

  return recs[construct] ?? null;
}

export function LayerResults({ subtestResults, aiInteractions, roleSlug }: LayerResultsProps) {
  const [openLayers, setOpenLayers] = useState<Set<string>>(new Set(["COGNITIVE_CORE"]));
  const [openConstructs, setOpenConstructs] = useState<Set<string>>(new Set());

  const toggleLayer = (layer: string) => {
    const next = new Set(openLayers);
    if (next.has(layer)) next.delete(layer);
    else next.add(layer);
    setOpenLayers(next);
  };

  const toggleConstruct = (construct: string) => {
    const next = new Set(openConstructs);
    if (next.has(construct)) next.delete(construct);
    else next.add(construct);
    setOpenConstructs(next);
  };

  return (
    <div className="bg-card border border-border p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wider" style={{ fontFamily: "var(--font-dm-sans)" }}>
        Layer-by-Layer Results
      </h2>

      <div className="space-y-2">
        {LAYERS.map((layer) => {
          const info = LAYER_INFO[layer];
          const layerOpen = openLayers.has(layer);
          const layerResults = subtestResults.filter((r: any) => r.layer === layer);
          const avgPercentile = layerResults.length > 0
            ? Math.round(layerResults.reduce((s: number, r: any) => s + r.percentile, 0) / layerResults.length)
            : 0;

          return (
            <div key={layer} className="border border-border overflow-hidden">
              <button
                onClick={() => toggleLayer(layer)}
                className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
              >
                <div className="w-2.5 h-2.5" style={{ backgroundColor: info.color }} />
                <div className="flex-1">
                  <span className="text-xs font-medium text-foreground uppercase tracking-wider">{info.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-2 font-mono">Avg: {avgPercentile}</span>
                </div>
                <div className="w-24">
                  <ScoreBar percentile={avgPercentile} height={3} />
                </div>
                {layerOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>

              {layerOpen && (
                <div className="border-t border-border">
                  {/* Layer description */}
                  <div className="px-3 py-2 bg-accent/20">
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{info.description}</p>
                  </div>

                  <div className="p-2 space-y-1.5">
                    {layerResults.map((result: any) => {
                      const meta = CONSTRUCTS[result.construct as keyof typeof CONSTRUCTS];
                      const constructOpen = openConstructs.has(result.construct);
                      const interactions = aiInteractions.filter((ai: any) => ai.construct === result.construct);
                      const tier = getPerformanceTier(result.percentile);
                      const TierIcon = tier.Icon;

                      return (
                        <div key={result.construct} className="bg-accent/30 overflow-hidden">
                          <button
                            onClick={() => toggleConstruct(result.construct)}
                            className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-accent/60 transition-colors"
                          >
                            <span className="text-[10px] font-mono font-semibold w-6 text-center" style={{ color: info.color }}>
                              {meta?.abbreviation}
                            </span>
                            <span className="flex-1 text-xs text-foreground">{meta?.name}</span>
                            <span className={`text-[9px] font-mono font-medium uppercase tracking-wider ${tier.color} px-1.5 py-0.5`}>
                              {tier.label}
                            </span>
                            <span className="text-xs font-semibold font-mono tabular-nums" style={{ color: info.color }}>
                              {result.percentile}
                            </span>
                            <div className="w-16">
                              <ScoreBar percentile={result.percentile} showLabel={false} height={3} />
                            </div>
                            {interactions.length > 0 && (
                              <MessageSquare className="w-3 h-3 text-aci-blue" />
                            )}
                          </button>

                          {constructOpen && (
                            <div className="px-3 pb-3 border-t border-border">
                              {/* Performance tier banner */}
                              <div className="flex items-center gap-2 mt-2.5 mb-2">
                                <TierIcon className={`w-3.5 h-3.5 ${tier.color}`} />
                                <p className="text-[10px] text-muted-foreground leading-relaxed">{tier.description}</p>
                              </div>

                              {/* Rich construct insight */}
                              <div className="mb-3">
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                  {getConstructInsight(result.construct, result.percentile)}
                                </p>
                              </div>

                              {/* Assessment stats */}
                              <div className="grid grid-cols-3 gap-2 text-[10px] mb-3 font-mono p-2 bg-accent/30 border border-border">
                                <div>
                                  <span className="text-muted-foreground uppercase tracking-wider">Items: </span>
                                  <span className="font-medium text-foreground">{result.itemCount}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground uppercase tracking-wider">Avg RT: </span>
                                  <span className="font-medium text-foreground">{Math.round((result.responseTimeAvgMs || 0) / 1000)}s</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground uppercase tracking-wider">SE: </span>
                                  <span className="font-medium text-foreground">{result.standardError?.toFixed(2)}</span>
                                </div>
                              </div>

                              {/* Role relevance */}
                              {roleSlug && meta?.roleRelevance[roleSlug] && (
                                <div className="p-2 bg-accent/30 border border-border mb-3">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Target className="w-3 h-3 text-aci-gold" />
                                    <p className="text-[9px] text-aci-gold uppercase tracking-wider font-medium">Role Relevance</p>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground leading-relaxed">{meta.roleRelevance[roleSlug]}</p>
                                </div>
                              )}

                              {/* Development recommendation */}
                              {getDevelopmentRec(result.construct, result.percentile) && (
                                <div className="p-2 bg-accent/30 border border-border mb-3">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <TrendingUp className="w-3 h-3 text-aci-blue" />
                                    <p className="text-[9px] text-aci-blue uppercase tracking-wider font-medium">Development Path</p>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground leading-relaxed">{getDevelopmentRec(result.construct, result.percentile)}</p>
                                </div>
                              )}

                              {result.narrativeInsight && (
                                <p className="text-[10px] text-muted-foreground italic mb-2">{result.narrativeInsight}</p>
                              )}

                              {interactions.length > 0 && (
                                <div className="mt-2 space-y-1.5">
                                  <p className="text-[10px] font-medium text-aci-blue uppercase tracking-wider">AI Follow-up Interactions</p>
                                  {interactions.map((ai: any) => (
                                    <div key={ai.id} className="bg-card border border-border p-2 text-[10px] space-y-1">
                                      <p className="text-muted-foreground"><strong className="text-foreground">Q:</strong> {ai.aiPrompt}</p>
                                      {ai.candidateResponse && (
                                        <p className="text-foreground"><strong>A:</strong> {ai.candidateResponse}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
