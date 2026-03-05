interface SubtestScore {
  construct: string;
  percentile: number;
}

export interface IntelligencePanel {
  title: string;
  icon: string;
  narrative: string;
  keyPoints: string[];
  hiringAction?: string;
  riskLevel?: "low" | "moderate" | "elevated";
  developmentNote?: string;
}

/** V2 ceiling characterization data for enriched intelligence reports */
interface CeilingInfo {
  construct: string;
  ceilingType: "HARD_CEILING" | "SOFT_CEILING_TRAINABLE" | "SOFT_CEILING_CONTEXT_DEPENDENT" | "STRESS_INDUCED" | "INSUFFICIENT_DATA";
  narrative?: string;
}

function getLevel(percentile: number): "high" | "mid" | "low" {
  if (percentile >= 75) return "high";
  if (percentile >= 40) return "mid";
  return "low";
}

function getScore(results: SubtestScore[], construct: string): number {
  return results.find(r => r.construct === construct)?.percentile ?? 50;
}

function tierLabel(p: number): string {
  if (p >= 90) return "exceptional";
  if (p >= 75) return "strong";
  if (p >= 50) return "solid";
  if (p >= 25) return "developing";
  return "limited";
}

export function generateWorkStyle(results: SubtestScore[]): IntelligencePanel {
  const ec = getScore(results, "EXECUTIVE_CONTROL");
  const prl = getScore(results, "PROCEDURAL_RELIABILITY");
  const cf = getScore(results, "COGNITIVE_FLEXIBILITY");

  const ecLevel = getLevel(ec);
  const prlLevel = getLevel(prl);

  const narratives: Record<string, string> = {
    "high-high": `This individual combines exceptional focus (${ec}th percentile Executive Control) with strong procedural adherence (${prl}th percentile). They thrive in structured environments where consistency and precision matter. Expect them to follow SOPs reliably while maintaining quality under production pressure. Their cognitive flexibility at the ${cf}th percentile ${cf >= 60 ? "adds adaptability when processes need adjusting" : "suggests they prefer established routines over improvisation"}.`,
    "high-mid": `Strong focus and attention control (${ec}th percentile) paired with moderate procedural consistency (${prl}th percentile). They perform well under structured conditions but may occasionally take shortcuts when confident in their judgment. This is a common pattern in experienced operators who balance efficiency with compliance. Best paired with clear expectations and periodic process audits rather than constant oversight.`,
    "high-low": `Highly focused (${ec}th percentile) but independent-minded about procedures (${prl}th percentile). This profile often signals a creative problem-solver who resists rigid structure — they want to understand why before following how. Consider roles where judgment matters more than checklist compliance, or invest in explaining the rationale behind critical procedures during onboarding.`,
    "mid-high": `Moderate attention control (${ec}th percentile) but strong procedural discipline (${prl}th percentile). They compensate for average focus with systematic work habits — this is actually a resilient pattern. Reliable in routine operations, they use procedures as a framework that prevents errors even when concentration wavers. May struggle when managing multiple complex tasks simultaneously, but rarely drops quality on established workflows.`,
    "mid-mid": `Average profile across focus and procedural dimensions (EC: ${ec}th, PRL: ${prl}th). This is the most common pattern and typically adequate for standard production roles. The key question for hiring managers is whether the specific role has above-average demands in either dimension. Development should target the specific construct where improvement would yield the most operational value for their assigned responsibilities.`,
    "mid-low": `Moderate focus (${ec}th percentile) combined with low procedural reliability (${prl}th percentile). This candidate may need closer supervision initially and structured onboarding that emphasizes the business consequences of procedural deviations. Monitor for quality consistency during the first 90 days. The good news: procedural habits are trainable if the candidate understands why they matter.`,
    "low-high": `Lower attention control (${ec}th percentile) but compensates with strong procedural habits (${prl}th percentile). They rely on checklists and routines to maintain quality — and it works. Effective in repetitive roles where the same procedures apply consistently. May struggle when unexpected problems break their routine, requiring real-time focus allocation. Pair with a troubleshooter for non-standard situations.`,
    "low-mid": `Below-average focus (${ec}th percentile) and moderate procedural adherence (${prl}th percentile). Higher supervision recommended during initial ramp period. Consider whether the role demands sustained concentration or allows task-switching breaks. An environment with clear visual cues, timers, and checklists can significantly compensate for attention limitations.`,
    "low-low": `Both focus (${ec}th percentile) and procedural reliability (${prl}th percentile) are areas of concern. This profile carries elevated risk for quality escapes and requires structured supervision. Not recommended for roles requiring independent quality judgment. If advancing, implement daily check-ins, paired work assignments, and mandatory sign-off checkpoints for critical operations.`,
  };

  const key = `${ecLevel}-${prlLevel}`;
  const keyPoints: string[] = [];

  if (ec >= 75) keyPoints.push("Strong sustained attention — reliable under production pressure and tight deadlines");
  else if (ec < 40) keyPoints.push("Attention management is a development area — consider environments with fewer concurrent demands");

  if (prl >= 75) keyPoints.push("Naturally follows established procedures — low risk of unauthorized process deviations");
  else if (prl < 40) keyPoints.push("Tends to improvise rather than follow SOPs — needs clear communication about non-negotiable procedures");

  if (cf >= 75) keyPoints.push("High adaptability — pivots quickly when plans change or equipment fails mid-shift");
  else if (cf < 40) keyPoints.push("Prefers predictable, routine work — give advance notice for process changes when possible");

  if (ec >= 70 && prl >= 70) keyPoints.push("This work style profile is associated with lowest first-year quality incident rates");
  if (ec < 40 && prl < 40) keyPoints.push("Recommend structured buddy system for first 60 days to build work habits");

  const avgStyle = Math.round((ec + prl + cf) / 3);
  const riskLevel = avgStyle >= 65 ? "low" : avgStyle >= 40 ? "moderate" : "elevated";

  return {
    title: "Work Style & Consistency",
    icon: "clipboard-check",
    narrative: narratives[key] || narratives["mid-mid"],
    keyPoints: keyPoints.length > 0 ? keyPoints : ["Average work style profile — no extreme patterns detected"],
    hiringAction: riskLevel === "low" ? "Standard onboarding appropriate" : riskLevel === "moderate" ? "Add structured check-ins at 30/60/90 days" : "Requires enhanced supervision plan before advancing",
    riskLevel,
    developmentNote: ec < prl ? "Focus development on attention management techniques and distraction reduction" : ec > prl ? "Invest in building procedural habits through structured practice and accountability" : "Balanced profile — develop based on role-specific demands",
  };
}

