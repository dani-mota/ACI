"use client";

import { useState } from "react";
import { Target, AlertTriangle, Clock, ChevronDown, ChevronRight } from "lucide-react";
import { CONSTRUCTS } from "@/lib/constructs";
import type { AssessmentMode } from "@/generated/prisma/enums";
import { isEmployeeMode } from "@/lib/assessment/mode-utils";

interface InterviewGuideProps {
  subtestResults: any[];
  redFlags: any[];
  // PRO-134: optional. When passed as "EMPLOYEE", suppresses the Red Flag
  // section only — the probe/validate sections are informational and stay.
  assessmentMode?: AssessmentMode | null;
}

const INTERVIEW_QUESTIONS: Record<string, { questions: string[]; listenFor: string }> = {
  FLUID_REASONING: {
    questions: [
      "Describe a time you faced a problem you had never seen before. Walk me through how you figured out what to do.",
      "Give me an example of when you had to make a decision with incomplete information. What was your process?",
    ],
    listenFor: "Systematic approach to novel problems, ability to reason from first principles, comfort with ambiguity",
  },
  EXECUTIVE_CONTROL: {
    questions: [
      "Tell me about a time you had to manage multiple urgent priorities on the shop floor. How did you decide what came first?",
      "Describe a situation where you had to maintain focus during a long, repetitive task. How did you stay sharp?",
    ],
    listenFor: "Prioritization strategies, sustained attention under pressure, awareness of own focus limits",
  },
  COGNITIVE_FLEXIBILITY: {
    questions: [
      "Give me an example of when your original approach to a task wasn't working. How did you adapt?",
      "Tell me about a time when a process or procedure changed significantly. How did you handle the transition?",
    ],
    listenFor: "Willingness to abandon failing strategies, speed of adaptation, openness to different approaches",
  },
  METACOGNITIVE_CALIBRATION: {
    questions: [
      "When was the last time you realized mid-task that you were in over your head? What did you do?",
      "How do you decide when to ask for help vs. figure something out yourself?",
    ],
    listenFor: "Accurate self-assessment, willingness to admit uncertainty, healthy boundary between confidence and humility",
  },
  LEARNING_VELOCITY: {
    questions: [
      "Describe the last completely new skill or tool you had to learn. How long did it take to feel competent?",
      "What's your approach when you need to get up to speed on something quickly?",
    ],
    listenFor: "Active learning strategies, self-directed initiative, specific examples with timelines",
  },
  SYSTEMS_DIAGNOSTICS: {
    questions: [
      "Walk me through how you would troubleshoot a machine that was producing out-of-spec parts intermittently.",
      "Describe a time you traced a quality issue back to its root cause. What was your process?",
    ],
    listenFor: "Systematic isolation approach, understanding of cause-and-effect chains, consideration of multiple variables",
  },
  PATTERN_RECOGNITION: {
    questions: [
      "Tell me about a time you noticed something was 'off' before anyone else did. What tipped you off?",
      "How do you monitor quality during a production run? What are the early warning signs you watch for?",
    ],
    listenFor: "Sensitivity to anomalies, ability to spot trends in data or behavior, proactive monitoring habits",
  },
  QUANTITATIVE_REASONING: {
    questions: [
      "Describe how you work with tolerances and measurements day-to-day. Give me a specific example.",
      "Walk me through a time when you had to calculate feeds and speeds or make a quantitative adjustment.",
    ],
    listenFor: "Comfort with numbers, GD&T fluency, practical application of math to real work",
  },
  SPATIAL_VISUALIZATION: {
    questions: [
      "How do you read and interpret complex engineering drawings? Describe your process for a tricky part.",
      "Describe how you'd fixture a complex part to access a hard-to-reach feature.",
    ],
    listenFor: "Ability to decompose complex shapes, mental rotation skills, reference to 3D thinking",
  },
  MECHANICAL_REASONING: {
    questions: [
      "Explain a time when understanding how forces or mechanics work helped you solve a practical problem.",
      "If you noticed unusual vibration during a machining operation, what would you check first and why?",
    ],
    listenFor: "Physical intuition, understanding of force/motion relationships, practical troubleshooting instincts",
  },
  PROCEDURAL_RELIABILITY: {
    questions: [
      "Tell me about a time following the exact procedure felt slow or unnecessary. What did you do?",
      "How do you handle situations where a shortcut could save time but might risk quality?",
    ],
    listenFor: "Respect for process discipline, understanding of why procedures exist, appropriate vs. inappropriate deviation",
  },
  ETHICAL_JUDGMENT: {
    questions: [
      "Describe a situation where you had to choose between the easy path and the right path at work. What happened?",
      "Tell me about a time you noticed a coworker doing something that could affect safety or quality. How did you handle it?",
    ],
    listenFor: "Moral courage, willingness to speak up, ability to balance relationships with standards",
  },
};

