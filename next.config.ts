import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  // Suppress Sentry CLI output during build
  silent: true,
  // Upload source maps so Sentry shows readable TypeScript stack traces
  widenClientFileUpload: true,
  // Tree-shake Sentry logger to reduce bundle size
  disableLogger: true,
});
