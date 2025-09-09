import { kv } from "@vercel/kv";
import { RateLimiterMemory, RateLimiterRedis, RateLimiterAbstract } from "rate-limiter-flexible";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

// Rate limiter configurations for different endpoint types
export const RATE_LIMITS = {
  // Critical endpoints with cost implications
  chat: {
    points: 10, // Number of requests
    duration: 60, // Per 60 seconds (1 minute)
    blockDuration: 60 * 5, // Block for 5 minutes if exceeded
  },
  // Authentication endpoints
  auth: {
    points: 5,
    duration: 60,
    blockDuration: 60 * 15, // Block for 15 minutes
  },
  // Group operations
  groupWrite: {
    points: 30,
    duration: 60,
    blockDuration: 60 * 2,
  },
  groupRead: {
    points: 60,
    duration: 60,
    blockDuration: 60,
  },
  // Invite operations
  invite: {
    points: 5,
    duration: 60,
    blockDuration: 60 * 10,
  },
  // General API calls
  general: {
    points: 100,
    duration: 60,
    blockDuration: 60,
  },
} as const;

type RateLimitConfig = keyof typeof RATE_LIMITS;

// Create rate limiter instance (removed unused variable)

function getRateLimiter(config: RateLimitConfig): RateLimiterAbstract {
  const limits = RATE_LIMITS[config];
  
  // In development or when KV is not available, use in-memory rate limiting
  if (process.env.NODE_ENV === "development" || !process.env.KV_REST_API_URL) {
    return new RateLimiterMemory({
      points: limits.points,
      duration: limits.duration,
      blockDuration: limits.blockDuration,
    });
  }

  // In production with Vercel KV
  try {
    return new RateLimiterRedis({
      storeClient: kv,
      keyPrefix: `rl_${config}_`,
      points: limits.points,
      duration: limits.duration,
      blockDuration: limits.blockDuration,
      // Insurance limiter in case Redis is down
      insuranceLimiter: new RateLimiterMemory({
        points: limits.points,
        duration: limits.duration,
        blockDuration: limits.blockDuration,
      }),
    });
  } catch {
    console.error("Failed to initialize Redis rate limiter, falling back to memory");
    return new RateLimiterMemory({
      points: limits.points,
      duration: limits.duration,
      blockDuration: limits.blockDuration,
    });
  }
}

// Get identifier for rate limiting (IP or user ID)
async function getIdentifier(request: NextRequest, useAuth: boolean = true): Promise<string> {
  // Try to get user ID first if auth is available
  if (useAuth) {
    try {
      const { auth } = await import("@/lib/auth");
      const session = await auth.api.getSession({
        headers: await headers(),
      });
      if (session?.user?.id) {
        return `user_${session.user.id}`;
      }
    } catch {
      // Fall through to IP-based limiting
    }
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0] || realIp || "unknown";
  
  return `ip_${ip}`;
}

// Main rate limiting function
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = "general",
  useAuth: boolean = true
): Promise<{ success: boolean; response?: NextResponse }> {
  try {
    const limiter = getRateLimiter(config);
    const identifier = await getIdentifier(request, useAuth);

    try {
      await limiter.consume(identifier);
      return { success: true };
    } catch (rateLimiterRes: unknown) {
      // Rate limit exceeded
      const rateLimiterResult = rateLimiterRes as { 
        msBeforeNext?: number; 
        remainingPoints?: number; 
      };
      const retryAfter = Math.round((rateLimiterResult.msBeforeNext || 60000) / 1000);
      
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Too many requests",
            message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
            retryAfter,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(retryAfter),
              "X-RateLimit-Limit": String(RATE_LIMITS[config].points),
              "X-RateLimit-Remaining": String(rateLimiterResult.remainingPoints || 0),
              "X-RateLimit-Reset": new Date(Date.now() + (rateLimiterResult.msBeforeNext || 60000)).toISOString(),
            },
          }
        ),
      };
    }
  } catch (error) {
    // If rate limiting fails, log the error but allow the request
    // This prevents rate limiter issues from breaking the app
    console.error("Rate limiting error:", error);
    return { success: true };
  }
}

// Helper function to wrap API handlers with rate limiting
export function withRateLimit(
  handler: (req: NextRequest, context?: unknown) => Promise<NextResponse>,
  config: RateLimitConfig = "general",
  useAuth: boolean = true
) {
  return async (req: NextRequest, context?: unknown): Promise<NextResponse> => {
    const { success, response } = await rateLimit(req, config, useAuth);
    
    if (!success && response) {
      return response;
    }
    
    return handler(req, context);
  };
}

// Utility to get rate limit status for a user/IP
export async function getRateLimitStatus(
  request: NextRequest,
  config: RateLimitConfig = "general",
  useAuth: boolean = true
): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
}> {
  try {
    const limiter = getRateLimiter(config);
    const identifier = await getIdentifier(request, useAuth);
    
    const status = await limiter.get(identifier);
    const limits = RATE_LIMITS[config];
    
    return {
      limit: limits.points,
      remaining: status ? limits.points - status.consumedPoints : limits.points,
      reset: status 
        ? new Date(Date.now() + (limits.duration * 1000))
        : new Date(Date.now() + (limits.duration * 1000)),
    };
  } catch (error) {
    console.error("Error getting rate limit status:", error);
    const limits = RATE_LIMITS[config];
    return {
      limit: limits.points,
      remaining: limits.points,
      reset: new Date(Date.now() + (limits.duration * 1000)),
    };
  }
}