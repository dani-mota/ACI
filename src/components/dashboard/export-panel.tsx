"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileJson, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const EXPORT_TYPES = [
  {
    id: "constructs",
    label: "Construct Scores",
    description: "Per-candidate construct-level raw scores and scaled scores",
  },
  {
    id: "items",
    label: "Item Responses",
    description: "Individual item responses with timing and raw scores",
  },
  {
    id: "full",
    label: "Full Export",
    description: "Complete dataset: demographics, scores, predictions, survey data",
  },
] as const;

type ExportType = (typeof EXPORT_TYPES)[number]["id"];
type ExportFormat = "csv" | "json";

export function ExportPanel() {
  const [type, setType] = useState<ExportType>("constructs");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [downloading, setDownloading] = useState(false);

  async function handleExport() {
    setDownloading(true);
    try {
      const res = await fetch(`/api/export/data?type=${type}&format=${format}`);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aci-${type}-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Allow retry
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-card border border-border p-6">
      <h2
        className="text-lg font-bold text-foreground mb-1"
        style={{ fontFamily: "var(--font-dm-sans)" }}
      >
        Data Export
      </h2>
      <p className="text-xs text-muted-foreground mb-6">
        Export assessment data for psychometric analysis and reporting.
      </p>

      {/* Data type selection */}
      <div className="mb-6">
        <label className="block text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
          Export Type
        </label>
        <div className="space-y-2">
          {EXPORT_TYPES.map((et) => (
            <button
              key={et.id}
              onClick={() => setType(et.id)}
              className={`w-full text-left p-3 border rounded-md transition-colors ${
                type === et.id
                  ? "border-aci-gold bg-aci-gold/5"
                  : "border-border hover:border-aci-gold/40"
              }`}
            >
              <p className="text-xs font-medium text-foreground">{et.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {et.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Format selection */}
      <div className="mb-6">
        <label className="block text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">
          Format
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setFormat("csv")}
            className={`flex items-center gap-1.5 px-4 py-2 border rounded-md text-xs font-medium transition-colors ${
              format === "csv"
                ? "border-aci-gold bg-aci-gold/5 text-foreground"
                : "border-border text-muted-foreground hover:border-aci-gold/40"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            CSV
          </button>
          <button
            onClick={() => setFormat("json")}
            className={`flex items-center gap-1.5 px-4 py-2 border rounded-md text-xs font-medium transition-colors ${
              format === "json"
                ? "border-aci-gold bg-aci-gold/5 text-foreground"
                : "border-border text-muted-foreground hover:border-aci-gold/40"
            }`}
          >
            <FileJson className="w-3.5 h-3.5" />
            JSON
          </button>
        </div>
      </div>

      {/* Export button */}
      <Button
        onClick={handleExport}
        disabled={downloading}
        className="w-full bg-aci-gold hover:bg-aci-gold/90 text-aci-navy font-semibold"
      >
        {downloading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
            Preparing Export...
          </>
        ) : (
          <>
            <Download className="w-3.5 h-3.5 mr-2" />
            Download {format.toUpperCase()}
          </>
        )}
      </Button>
    </div>
  );
}
