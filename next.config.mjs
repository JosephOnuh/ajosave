/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@stellar/stellar-sdk"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  async redirects() {
    return process.env.NODE_ENV === "production"
      ? [
          {
            source: "/(.*)",
            has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
            destination: "https://www.ajosave.app/:path*",
            permanent: true,
          },
        ]
      : [];
  },
};

export default nextConfig;
