import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { groupMember, receiptSession } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { addConnection, removeConnection, broadcastToSession } from "@/lib/realtime-connections";

interface RouteParams {
  params: Promise<{ id: string; sessionId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  console.log(`[STREAM-ROUTE] SSE route called`);
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    console.log(`[STREAM-ROUTE] Auth session retrieved: ${session?.user?.id}`);

    if (!session?.user) {
      console.log(`[STREAM-ROUTE] No auth session, returning 401`);
      return new Response("Unauthorized", { status: 401 });
    }

    const { id: groupId, sessionId } = await params;
    console.log(`[STREAM-ROUTE] Params: groupId=${groupId}, sessionId=${sessionId}`);

    // Verify user is a member of the group
    const membership = await db
      .select()
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.userId, session.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return new Response("Not a member of this group", { status: 403 });
    }

    // Verify receipt session exists and is not expired
    const sessionData = await db
      .select()
      .from(receiptSession)
      .where(
        and(
          eq(receiptSession.id, sessionId),
          eq(receiptSession.groupId, groupId)
        )
      )
      .limit(1);

    if (sessionData.length === 0) {
      return new Response("Receipt session not found", { status: 404 });
    }

    const receiptSessionData = sessionData[0];

    if (new Date() > receiptSessionData.expiresAt) {
      return new Response("Receipt session has expired", { status: 410 });
    }

    // Create Server-Sent Events stream
    console.log(`[STREAM-ROUTE] About to create ReadableStream for session ${sessionId}`);
    let streamController: ReadableStreamDefaultController;
    const stream = new ReadableStream({
      start(controller) {
        streamController = controller;
        console.log(`[STREAM] Starting SSE stream for session ${sessionId}`);
        // Add this connection to the session's connections
        addConnection(sessionId, streamController);
        console.log(`[STREAM] Connection added for session ${sessionId}`);

        // Send initial connection confirmation
        const welcomeMessage = `data: ${JSON.stringify({
          type: "connected",
          message: "Real-time updates enabled",
          timestamp: new Date().toISOString(),
          userId: session.user.id,
          userName: session.user.name
        })}\n\n`;
        
        streamController.enqueue(new TextEncoder().encode(welcomeMessage));

        // Broadcast that a user joined
        broadcastToSession(sessionId, {
          type: "user_joined",
          userId: session.user.id,
          userName: session.user.name,
          timestamp: new Date().toISOString()
        });
      },

      cancel() {
        // Remove this connection when client disconnects
        console.log(`[STREAM] SSE stream cancelled for session ${sessionId}`);
        console.trace("Stream cancellation stack trace:");
        removeConnection(sessionId, streamController);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Cache-Control",
      },
    });

  } catch (error) {
    console.error("SSE stream error:", error);
    return new Response("Internal server error", { status: 500 });
  }
}