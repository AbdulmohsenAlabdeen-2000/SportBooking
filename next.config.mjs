/** @type {import('next').NextConfig} */

// Security headers applied to every response. CSP intentionally omitted
// as a header — Next.js inlines hashed scripts and the project also
// embeds MyFatoorah's hosted page elsewhere, so a strict CSP would need
// per-route nonces to avoid breaking. The non-CSP headers below cover
// clickjacking, MIME sniffing, referrer leaks, HSTS, and feature
// scoping with no compatibility risk.
const securityHeaders = [
  {
    // Force HTTPS for two years across the apex and every subdomain,
    // and allow inclusion in HSTS preload lists. Vercel terminates TLS
    // on every domain so this is safe.
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    // Refuse iframes — clickjacking defense. Slightly stricter than
    // CSP frame-ancestors but with broader browser support.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Stop browsers from sniffing MIME types — defends against
    // smuggling text/html through endpoints that serve other types.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Don't leak full URL paths (which include booking references)
    // when customers click out to MyFatoorah, Instagram, etc.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Disable browser features the app doesn't use. Camera / mic /
    // geolocation are surfaces an injected script could exploit; we
    // close them at the platform layer.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Cross-origin isolation hint. We don't use SharedArrayBuffer so
    // the strictest variant is fine.
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