export function generateLeadership(results: SubtestScore[]): IntelligencePanel {
  const mc = getScore(results, "METACOGNITIVE_CALIBRATION");
  const ej = getScore(results, "ETHICAL_JUDGMENT");
  const fr = getScore(results, "FLUID_REASONING");
  const cf = getScore(results, "COGNITIVE_FLEXIBILITY");

  const keyPoints: string[] = [];
  let narrative: string;
  let riskLevel: "low" | "moderate" | "elevated" = "moderate";

  if (mc >= 75 && ej >= 75) {
    narrative = `Exceptional self-awareness (${mc}th percentile) combined with strong ethical judgment (${ej}th percentile) creates a foundation for trusted leadership. This individual knows what they don't know and makes principled decisions under pressure. They're likely to earn peer respect quickly and can be trusted to escalate problems rather than hide them. ${fr >= 70 ? `With fluid reasoning at the ${fr}th percentile, they can also navigate complex, ambiguous situations that lack clear precedent — a hallmark of senior leaders.` : "Their leadership strength is character-driven rather than analytically-driven; pair them with strong analytical thinkers for best results."}`;
    keyPoints.push("High potential for team lead or mentor role within 12-18 months");
    keyPoints.push("Trusted to make independent quality and safety decisions");
    keyPoints.push("Will model integrity standards that elevate team culture");
    if (cf >= 70) keyPoints.push("Flexible leadership style — adapts approach to different team members and situations");
    riskLevel = "low";
  } else if (mc >= 75 && ej < 40) {
    narrative = `High self-awareness (${mc}th percentile) but lower ethical judgment scores (${ej}th percentile) suggest someone who recognizes when they're unsure but may not always make the right call under pressure. This is often a coaching-responsive pattern — they have the self-reflection capacity to improve, they just need the ethical framework. They may benefit from structured decision frameworks and clear escalation paths that remove ambiguity from tough calls.`;
    keyPoints.push("Provides honest self-assessments — coaching-receptive");
    keyPoints.push("May need clearer ethical guidelines for edge cases and gray areas");
    keyPoints.push("Recommend scenario-based ethics training during onboarding");
    riskLevel = "moderate";
  } else if (mc < 40 && ej >= 75) {
    narrative = `Strong ethical instincts (${ej}th percentile) but limited self-awareness (${mc}th percentile). This person does the right thing but may overestimate their own capabilities. They'll speak up about quality problems they see, but may not recognize quality problems they're causing. They need feedback mechanisms to calibrate their confidence with their actual skill level. Regular, specific performance data (not just "good job") helps bridge this gap.`;
    keyPoints.push("Reliable for ethical decisions — will flag problems others hide");
    keyPoints.push("May need help recognizing own knowledge gaps and limitations");
    keyPoints.push("Provide quantitative feedback (scrap rates, cycle times) to build self-calibration");
    riskLevel = "moderate";
  } else if (mc < 40 && ej < 40) {
    narrative = `Both metacognitive calibration (${mc}th percentile) and ethical judgment (${ej}th percentile) are below average. This combination elevates risk — the individual may not recognize their limitations AND may not make the right call when it matters. This is the profile most associated with quality escapes that could have been prevented by speaking up. Close supervision and structured decision-making protocols are non-negotiable if advancing this candidate.`;
    keyPoints.push("Elevated risk profile for unsupervised decision-making");
    keyPoints.push("Requires structured supervision with clear escalation triggers");
    keyPoints.push("Not recommended for safety-critical independent judgment roles");
    keyPoints.push("If hired, implement mandatory peer review for all critical decisions");
    riskLevel = "elevated";
  } else {
    narrative = `Moderate leadership indicators with metacognitive calibration at the ${mc}th percentile and ethical judgment at the ${ej}th percentile. This profile doesn't raise red flags but doesn't signal exceptional leadership potential either. Most manufacturing roles don't require exceptional leadership from day one — with mentoring, structured feedback, and incremental responsibility increases, leadership capacity typically develops over 18-24 months for candidates in this range.`;
    keyPoints.push("Adequate for current role responsibilities — no immediate concerns");
    if (fr >= 75) keyPoints.push(`Strong reasoning ability (${fr}th percentile) supports growth into technical leadership`);
    if (ej >= 60) keyPoints.push("Ethical foundation is solid — will follow established standards");
    if (mc >= 50) keyPoints.push("Reasonable self-awareness — receptive to feedback");
  }

  if (fr >= 75 && mc >= 60) keyPoints.push("Problem-solving ability combined with self-awareness suggests long-term senior leadership trajectory");

  return {
    title: "Leadership & Decision-Making",
    icon: "compass",
    narrative,
    keyPoints: keyPoints.length > 0 ? keyPoints : ["Standard leadership profile"],
    hiringAction: riskLevel === "low" ? "Consider for accelerated development track" : riskLevel === "elevated" ? "Requires structured supervision plan — document before advancing" : "Standard development pathway appropriate",
    riskLevel,
    developmentNote: mc < ej ? "Invest in self-assessment exercises and regular calibration feedback sessions" : mc > ej ? "Scenario-based ethics training and decision-framework workshops recommended" : "Balanced development across self-awareness and judgment",
  };
}

