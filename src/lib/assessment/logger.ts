/**
 * Structured logger for V2 assessment engine.
 *
 * Emits JSON log lines for structured log aggregation (Vercel, Datadog, etc.).
 * In development, logs are pretty-printed to the console.
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  requestId?: string;
  orgId?: string;
  environment?: string;
  assessmentId?: string;
  construct?: string;
  act?: string;
  durationMs?: number;
  tokenCount?: number;
  cost?: number;
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV === "development";

function emit(entry: LogEntry) {
  const line = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  if (isDev) {
    const prefix = `[${entry.level.toUpperCase()}] [${entry.module}]`;
    if (entry.level === "error") {
      console.error(prefix, entry.message, line);
    } else if (entry.level === "warn") {
      console.warn(prefix, entry.message, line);
    } else {
      console.log(prefix, entry.message, line);
    }
  } else {
    // Structured JSON for production log aggregation
    const output = JSON.stringify(line);
    if (entry.level === "error") {
      console.error(output);
    } else if (entry.level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
}

/**
 * Create a scoped logger for a specific module.
 *
 * @param module - Identifies the source (e.g. "chat-route", "pipeline")
 * @param requestId - Optional correlation ID auto-included in every log entry
 */
export function createLogger(module: string, requestId?: string, orgId?: string) {
  const base: Partial<LogEntry> = {
    ...(requestId ? { requestId } : {}),
    ...(orgId ? { orgId } : {}),
    environment: process.env.NODE_ENV ?? "unknown",
  };
  return {
    info: (message: string, data?: Partial<LogEntry>) =>
      emit({ level: "info", module, message, ...base, ...data }),
    warn: (message: string, data?: Partial<LogEntry>) =>
      emit({ level: "warn", module, message, ...base, ...data }),
    error: (message: string, data?: Partial<LogEntry>) =>
      emit({ level: "error", module, message, ...base, ...data }),
  };
}
