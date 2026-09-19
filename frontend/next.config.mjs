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
    // resolve from the same bundle the rest of the app uses, so dev/staging/prod
    // are driven by DISTRO_ENV alone. ad-hoc override via API_URL still wins.
    const { resolveEnv } = await import("@distrotv/shared")
    const { apiUrl } = resolveEnv({
      distroEnv: process.env.DISTRO_ENV,
      apiUrl: process.env.API_URL,
      nodeEnv: process.env.NODE_ENV,
    })
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
