"use client";

import { useRouter } from "next/navigation";
import { Shield, Rocket, Bot, Brain, ArrowRight } from "lucide-react";
import { useAppStore, type TutorialIndustry } from "@/stores/app-store";

const INDUSTRY_CARDS = [
  {
    id: "defense-manufacturing" as TutorialIndustry,
    name: "Defense & Aerospace Manufacturing",
    tagline: "Production technicians, machinists, and engineers building defense systems and precision parts",
    roles: ["Factory Technician", "CNC Machinist", "Manufacturing Engineer"],
    Icon: Shield,
    org: "Atlas Defense Corp",
  },
  {
    id: "space-satellite" as TutorialIndustry,
    name: "Space & Satellite Systems",
    tagline: "Systems engineers, propulsion, avionics, and integration for spacecraft and launch systems",
    roles: ["Systems Engineer", "Propulsion Engineer", "Test Engineer"],
    Icon: Rocket,
    org: "Orbital Dynamics",
  },
  {
    id: "hardware-ai" as TutorialIndustry,
    name: "Hardware + AI / Robotics",
    tagline: "Teams building at the intersection of physical systems and intelligent software",
    roles: ["Robotics Engineer", "Firmware Engineer", "ML Engineer"],
    Icon: Bot,
    org: "Nexus Robotics",
  },
  {
    id: "ai-software" as TutorialIndustry,
    name: "AI & Software",
    tagline: "ML engineers, research scientists, and platform engineers for AI-native teams",
    roles: ["Senior AI Engineer", "Software Engineer", "ML Engineer", "AI Research Scientist", "Data Engineer"],
    Icon: Brain,
    org: "Vertex AI Labs",
  },
] as const;

export function AudienceSelector() {
  const router = useRouter();
  const setTutorialIndustry = useAppStore((s) => s.setTutorialIndustry);

  function handleSelect(id: TutorialIndustry) {
    // Zustand persist flushes synchronously via subscribe, so by the time
    // router.push fires the cookie already contains the Zustand format:
    // { state: { tutorialIndustry: "..." }, version: 0 }
    // Server pages read state?.tutorialIndustry to handle this format.
    setTutorialIndustry(id);
    router.push("/tutorial/dashboard");
  }

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-background flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-medium tracking-widest uppercase text-[--aci-gold] mb-3 font-mono">
            ACI Assessment Platform
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-3">
            What kind of team are you building?
          </h1>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Select your industry to explore a tailored demo with realistic candidates and roles.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INDUSTRY_CARDS.map(({ id, name, tagline, roles, Icon, org }) => (
            <button
              key={id}
              onClick={() => handleSelect(id)}
              className="group relative text-left bg-card border border-border rounded-xl p-6 hover:border-[--aci-gold]/50 hover:bg-card/80 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--aci-gold]/50"
            >
              {/* Icon + org name */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-lg bg-[--aci-gold]/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-[--aci-gold]" />
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-[--aci-gold]/60 group-hover:translate-x-0.5 transition-all duration-150 mt-0.5" />
              </div>

              {/* Name */}
              <h2 className="text-sm font-semibold text-foreground mb-1.5 leading-snug">
                {name}
              </h2>

              {/* Tagline */}
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                {tagline}
              </p>

              {/* Role pills */}
              <div className="flex flex-wrap gap-1.5">
                {roles.map((role) => (
                  <span
                    key={role}
                    className="inline-block px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded-full"
                  >
                    {role}
                  </span>
                ))}
              </div>

              {/* Org name */}
              <p className="mt-4 text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wide">
                {org}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
