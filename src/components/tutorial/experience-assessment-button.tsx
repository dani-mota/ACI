"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

export function ExperienceAssessmentButton() {
  return (
    <Link
      href="/tutorial/assessment"
      className="group inline-flex items-center gap-2 px-4 py-2 border border-aci-gold/30 bg-aci-gold/5 hover:bg-aci-gold/10 hover:border-aci-gold/50 rounded-sm transition-all text-xs font-medium text-aci-gold"
    >
      <Sparkles className="w-3.5 h-3.5" />
      <span>Experience the Assessment</span>
    </Link>
  );
}