export function generatePractical(results: SubtestScore[], ceilings?: CeilingInfo[]): IntelligencePanel {
  const sd = getScore(results, "SYSTEMS_DIAGNOSTICS");
  const mr = getScore(results, "MECHANICAL_REASONING");
  const sv = getScore(results, "SPATIAL_VISUALIZATION");
  const qr = getScore(results, "QUANTITATIVE_REASONING");
  const pr = getScore(results, "PATTERN_RECOGNITION");

  const keyPoints: string[] = [];
  const strengths: string[] = [];
  const gaps: string[] = [];

  if (sd >= 75) strengths.push("systems thinking");
  if (mr >= 75) strengths.push("mechanical intuition");
  if (sv >= 75) strengths.push("spatial reasoning");
  if (qr >= 75) strengths.push("quantitative skills");
  if (pr >= 75) strengths.push("pattern recognition");

  if (sd < 40) gaps.push("systems diagnostics");
  if (mr < 40) gaps.push("mechanical reasoning");
  if (sv < 40) gaps.push("spatial visualization");
  if (qr < 40) gaps.push("quantitative reasoning");
  if (pr < 40) gaps.push("pattern recognition");

  let narrative: string;
  let riskLevel: "low" | "moderate" | "elevated" = "moderate";

  if (strengths.length >= 3) {
    narrative = `Broad technical strength across ${strengths.join(", ")}. This candidate has the cognitive toolkit for complex technical roles — they can visualize problems in 3D (SV: ${sv}th), work with numbers and tolerances (QR: ${qr}th), understand how systems interact (SD: ${sd}th), and spot anomalies before they become defects (PR: ${pr}th). This rare combination predicts rapid mastery of advanced manufacturing processes and suggests they'll be the person others come to for troubleshooting within 6 months.`;
    keyPoints.push("Candidate for accelerated technical development and cross-training");
    keyPoints.push(`Strongest technical area: ${strengths[0]} — leverage for immediate impact`);
    keyPoints.push("Can handle complex, multi-variable problems that stump average performers");
    if (mr >= 70 && sv >= 70) keyPoints.push("Mechanical + spatial combination is ideal for hands-on roles (CNC, fixture setup, process development)");
    if (qr >= 70 && pr >= 70) keyPoints.push("Quantitative + pattern combo excels in quality, metrology, and SPC analysis roles");
    riskLevel = "low";
  } else if (strengths.length >= 1 && gaps.length === 0) {
    narrative = `Solid technical foundation with particular strength in ${strengths.join(" and ")}. No significant gaps across technical aptitude constructs — scores range from ${tierLabel(Math.min(sd, mr, sv, qr, pr))} to ${tierLabel(Math.max(sd, mr, sv, qr, pr))}. This profile supports reliable performance in most manufacturing roles with appropriate training. The candidate won't be the fastest to troubleshoot novel problems but also won't be a bottleneck.`;
    keyPoints.push(`Leverage strength in ${strengths[0]} for maximum initial contribution`);
    keyPoints.push("Well-rounded technical capabilities — versatile across assignments");
    keyPoints.push("Can serve as a reliable backup across multiple workstations");
    riskLevel = "low";
  } else if (gaps.length >= 2) {
    narrative = `Technical aptitude shows gaps in ${gaps.join(" and ")} (below 40th percentile). ${strengths.length > 0 ? `Strength in ${strengths.join(", ")} partially compensates, but ` : ""}these gaps may limit effectiveness in roles requiring broad technical reasoning. Critical question for hiring managers: does the specific role demand these capabilities daily, or can they be worked around through job design, tooling, or team support? Some gaps are trainable (quantitative skills improve with practice); others (spatial visualization, mechanical intuition) are more innate.`;
    keyPoints.push(`Development needed: ${gaps.join(", ")} — assess whether role-critical`);
    if (strengths.length > 0) keyPoints.push(`Can leverage: ${strengths.join(", ")} — assign work that plays to these strengths`);
    keyPoints.push("Consider whether technology (visual aids, software tools) can compensate for gaps");
    if (gaps.includes("spatial visualization")) keyPoints.push("Spatial gaps are difficult to train — may limit fixture setup and complex assembly roles");
    riskLevel = gaps.length >= 3 ? "elevated" : "moderate";
  } else {
    narrative = `Average technical aptitude profile (SD: ${sd}th, MR: ${mr}th, SV: ${sv}th, QR: ${qr}th, PR: ${pr}th percentile). This profile is typical and adequate for standard manufacturing roles. No construct stands out as a strength or concern. The candidate should be able to handle routine technical demands but may need support for complex troubleshooting. Target training at the lowest-scoring construct for maximum improvement — small gains at the bottom have more operational impact than marginal gains at the top.`;
    keyPoints.push("Standard technical profile — no extreme strengths or gaps");
    keyPoints.push("Adequate for routine operations with appropriate training support");
  }

  // V2 ceiling enrichment: add ceiling-specific insights
  if (ceilings && ceilings.length > 0) {
    const technicalConstructs = ["QUANTITATIVE_REASONING", "SPATIAL_VISUALIZATION", "MECHANICAL_REASONING", "PATTERN_RECOGNITION", "FLUID_REASONING"];
    const relevant = ceilings.filter(c => technicalConstructs.includes(c.construct));
    for (const c of relevant) {
      const name = c.construct.toLowerCase().replace(/_/g, " ");
      if (c.ceilingType === "HARD_CEILING") {
        keyPoints.push(`Hard ceiling in ${name} — this is an innate limitation, not a training gap`);
      } else if (c.ceilingType === "SOFT_CEILING_TRAINABLE") {
        keyPoints.push(`Trainable ceiling in ${name} — structured practice can raise this capability`);
      } else if (c.ceilingType === "STRESS_INDUCED") {
        keyPoints.push(`Stress-induced ceiling in ${name} — performance degrades under pressure, recoverable with support`);
      }
    }
  }

  return {
    title: "Practical & Technical Ability",
    icon: "wrench",
    narrative,
    keyPoints: keyPoints.length > 0 ? keyPoints : ["Average technical aptitude"],
    hiringAction: strengths.length >= 3 ? "Fast-track for technical specialist roles" : gaps.length >= 2 ? "Verify role requirements against specific gaps before advancing" : "Standard technical onboarding appropriate",
    riskLevel,
    developmentNote: gaps.length > 0 ? `Priority development: ${gaps[0]} — ${gaps[0] === "quantitative reasoning" ? "responsive to structured practice" : gaps[0] === "systems diagnostics" ? "improves with cross-functional exposure" : "inherent aptitude — focus on compensating strategies"}` : "Maintain breadth through cross-training rotations",
  };
}

