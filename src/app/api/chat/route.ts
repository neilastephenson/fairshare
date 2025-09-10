import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { validateRequestBody } from "@/lib/request-size-limit";

export async function POST(req: NextRequest) {
  // Apply rate limiting - 10 requests per minute for chat
  const rateLimitResult = await rateLimit(req, "chat");
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  // Validate request size and parse body (512KB limit for chat)
  const bodyValidation = await validateRequestBody(req, "chat");
  if (!bodyValidation.success && bodyValidation.response) {
    return bodyValidation.response;
  }

  const { messages }: { messages?: UIMessage[] } = bodyValidation.body || {};

  // Validate input
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: "Messages array is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Limit message count to prevent abuse
  if (messages.length > 50) {
    return new Response(
      JSON.stringify({ error: "Too many messages in conversation" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const result = streamText({
      model: openai(process.env.OPENAI_MODEL || "gpt-5-mini"),
      messages: convertToModelMessages(messages),
    });

    return (
      result as unknown as { toUIMessageStreamResponse: () => Response }
    ).toUIMessageStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
