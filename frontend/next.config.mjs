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

  // Same-origin proxy to the backend API for the Mini App + read-only chain
  // surfaces. The dd_miniapp cookie (Path=/miniapp from PR2) only attaches to
  // requests whose URL starts with /miniapp; making fetches go through
  // /api/miniapp/* on the frontend host preserves that path semantics under
  // a single origin (Vercel + Railway split would otherwise force CORS +
  // SameSite=None).
  async rewrites() {
    const apiBase = process.env.DISTRO_API_BASE_URL || "http://localhost:3001"
    return [
      { source: "/api/miniapp/:path*", destination: `${apiBase}/miniapp/:path*` },
      { source: "/api/me", destination: `${apiBase}/me` },
      { source: "/api/me/:path*", destination: `${apiBase}/me/:path*` },
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