export function generateTeamDynamics(results: SubtestScore[]): IntelligencePanel {
  const ej = getScore(results, "ETHICAL_JUDGMENT");
  const prl = getScore(results, "PROCEDURAL_RELIABILITY");
  const cf = getScore(results, "COGNITIVE_FLEXIBILITY");
  const mc = getScore(results, "METACOGNITIVE_CALIBRATION");

  const keyPoints: string[] = [];
  let narrative: string;
  let riskLevel: "low" | "moderate" | "elevated" = "moderate";

  const teamScore = Math.round((ej + prl + cf + mc) / 4);

  if (teamScore >= 70) {
    narrative = `Strong team contributor profile (composite team score: ${teamScore}th percentile). High ethical judgment (${ej}th) means they'll speak up about problems even when it's uncomfortable — this is the single strongest predictor of healthy team culture. ${cf >= 70 ? `Cognitive flexibility (${cf}th) allows them to adapt to different teammates' approaches without friction.` : ""} ${mc >= 70 ? `Good self-awareness (${mc}th) means they'll ask for help when needed rather than causing delays or quality issues silently.` : ""} This person is likely to earn trust quickly, contribute positively to team culture, and become the kind of teammate that senior operators specifically request on their shift.`;
    keyPoints.push("Positive influence on team culture — models speak-up behavior");
    keyPoints.push("Likely to build trust quickly with peers and supervisors");
    keyPoints.push("Can be trusted in pair-work and collaborative troubleshooting");
    if (ej >= 80) keyPoints.push("Exceptional ethical foundation — consider for peer mentor or safety champion role");
    if (cf >= 75 && mc >= 60) keyPoints.push("Adaptable and self-aware — handles team reorganizations and new member integration smoothly");
    riskLevel = "low";
  } else if (teamScore >= 45) {
    narrative = `Average team dynamics profile (composite: ${teamScore}th percentile). No significant concerns but no standout team strengths either. They'll integrate into most teams without friction, contributing reliably to established workflows. ${ej < 50 ? `Monitor for tendency to go along with the group rather than raising concerns — ethical judgment at ${ej}th percentile suggests they may defer to authority even when they notice problems.` : ""} ${cf < 50 ? `May need time to adapt to new team configurations or process changes (CF: ${cf}th percentile).` : ""} ${mc < 50 ? `Moderate self-awareness (${mc}th) — may occasionally over- or under-estimate their contribution to team objectives.` : ""}`;
    keyPoints.push("Standard team integration expected — no special accommodations needed");
    if (prl >= 60) keyPoints.push("Procedural reliability supports consistent team contribution — teammates can count on them");
    if (ej >= 50) keyPoints.push("Will follow team norms and standards without pushback");
    if (cf >= 60) keyPoints.push("Flexible enough to cover different team roles when needed");
    keyPoints.push("Encourage participation in team retrospectives to build engagement");
  } else {
    narrative = `Below-average team integration indicators (composite: ${teamScore}th percentile). ${ej < 40 ? `Ethical judgment at ${ej}th percentile raises concerns about willingness to flag problems to teammates — in manufacturing, this silence can directly impact quality and safety.` : ""} ${mc < 40 ? `Low metacognitive calibration (${mc}th) may lead to overcommitting, under-communicating difficulties, or not recognizing when they need to ask for help.` : ""} ${cf < 40 ? `Low cognitive flexibility (${cf}th) suggests difficulty adapting to different team dynamics or accepting feedback on established habits.` : ""} Structured team integration with clear role definitions, explicit communication expectations, and regular feedback loops is recommended.`;
    keyPoints.push("Structured team onboarding with explicit behavioral expectations");
    keyPoints.push("Clear role boundaries and communication protocols will ease integration");
    keyPoints.push("Assign a specific peer buddy for the first 60 days");
    if (ej < 40) keyPoints.push("Create safe channels for raising concerns — this person may not speak up voluntarily");
    riskLevel = "elevated";
  }

  return {
    title: "Team Dynamics & Culture Fit",
    icon: "users",
    narrative,
    keyPoints: keyPoints.length > 0 ? keyPoints : ["Standard team profile"],
    hiringAction: riskLevel === "low" ? "Integrate into any team — they'll elevate culture" : riskLevel === "elevated" ? "Requires structured integration plan with defined support network" : "Standard team onboarding, periodic check-ins on integration",
    riskLevel,
    developmentNote: ej < 50 ? "Build psychological safety through 1:1 check-ins where speaking up is explicitly rewarded" : cf < 50 ? "Gradual exposure to different teams and roles to build adaptability" : "Encourage peer mentoring to strengthen team bonds",
  };
}