function ConstructSection({
  result,
  type,
}: {
  result: any;
  type: "probe" | "validate";
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = CONSTRUCTS[result.construct as keyof typeof CONSTRUCTS];
  const questions = INTERVIEW_QUESTIONS[result.construct];
  const colorClass = type === "probe" ? "aci-amber" : "aci-green";
  const bgClass = type === "probe" ? "bg-aci-amber/5 border-aci-amber/20" : "bg-aci-green/5 border-aci-green/20";

  return (
    <div className={`border ${bgClass}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-2 p-2 text-left"
      >
        <Target className={`w-3 h-3 text-${colorClass} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium text-foreground font-mono">
            {meta?.name} (Scaled Score: {result.percentile})
          </p>
          {!expanded && (
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed truncate">
              {meta?.definition}
            </p>
          )}
        </div>
        {questions && (
          expanded
            ? <ChevronDown className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
            : <ChevronRight className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
        )}
      </button>
      {expanded && questions && (
        <div className="px-2 pb-2 space-y-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed pl-5">
            {meta?.definition}
          </p>
          <div className="pl-5 space-y-1.5">
            {questions.questions.map((q, i) => (
              <div key={i} className="flex gap-1.5">
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">Q{i + 1}.</span>
                <p className="text-[10px] text-foreground leading-relaxed">{q}</p>
              </div>
            ))}
          </div>
          <div className="pl-5 pt-1 border-t border-border/50">
            <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
              What to Listen For
            </p>
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">
              {questions.listenFor}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function InterviewGuide({ subtestResults, redFlags, assessmentMode }: InterviewGuideProps) {
  const sorted = [...subtestResults].sort((a: any, b: any) => a.percentile - b.percentile);
  const weakest = sorted.slice(0, 3);
  const strongest = sorted.slice(-2).reverse();
  // PRO-134: Red Flag follow-ups never render in Employee Mode.
  const showRedFlags = !isEmployeeMode({ assessmentMode }) && redFlags.length > 0;

  return (
    <div className="bg-card border border-border p-4">
      <h3 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Interview Prep Kit
      </h3>

      {/* Time allocation */}
      <div className="flex items-center gap-2 p-2 bg-accent/30 border border-border mb-3">
        <Clock className="w-3 h-3 text-aci-gold shrink-0" />
        <div>
          <p className="text-[9px] font-semibold text-foreground uppercase tracking-wider">Recommended: 45-min interview</p>
          <p className="text-[9px] text-muted-foreground">
            15 min probes · 10 min strengths · 10 min culture · 10 min Q&A
          </p>
        </div>
      </div>

      {/* Areas to probe */}
      <div className="space-y-1.5 mb-4">
        <p className="text-[10px] font-medium text-foreground uppercase tracking-wider">Probe These Areas</p>
        {weakest.map((result: any) => (
          <ConstructSection key={result.construct} result={result} type="probe" />
        ))}
      </div>

      {/* Strengths to validate */}
      <div className="space-y-1.5 mb-4">
        <p className="text-[10px] font-medium text-foreground uppercase tracking-wider">Validate Strengths</p>
        {strongest.map((result: any) => (
          <ConstructSection key={result.construct} result={result} type="validate" />
        ))}
      </div>

      {/* Red flag follow-ups */}
      {showRedFlags && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-foreground uppercase tracking-wider">Flag Follow-ups</p>
          {redFlags.map((flag: any) => (
            <div key={flag.id} className="flex items-start gap-2 p-2 bg-aci-red/5 border border-aci-red/20">
              <AlertTriangle className="w-3 h-3 text-aci-red mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-medium text-foreground font-mono">{flag.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{flag.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Export questions map for PDF use
export { INTERVIEW_QUESTIONS };
