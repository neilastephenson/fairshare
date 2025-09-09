# Rate Limiting Setup Instructions

## ✅ What's Been Implemented

Rate limiting has been successfully implemented for your FayrShare application with the following features:

- **Chat API**: 10 requests per minute (most critical for cost control)
- **Group Write Operations**: 30 requests per minute (creating groups, expenses)
- **Group Read Operations**: 60 requests per minute (viewing groups, expenses)
- **Invite Operations**: 5 requests per minute (joining groups, getting invite info)
- **Fallback Protection**: Uses in-memory rate limiting if Redis is unavailable

## 🔧 Production Setup Options

### Option 1: Keep In-Memory Rate Limiting (Recommended to Start)

**Your rate limiting is already working perfectly!** No additional setup needed.

✅ **Benefits:**
- Zero additional cost
- Faster than Redis for single-instance apps  
- Already active and protecting your endpoints
- Simpler architecture

✅ **Perfect for:**
- Single-server deployments (like Vercel serverless)
- Apps with moderate traffic
- Getting started quickly

### Option 2: Add Redis for Advanced Features (Optional)

If you want persistent rate limits across deployments or multiple server instances:

#### Step 1: Choose Upstash Redis from Marketplace

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project (fairshare)  
3. Go to the "Storage" tab
4. Click "Marketplace Database Providers"
5. **Choose "Upstash"** (Serverless Redis)
6. Select "Redis" option
7. Choose your region (same as your app for best performance)
8. Connect to your project

#### Step 2: Environment Variables

Upstash automatically adds the required environment variables:
- `KV_REST_API_URL`  
- `KV_REST_API_TOKEN`

#### Step 3: Deploy

Your next deployment will automatically use Redis-based rate limiting.

### When to Upgrade to Redis:

- **Multiple server instances** (horizontal scaling)
- **Global edge deployments** with shared limits
- **Persistent limits** across deployments
- **Advanced analytics** on rate limit usage

## 📊 Rate Limiting Configuration

Current limits (configured in `/src/lib/rate-limit.ts`):

```typescript
export const RATE_LIMITS = {
  chat: {
    points: 10,        // 10 requests
    duration: 60,      // per minute
    blockDuration: 300 // blocked for 5 minutes if exceeded
  },
  groupWrite: {
    points: 30,        // 30 requests
    duration: 60,      // per minute  
    blockDuration: 120 // blocked for 2 minutes
  },
  groupRead: {
    points: 60,        // 60 requests
    duration: 60,      // per minute
    blockDuration: 60  // blocked for 1 minute
  },
  invite: {
    points: 5,         // 5 requests
    duration: 60,      // per minute
    blockDuration: 600 // blocked for 10 minutes
  }
}
```

## 🧪 Testing Rate Limiting

### Local Testing (In-Memory)
1. Start your dev server: `pnpm run dev`
2. Make multiple rapid requests to any protected endpoint
3. After exceeding the limit, you should receive a 429 response:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again in 60 seconds.",
  "retryAfter": 60
}
```

### Production Testing
- Use tools like Postman, curl, or browser dev tools
- Make rapid requests to test endpoints
- Check response headers for rate limit info:
  - `X-RateLimit-Limit`: Total allowed requests
  - `X-RateLimit-Remaining`: Requests left in window
  - `X-RateLimit-Reset`: When the window resets
  - `Retry-After`: Seconds until you can retry

## 🎯 Protected Endpoints

Rate limiting is now active on:

### Chat API
- `POST /api/chat` - **10 requests/minute**

### Group Operations
- `POST /api/groups` - **30 requests/minute** (create group)
- `GET /api/groups` - **60 requests/minute** (list groups)

### Invite Operations  
- `POST /api/invite/[code]` - **5 requests/minute** (join group)
- `GET /api/invite/[code]` - **5 requests/minute** (get invite info)

## 🔧 Customizing Rate Limits

To adjust limits, edit `/src/lib/rate-limit.ts`:

1. **Increase limits for higher traffic**:
```typescript
chat: {
  points: 20,        // Increase from 10 to 20
  duration: 60,      
  blockDuration: 300 
}
```

2. **Add rate limiting to new endpoints**:
```typescript
// In your API route
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimit(request, "chat");
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }
  
  // Your existing logic...
}
```

## 🚨 Emergency Rate Limit Bypass

If rate limiting causes issues, you can temporarily disable it by adding this to your environment variables:

```bash
DISABLE_RATE_LIMITING=true
```

Then modify the rate limiting function to check this flag.

## 📈 Monitoring & Alerts

Consider setting up monitoring for:
- 429 error rates (too many rate limit hits might indicate attacks)
- KV database performance and usage
- Cost monitoring for OpenAI API calls

## 🎉 Benefits Achieved

With rate limiting now implemented:

✅ **Cost Protection**: OpenAI API calls are limited to prevent billing surprises  
✅ **DDoS Protection**: Prevents overwhelming your servers  
✅ **Fair Usage**: Ensures all users get reasonable access to resources  
✅ **Graceful Degradation**: Uses in-memory fallback if Redis is down  
✅ **User Experience**: Clear error messages with retry timing  

Your app is now much more resilient and ready to handle viral growth! 🚀