export function generateSelfAwareness(results: SubtestScore[]): IntelligencePanel {
  const mc = getScore(results, "METACOGNITIVE_CALIBRATION");
  const lv = getScore(results, "LEARNING_VELOCITY");
  const fr = getScore(results, "FLUID_REASONING");

  const keyPoints: string[] = [];
  let narrative: string;
  let riskLevel: "low" | "moderate" | "elevated" = "moderate";

  if (mc >= 75) {
    narrative = `Exceptional metacognitive calibration (${mc}th percentile) — this candidate accurately assesses what they know and what they don't. This is one of the most undervalued capabilities in manufacturing: the ability to say "I'm not sure" instead of guessing. ${lv >= 70 ? `Combined with high learning velocity (${lv}th), they identify gaps quickly and fill them efficiently. This is the ideal trainee profile — they learn fast AND they know when they need to learn.` : `Even with moderate learning speed (${lv}th), their self-awareness means they seek help at the right moments, preventing costly mistakes during ramp-up. They'll learn at a normal pace but with far fewer errors along the way.`} ${fr >= 70 ? `High fluid reasoning (${fr}th) adds another dimension — they not only know what they don't know, they can figure it out independently when resources are available.` : ""}`;
    keyPoints.push("Accurately judges own capability boundaries — the #1 safety predictor");
    keyPoints.push("Will ask for help rather than guess — prevents costly trial-and-error");
    keyPoints.push("Provides reliable self-assessments during performance reviews");
    keyPoints.push("Can be trusted to self-identify training needs — reduces management overhead");
    riskLevel = "low";
  } else if (mc >= 50) {
    narrative = `Moderate self-awareness (${mc}th percentile). They generally know when they're in over their head but may occasionally overestimate confidence in familiar-seeming situations — the classic "I've seen something like this before" trap. ${lv >= 70 ? "High learning velocity helps compensate — they course-correct quickly when wrong, minimizing the cost of miscalibration." : "Standard onboarding checkpoints should catch any calibration gaps."} This is the most common profile and manageable with normal supervision structures. The key risk window is 3-6 months in, when comfort grows faster than actual competence.`;
    keyPoints.push("Generally reliable self-assessment — adequate for most roles");
    if (mc < 60) keyPoints.push("Watch for overconfidence in familiar domains — the 'I've done this before' error");
    keyPoints.push("Schedule calibration check-ins at 3 and 6 months when comfort outpaces competence");
    if (lv >= 60) keyPoints.push("Fast course-correction when errors are pointed out — responsive to feedback");
  } else {
    narrative = `Low metacognitive calibration (${mc}th percentile) is a notable concern for any manufacturing role. This candidate may not recognize when they're making errors or operating beyond their competence. ${lv >= 70 ? "Their fast learning partially compensates, but the gap between confidence and capability could lead to quality issues — they learn quickly but may not realize when they've learned wrong." : "Combined with moderate learning speed, this profile requires structured verification checkpoints and explicit sign-offs before advancing to independent work."} In safety-critical or quality-critical roles, this profile requires mandatory verification steps and should not be cleared for unsupervised work until calibration improves through experience.`;
    keyPoints.push("Significant risk of not recognizing own errors — requires verification protocols");
    keyPoints.push("Structured checkpoints with explicit sign-off before independent work");
    keyPoints.push("Pair with a mentor who actively quizzes them ('Are you sure? How do you know?')");
    keyPoints.push("Track error rates during ramp — if they don't decline as expected, escalate to training review");
    riskLevel = "elevated";
  }

  return {
    title: "Self-Awareness & Growth Potential",
    icon: "lightbulb",
    narrative,
    keyPoints: keyPoints.length > 0 ? keyPoints : ["Standard self-awareness profile"],
    hiringAction: riskLevel === "low" ? "Trust their self-assessments — empower self-directed development" : riskLevel === "elevated" ? "Implement mandatory verification steps for all critical operations" : "Standard supervision with periodic calibration check-ins",
    riskLevel,
    developmentNote: mc < 50 ? "Build calibration through prediction exercises: ask them to predict their performance before tasks, then compare to actual results" : "Maintain through regular self-reflection opportunities and honest feedback culture",
  };
}

