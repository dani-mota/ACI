"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CsvUpload } from "@/components/invitation/csv-upload";
import { CsvPreviewTable } from "@/components/invitation/csv-preview-table";
import { BatchProgress } from "@/components/invitation/batch-progress";
import { parseCsv, validateCsvRows, type ValidatedRow } from "@/lib/csv-templates";

export function BatchInviteClient() {
  const router = useRouter();
  const [step, setStep] = useState<"upload" | "preview" | "sending">("upload");
  const [csvContent, setCsvContent] = useState<string | null>(null);
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [roleSlugs, setRoleSlugs] = useState<string[]>([]);
  const [batchStatus, setBatchStatus] = useState<"idle" | "sending" | "complete" | "error">("idle");
  const [batchResult, setBatchResult] = useState({ total: 0, sent: 0, failed: 0 });

  useEffect(() => {
    fetch("/api/invitations?_roles=1")
      .then(() =>
        fetch("/api/invitations")
          .then((r) => r.json())
          .catch(() => [])
      )
      .catch(() => []);

    // Fetch available roles for validation
    fetch("/api/candidates")
      .then((r) => r.json())
      .then(() => {})
      .catch(() => {});
  }, []);

  // Fetch role slugs on mount
  useEffect(() => {
    async function fetchRoles() {
      try {
        const res = await fetch("/api/candidates");
        if (res.ok) {
          const data = await res.json();
          const slugs = [...new Set(data.map((c: { primaryRole?: { slug: string } }) => c.primaryRole?.slug).filter(Boolean))] as string[];
          setRoleSlugs(slugs);
        }
      } catch {
        // Roles will be validated server-side anyway
      }
    }
    fetchRoles();
  }, []);

  const handleUpload = (content: string) => {
    setCsvContent(content);
    const { rows } = parseCsv(content);
    const validated = validateCsvRows(rows, roleSlugs);
    setValidatedRows(validated);
    setStep("preview");
  };

  const hasErrors = validatedRows.some((r) => r.errors.length > 0);

  const handleSend = async () => {
    if (!csvContent) return;
    setStep("sending");
    setBatchStatus("sending");
    setBatchResult({ total: validatedRows.length, sent: 0, failed: 0 });

    try {
      const res = await fetch("/api/invitations/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Server-side validation errors
        if (data.rows) {
          setValidatedRows(data.rows);
          setStep("preview");
          setBatchStatus("idle");
          return;
        }
        throw new Error(data.error || "Batch send failed");
      }

      setBatchResult({
        total: data.total,
        sent: data.emailsSent,
        failed: data.emailsFailed,
      });
      setBatchStatus(data.emailsFailed > 0 ? "error" : "complete");
    } catch {
      setBatchStatus("error");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground" style={{ fontFamily: "var(--font-dm-sans)" }}>
            Batch Invite
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider">
            Upload a CSV to invite multiple candidates at once
          </p>
        </div>
      </div>

      {step === "upload" && <CsvUpload onUpload={handleUpload} />}

      {step === "preview" && (
        <div className="space-y-4">
          <CsvPreviewTable rows={validatedRows} />
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep("upload")}>
              Upload Different File
            </Button>
            <Button
              variant="gold"
              size="sm"
              onClick={handleSend}
              disabled={hasErrors}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Send {validatedRows.filter((r) => r.errors.length === 0).length} Invitations
            </Button>
          </div>
          {hasErrors && (
            <p className="text-[10px] text-aci-red">
              Fix all errors before sending. Re-upload the corrected CSV.
            </p>
          )}
        </div>
      )}

      {step === "sending" && (
        <div className="space-y-4">
          <BatchProgress
            status={batchStatus}
            total={batchResult.total}
            sent={batchResult.sent}
            failed={batchResult.failed}
          />
          {batchStatus === "complete" && (
            <div className="flex gap-3">
              <Button variant="gold" size="sm" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep("upload");
                  setCsvContent(null);
                  setValidatedRows([]);
                  setBatchStatus("idle");
                }}
              >
                Send Another Batch
              </Button>
            </div>
          )}
          {batchStatus === "sending" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Processing invitations...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
