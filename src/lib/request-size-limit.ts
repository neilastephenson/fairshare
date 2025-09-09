import { NextRequest, NextResponse } from "next/server";

// Request size limits for different endpoint types (in bytes)
export const REQUEST_SIZE_LIMITS = {
  // General API requests
  default: 1024 * 1024, // 1MB
  
  // Chat requests (can be larger due to conversation history)
  chat: 512 * 1024, // 512KB
  
  // Group operations (typically small JSON payloads)
  group: 64 * 1024, // 64KB
  
  // Expense operations (small financial data)
  expense: 32 * 1024, // 32KB
  
  // User profile updates (small profile data)
  user: 16 * 1024, // 16KB
  
  // Authentication requests (very small)
  auth: 8 * 1024, // 8KB
  
  // File uploads (if you add them later)
  upload: 10 * 1024 * 1024, // 10MB
} as const;

type RequestSizeCategory = keyof typeof REQUEST_SIZE_LIMITS;

// Get content length from request
function getContentLength(request: NextRequest): number {
  const contentLength = request.headers.get('content-length');
  return contentLength ? parseInt(contentLength, 10) : 0;
}

// Check if request size exceeds limit
export async function checkRequestSize(
  request: NextRequest,
  category: RequestSizeCategory = 'default'
): Promise<{ success: boolean; response?: NextResponse }> {
  const maxSize = REQUEST_SIZE_LIMITS[category];
  const contentLength = getContentLength(request);
  
  // Check content-length header first (most efficient)
  if (contentLength > maxSize) {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Request too large",
          message: `Request size ${formatBytes(contentLength)} exceeds limit of ${formatBytes(maxSize)}`,
          maxSizeAllowed: maxSize,
          actualSize: contentLength,
        },
        {
          status: 413, // Payload Too Large
          headers: {
            "Content-Type": "application/json",
          },
        }
      ),
    };
  }
  
  return { success: true };
}

// Validate request body size after parsing
export async function validateRequestBody(
  request: NextRequest,
  category: RequestSizeCategory = 'default'
): Promise<{ success: boolean; body?: unknown; response?: NextResponse }> {
  try {
    const maxSize = REQUEST_SIZE_LIMITS[category];
    const contentLength = getContentLength(request);
    
    // Pre-check content length
    if (contentLength > maxSize) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Request too large",
            message: `Request size exceeds limit of ${formatBytes(maxSize)}`,
            maxSizeAllowed: maxSize,
          },
          { status: 413 }
        ),
      };
    }
    
    // Parse body with size checking
    const body = await parseBodyWithSizeLimit(request, maxSize);
    
    return { success: true, body };
  } catch (error) {
    if (error instanceof RequestTooLargeError) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Request too large",
            message: error.message,
            maxSizeAllowed: REQUEST_SIZE_LIMITS[category],
          },
          { status: 413 }
        ),
      };
    }
    
    // Other parsing errors
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Invalid request body",
          message: "Failed to parse request body",
        },
        { status: 400 }
      ),
    };
  }
}

// Custom error for request size violations
class RequestTooLargeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestTooLargeError';
  }
}

// Parse body with size limit enforcement
async function parseBodyWithSizeLimit(request: NextRequest, maxSize: number): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) {
    return null;
  }
  
  let totalSize = 0;
  const chunks: Uint8Array[] = [];
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      if (value) {
        totalSize += value.length;
        
        // Check size limit during streaming
        if (totalSize > maxSize) {
          throw new RequestTooLargeError(
            `Request body size ${formatBytes(totalSize)} exceeds limit of ${formatBytes(maxSize)}`
          );
        }
        
        chunks.push(value);
      }
    }
    
    // Combine chunks and parse JSON
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    
    const text = new TextDecoder().decode(combined);
    return text ? JSON.parse(text) : null;
  } finally {
    reader.releaseLock();
  }
}

// Format bytes for human-readable output
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Helper function to wrap API handlers with size limits
export function withSizeLimit(
  handler: (req: NextRequest, context?: unknown, body?: unknown) => Promise<NextResponse>,
  category: RequestSizeCategory = 'default'
) {
  return async (req: NextRequest, context?: unknown): Promise<NextResponse> => {
    // Check request size before processing
    const sizeCheck = await checkRequestSize(req, category);
    if (!sizeCheck.success && sizeCheck.response) {
      return sizeCheck.response;
    }
    
    // For requests with body, validate and parse
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
      const bodyValidation = await validateRequestBody(req, category);
      if (!bodyValidation.success && bodyValidation.response) {
        return bodyValidation.response;
      }
      
      return handler(req, context, bodyValidation.body);
    }
    
    return handler(req, context);
  };
}

// Middleware to add size limit headers to responses
export function addSizeLimitHeaders(
  response: NextResponse,
  category: RequestSizeCategory = 'default'
): NextResponse {
  const maxSize = REQUEST_SIZE_LIMITS[category];
  
  response.headers.set('X-Request-Size-Limit', maxSize.toString());
  response.headers.set('X-Request-Size-Limit-Formatted', formatBytes(maxSize));
  
  return response;
}

// Get size limit info for a category
export function getSizeLimitInfo(category: RequestSizeCategory = 'default') {
  const maxSize = REQUEST_SIZE_LIMITS[category];
  return {
    category,
    maxSizeBytes: maxSize,
    maxSizeFormatted: formatBytes(maxSize),
  };
}