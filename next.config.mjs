/** @type {import('next').NextConfig} */

const cspHeader = [
  "default-src 'self'",
  // Scripts: self + Next.js inline scripts (nonce not yet wired, so unsafe-inline in report-only)
  "script-src 'self' 'unsafe-inline'",
  // Styles: self + inline (Next.js injects critical CSS)
  "style-src 'self' 'unsafe-inline'",
  // Images: self + data URIs
  "img-src 'self' data:",
  // Fonts: self
  "font-src 'self'",
  // API / WebSocket connections restricted to known endpoints
  "connect-src 'self' https://horizon.stellar.org https://horizon-testnet.stellar.org https://api.paystack.co https://api.ng.termii.com",
  // No plugins
  "object-src 'none'",
  // Framing: deny
  "frame-ancestors 'none'",
  // Upgrade insecure requests in production
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Report-Only first — switch to Content-Security-Policy once violations are reviewed
  { key: "Content-Security-Policy-Report-Only", value: cspHeader },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@stellar/stellar-sdk"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