export function generateOnboarding(results: SubtestScore[], roleName?: string): IntelligencePanel {
  const lv = getScore(results, "LEARNING_VELOCITY");
  const ec = getScore(results, "EXECUTIVE_CONTROL");
  const prl = getScore(results, "PROCEDURAL_RELIABILITY");
  const sd = getScore(results, "SYSTEMS_DIAGNOSTICS");
  const mc = getScore(results, "METACOGNITIVE_CALIBRATION");
  const fr = getScore(results, "FLUID_REASONING");

  const keyPoints: string[] = [];
  let narrative: string;
  let riskLevel: "low" | "moderate" | "elevated" = "moderate";

  const rampWeeks = lv >= 80 ? "2-3" : lv >= 60 ? "4-6" : lv >= 40 ? "6-10" : "10-14";
  const independenceWeeks = lv >= 80 ? "4-6" : lv >= 60 ? "8-12" : lv >= 40 ? "12-16" : "16-20";

  if (lv >= 75) {
    narrative = `Fast learner (${lv}th percentile Learning Velocity). Estimated productive ramp: ${rampWeeks} weeks${roleName ? ` for ${roleName}` : ""}. Estimated full independence: ${independenceWeeks} weeks. ${ec >= 70 ? "Strong focus means they'll absorb training efficiently without constant redirection — you can front-load material and they'll retain it." : "Training should be structured with clear milestones — fast learners can lose focus without clear targets and may skip fundamentals if not checked."} ${sd >= 70 ? "Systems thinking ability means they'll understand the 'why' behind procedures, not just the 'how' — this accelerates troubleshooting independence significantly." : ""} ${mc >= 70 ? "High self-awareness means they'll tell you when training is moving too fast or when they need to revisit something — rare and valuable." : "Monitor for false confidence — fast learners sometimes assume mastery before achieving it."}`;
    keyPoints.push(`Estimated productive contribution: ${rampWeeks} weeks | Full independence: ${independenceWeeks} weeks`);
    keyPoints.push("Can handle accelerated training schedule — don't hold them back");
    if (prl >= 60) keyPoints.push("Will adopt new procedures reliably once trained — low retraining risk");
    keyPoints.push("Consider compressed onboarding with early exposure to complex scenarios");
    if (fr >= 70) keyPoints.push("Can generalize from training examples to novel situations — needs fewer reps");
    riskLevel = "low";
  } else if (lv >= 45) {
    narrative = `Average learning velocity (${lv}th percentile). Estimated productive ramp: ${rampWeeks} weeks${roleName ? ` for ${roleName}` : ""}. Estimated full independence: ${independenceWeeks} weeks. Standard onboarding timeline applies — resist the temptation to accelerate. ${prl >= 70 ? "Strong procedural reliability means they'll master standard operations reliably once trained — they may be slower to learn but they'll lock in what they learn." : "Build in extra practice repetitions for critical procedures. Quality of practice matters more than quantity — use increasingly challenging scenarios."} ${ec >= 60 ? "Adequate focus for standard training format." : "Consider shorter training sessions with more frequent breaks to maintain retention."}`;
    keyPoints.push(`Estimated productive contribution: ${rampWeeks} weeks | Full independence: ${independenceWeeks} weeks`);
    keyPoints.push("Standard onboarding timeline — follow established program");
    if (prl >= 60) keyPoints.push("Once trained, procedures stick — low ongoing retraining burden");
    keyPoints.push("Use hands-on practice over classroom instruction for best retention");
  } else {
    narrative = `Below-average learning velocity (${lv}th percentile). Estimated productive ramp: ${rampWeeks} weeks${roleName ? ` for ${roleName}` : ""}. Estimated full independence: ${independenceWeeks} weeks. Extended onboarding with additional mentoring recommended. ${prl >= 60 ? "Positive: once they learn a procedure, they follow it consistently — the investment in extended training pays off through long-term reliability." : "Extra attention needed — slow learning combined with inconsistent procedure-following requires patient, structured training with frequent assessment checkpoints."} Consider pairing with an experienced mentor for the first ${independenceWeeks} weeks. The cost of extended onboarding should be weighed against the candidate's other strengths.`;
    keyPoints.push(`Estimated productive contribution: ${rampWeeks} weeks | Full independence: ${independenceWeeks} weeks`);
    keyPoints.push("Pair with dedicated experienced mentor — not just any available person");
    keyPoints.push("Break complex procedures into smaller sub-steps with mastery checks at each stage");
    keyPoints.push("Use visual aids, checklists, and reference cards extensively");
    if (prl >= 60) keyPoints.push("Retention is strong once learned — front-load investment in thorough initial training");
    riskLevel = lv < 30 ? "elevated" : "moderate";
  }

  return {
    title: "Onboarding & Ramp Prediction",
    icon: "rocket",
    narrative,
    keyPoints: keyPoints.length > 0 ? keyPoints : ["Standard onboarding expectations"],
    hiringAction: lv >= 75 ? "Consider compressed onboarding track — this candidate will outpace standard programs" : lv < 40 ? "Budget for extended onboarding (2-3x standard) — confirm ROI before advancing" : "Follow standard onboarding program",
    riskLevel,
    developmentNote: lv < 50 ? "Invest in high-quality initial training — slower learners benefit disproportionately from excellent instruction and repetition" : "Enable self-directed learning with available resources — fast learners thrive with autonomy",
  };
}

export function generateAllPanels(results: SubtestScore[], roleName?: string, ceilings?: CeilingInfo[]): IntelligencePanel[] {
  return [
    generateWorkStyle(results),
    generateLeadership(results),
    generatePractical(results, ceilings),
    generateTeamDynamics(results),
    generateSelfAwareness(results),
    generateOnboarding(results, roleName),
  ];
}
