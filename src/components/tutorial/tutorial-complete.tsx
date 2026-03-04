"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

export function TutorialComplete() {
  const router = useRouter();
  const { exitTutorial } = useAppStore();

  const handleGoToDashboard = () => {
    exitTutorial();
    router.push("/dashboard");
  };

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card border border-border p-8 max-w-md text-center" data-tutorial="tutorial-complete">
        <div className="w-14 h-14 bg-aci-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-aci-green" />
        </div>
        <h1
          className="text-2xl font-bold text-foreground mb-2"
          style={{ fontFamily: "var(--font-dm-sans)" }}
        >
          Tutorial Complete
        </h1>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          You&apos;ve explored all the key features of ACI. You&apos;re ready to invite
          your first candidate and start running real assessments.
        </p>
        <Button
          onClick={handleGoToDashboard}
          className="bg-aci-gold hover:bg-aci-gold/90 text-aci-navy font-semibold"
        >
          Go to Your Dashboard
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
