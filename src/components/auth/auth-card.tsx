"use client";

import { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-card border border-border shadow-lg p-8 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: "var(--font-dm-sans)" }}>
            ACI
          </h1>
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground mt-1 uppercase font-mono">
            Arklight Cognitive Index
          </p>
        </div>

        <h2 className="text-lg font-semibold text-foreground mb-1">{title}</h2>
        {subtitle && <p className="text-sm text-muted-foreground mb-6">{subtitle}</p>}

        {children}
      </div>
      {footer && (
        <div className="text-center mt-4 text-xs text-white/60 relative z-10">
          {footer}
        </div>
      )}
    </div>
  );
}
