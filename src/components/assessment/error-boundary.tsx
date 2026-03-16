"use client";

import React from "react";

// ──────────────────────────────────────────────
// Tier 1: Component-level — hides failed component, rest continues (P-4)
// ──────────────────────────────────────────────

interface ComponentErrorBoundaryProps {
  children: React.ReactNode;
  componentName: string;
  fallback?: React.ReactNode;
}

interface ComponentErrorBoundaryState {
  hasError: boolean;
}

export class ComponentErrorBoundary extends React.Component<ComponentErrorBoundaryProps, ComponentErrorBoundaryState> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ComponentErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.componentName}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

// ──────────────────────────────────────────────
// Tier 2: Assessment-level — branded recovery screen (P-4)
// ──────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class AssessmentErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[AssessmentErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          background: "#080e1a",
          color: "#c9d6e8",
          fontFamily: "var(--font-display, system-ui)",
        }}
      >
        <p style={{ fontSize: "16px", fontWeight: 500 }}>
          Something unexpected happened.
        </p>
        <p style={{ fontSize: "13px", color: "#7b8fa8", maxWidth: "360px", textAlign: "center" }}>
          Your progress has been saved. You can try resuming or reload the page.
        </p>
        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "1px solid rgba(37,99,235,0.3)",
              background: "rgba(37,99,235,0.12)",
              color: "#4a8af5",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Resuming
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "#7b8fa8",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
