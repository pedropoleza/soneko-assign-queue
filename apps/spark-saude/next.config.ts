import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * The dashboard is embedded inside GoHighLevel via a Custom Menu Link (iframe).
 * We must NOT send X-Frame-Options: DENY/SAMEORIGIN (that would block framing).
 * Instead we allow the GHL / white-label parent origins through CSP frame-ancestors.
 * The list is configurable for resale (multi-tenant white-label domains).
 */
const frameAncestors =
  process.env.ALLOWED_FRAME_ANCESTORS?.trim() ||
  "'self' https://*.gohighlevel.com https://*.leadconnectorhq.com https://*.msgsndr.com";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // This app lives in a subfolder of a larger repo; pin the tracing root to it.
  outputFileTracingRoot: appDir,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: `frame-ancestors ${frameAncestors};`,
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
