import type { NextConfig } from "next";

// Security headers configuration
const securityHeaders = [
  // Prevent DNS prefetching for privacy
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  // Enable XSS filtering in browsers
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  // Prevent page from being embedded in frames (clickjacking protection)
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  // Prevent MIME type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  // Control referrer information sent with requests
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin'
  },
  // Permissions policy (formerly Feature Policy)
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()'
  },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.openai.com https://vitals.vercel-insights.com",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests"
    ].join('; ')
  }
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        // Additional headers for API routes
        source: '/api/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          },
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow'
          },
          // Request size limit information header
          {
            key: 'X-Request-Size-Limit-Default',
            value: '1048576' // 1MB in bytes
          }
        ],
      }
    ];
  },
  
  // Enable security features
  poweredByHeader: false, // Remove X-Powered-By header
  
  // Configure CORS-like behavior  
  async rewrites() {
    return [];
  },

  // Experimental features for body size limits
  experimental: {
    // Note: These are handled by our custom middleware instead
    // serverComponentsExternalPackages: [],
  },

  // Configure serverless function settings
  ...(process.env.NODE_ENV === 'production' && {
    // Production-specific optimizations
    compress: true,
    generateEtags: true,
  })
};

export default nextConfig;
