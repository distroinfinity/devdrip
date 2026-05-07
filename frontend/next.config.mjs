/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  transpilePackages: ["@distrotv/design-system", "@distrotv/shared"],

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  async rewrites() {
    // mirrors packages/shared/src/env-bundle.ts. inlined instead of imported
    // because next.config.mjs runs before transpilePackages kicks in, and a
    // dynamic import here hits ESM/CJS interop edges. keep these URLs in sync
    // with the bundle (this is a small file, easy to grep).
    const BUNDLES = {
      local: "http://localhost:3011",
      staging: "https://devdrip-api-staging.up.railway.app",
      prod: "https://devdrip-api-production.up.railway.app",
    }
    const e = (process.env.DISTRO_ENV ?? "").toLowerCase()
    const env = BUNDLES[e] ? e : process.env.NODE_ENV === "production" ? "prod" : "local"
    const apiUrl = (process.env.API_URL ?? BUNDLES[env]).replace(/\/$/, "")
    return [
      { source: "/api/me", destination: `${apiUrl}/me` },
      { source: "/api/me/:path*", destination: `${apiUrl}/me/:path*` },
    ]
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
