"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Copy, PenLine, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TemplateRole {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}

interface RoleBuilderInputClientProps {
  templates: TemplateRole[];
}

type Tab = "jd" | "clone" | "manual";

const STAGE_LABELS = [
  "Extracting role context…",
  "Matching O*NET occupations…",
  "Generating construct weights…",
  "Writing research rationale…",
  "Building hiring intelligence…",
];

export function RoleBuilderInputClient({ templates }: RoleBuilderInputClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("jd");
  const [isPending, startTransition] = useTransition();

  // JD upload state
  const [jdText, setJdText] = useState("");

  // Clone state
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Manual form state
  const [form, setForm] = useState({
    title: "",
    description: "",
    responsibilities: "",
    skills: "",
    environment: "",
    experienceLevel: "MID",
    safetyCritical: false,
    qualityCritical: true,
  });

  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<number>(-1);

  const simulateStages = async (fn: () => Promise<Response>) => {
    setError(null);
    setStage(0);
    const interval = setInterval(() => {
      setStage((s) => (s < STAGE_LABELS.length - 1 ? s + 1 : s));
    }, 1800);

    try {
      const res = await fn();
      clearInterval(interval);
      setStage(STAGE_LABELS.length - 1);

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Analysis failed. Please try again.");
        setStage(-1);
        return;
      }

      const result = await res.json();
      sessionStorage.setItem("roleBuilderResult", JSON.stringify(result));
      startTransition(() => router.push("/roles/builder"));
    } catch {
      clearInterval(interval);
      setError("Network error. Please try again.");
      setStage(-1);
    }
  };

  const handleSubmit = () => {
    if (tab === "jd") {
      if (jdText.trim().length < 50) {
        setError("Please paste at least 50 characters of job description text.");
        return;
      }
      simulateStages(() =>
        fetch("/api/roles/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: "JD_UPLOAD", text: jdText }),
        })
      );
    } else if (tab === "clone") {
      if (!selectedTemplate) {
        setError("Please select a template role to clone.");
        return;
      }
      simulateStages(() =>
        fetch("/api/roles/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: "TEMPLATE_CLONE", templateSlug: selectedTemplate }),
        })
      );
    } else {
      if (!form.title.trim()) {
        setError("Role title is required.");
        return;
      }
      simulateStages(() =>
        fetch("/api/roles/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceType: "MANUAL_ENTRY", formData: form }),
        })
      );
    }
  };

  const analyzing = stage >= 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "var(--font-dm-sans)" }}>
            Create New Role Profile
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            ACI will analyze the role and generate research-backed construct weights and cutlines.
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex border border-border bg-card mb-1">
          {[
            { key: "jd" as Tab, icon: FileText, label: "Upload JD", desc: "Paste job description text" },
            { key: "clone" as Tab, icon: Copy, label: "Clone Template", desc: "Start from an ACI default" },
            { key: "manual" as Tab, icon: PenLine, label: "Describe Role", desc: "Structured form entry" },
          ].map(({ key, icon: Icon, label, desc }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              disabled={analyzing}
              className={`flex-1 flex flex-col items-center gap-1 px-4 py-4 text-left transition-colors border-b-2 ${
                tab === key
                  ? "border-aci-gold bg-aci-gold/5 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className={`w-4 h-4 ${tab === key ? "text-aci-gold" : ""}`} />
              <span className="text-xs font-semibold">{label}</span>
              <span className="text-[10px] text-muted-foreground">{desc}</span>
            </button>
          ))}
        </div>

        {/* Panel */}
        <div className="border border-border border-t-0 bg-card p-5">
          {tab === "jd" && (
            <div className="space-y-3">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Job Description Text
              </label>
              <textarea
                rows={12}
                className="w-full text-sm bg-background border border-border rounded-sm p-3 resize-none outline-none focus:border-aci-gold/50 text-foreground placeholder:text-muted-foreground/50 font-mono"
                placeholder="Paste the full job description here…"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
                disabled={analyzing}
              />
              <p className="text-[10px] text-muted-foreground">
                PDF/DOCX upload coming soon. Text-only for now.
              </p>
            </div>
          )}

          {tab === "clone" && (
            <div className="space-y-3">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Select ACI Default Role
              </label>
              <div className="grid grid-cols-1 gap-2">
                {templates.map((t) => (
                  <button
                    key={t.slug}
                    onClick={() => setSelectedTemplate(t.slug)}
                    disabled={analyzing}
                    className={`text-left p-3 border rounded-sm transition-colors ${
                      selectedTemplate === t.slug
                        ? "border-aci-gold bg-aci-gold/5"
                        : "border-border hover:border-aci-gold/30 hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{t.name}</span>
                      {selectedTemplate === t.slug && (
                        <ChevronRight className="w-4 h-4 text-aci-gold" />
                      )}
                    </div>
                    {t.description && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "manual" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                  Role Title <span className="text-aci-red">*</span>
                </label>
                <input
                  type="text"
                  className="w-full text-sm bg-background border border-border rounded-sm px-3 py-2 outline-none focus:border-aci-gold/50 text-foreground"
                  placeholder="e.g. CNC Machinist II, Validation Engineer"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  disabled={analyzing}
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                  Key Responsibilities
                </label>
                <textarea
                  rows={4}
                  className="w-full text-sm bg-background border border-border rounded-sm px-3 py-2 resize-none outline-none focus:border-aci-gold/50 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="List the 3–5 primary duties of this role…"
                  value={form.responsibilities}
                  onChange={(e) => setForm((f) => ({ ...f, responsibilities: e.target.value }))}
                  disabled={analyzing}
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                  Required Skills
                </label>
                <textarea
                  rows={3}
                  className="w-full text-sm bg-background border border-border rounded-sm px-3 py-2 resize-none outline-none focus:border-aci-gold/50 text-foreground placeholder:text-muted-foreground/50"
                  placeholder="Technical skills, certifications, tools…"
                  value={form.skills}
                  onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
                  disabled={analyzing}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                    Work Environment
                  </label>
                  <input
                    type="text"
                    className="w-full text-sm bg-background border border-border rounded-sm px-3 py-2 outline-none focus:border-aci-gold/50 text-foreground"
                    placeholder="e.g. CNC floor, cleanroom, lab…"
                    value={form.environment}
                    onChange={(e) => setForm((f) => ({ ...f, environment: e.target.value }))}
                    disabled={analyzing}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground block mb-1">
                    Experience Level
                  </label>
                  <select
                    className="w-full text-sm bg-background border border-border rounded-sm px-3 py-2 outline-none focus:border-aci-gold/50 text-foreground"
                    value={form.experienceLevel}
                    onChange={(e) => setForm((f) => ({ ...f, experienceLevel: e.target.value }))}
                    disabled={analyzing}
                  >
                    <option value="ENTRY">Entry Level</option>
                    <option value="MID">Mid Level</option>
                    <option value="SENIOR">Senior</option>
                    <option value="LEAD">Lead / Principal</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.safetyCritical}
                    onChange={(e) => setForm((f) => ({ ...f, safetyCritical: e.target.checked }))}
                    disabled={analyzing}
                    className="rounded"
                  />
                  Safety-critical role
                </label>
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.qualityCritical}
                    onChange={(e) => setForm((f) => ({ ...f, qualityCritical: e.target.checked }))}
                    disabled={analyzing}
                    className="rounded"
                  />
                  Quality-critical role
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 bg-aci-red/10 border border-aci-red/30 text-aci-red text-xs px-3 py-2 rounded-sm">
            {error}
          </div>
        )}

        {/* Stage progress */}
        {analyzing && (
          <div className="mt-4 bg-card border border-border p-4 rounded-sm space-y-2">
            {STAGE_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-2">
                {i < stage ? (
                  <div className="w-4 h-4 rounded-full bg-aci-green/20 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-aci-green" />
                  </div>
                ) : i === stage ? (
                  <Loader2 className="w-4 h-4 text-aci-gold animate-spin" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-muted" />
                )}
                <span
                  className={`text-xs ${
                    i <= stage ? "text-foreground" : "text-muted-foreground/40"
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Submit */}
        <div className="mt-4 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()} disabled={analyzing}>
            Cancel
          </Button>
          <Button
            variant="gold"
            onClick={handleSubmit}
            disabled={analyzing}
            className="min-w-[140px]"
          >
            {analyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>Analyze Role</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
