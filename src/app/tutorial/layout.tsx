import { TopNav } from "@/components/nav/top-nav";
import { BasePathProvider } from "@/components/base-path-provider";
import { TooltipOverlay } from "@/components/tutorial/tooltip-overlay";

export default function TutorialLayout({ children }: { children: React.ReactNode }) {
  return (
    <BasePathProvider basePath="/tutorial">
      <div className="min-h-screen bg-background">
        <TopNav mode="tutorial" />
        <TooltipOverlay />
        <main className="max-w-[1600px] mx-auto">{children}</main>
      </div>
    </BasePathProvider>
  );
}
