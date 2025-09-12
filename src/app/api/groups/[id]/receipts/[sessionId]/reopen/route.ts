import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { receiptSession, groupMember } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; sessionId: string } }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId, sessionId } = params;

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
      return NextResponse.json(
        { error: "Not a member of this group" },
        { status: 403 }
      );
    }

    // Get the current session to verify it can be re-opened
    const [currentSession] = await db
      .select()
      .from(receiptSession)
      .where(eq(receiptSession.id, sessionId))
      .limit(1);

    if (!currentSession) {
      return NextResponse.json(
        { error: "Receipt session not found" },
        { status: 404 }
      );
    }

    if (currentSession.status !== "completed") {
      return NextResponse.json(
        { error: "Only completed sessions can be re-opened" },
        { status: 400 }
      );
    }

    // Check if session has not expired
    const now = new Date();
    if (new Date(currentSession.expiresAt) < now) {
      return NextResponse.json(
        { error: "Session has expired and cannot be re-opened" },
        { status: 400 }
      );
    }

    // Re-open the session - change status back to 'claiming' and track who reopened it
    // We'll store the reopener info in the participants JSON for now
    let updatedParticipants = currentSession.participants;
    if (updatedParticipants) {
      try {
        const participants = JSON.parse(updatedParticipants);
        // Add a special field to track who is currently controlling the session
        participants._sessionController = {
          userId: session.user.id,
          reopenedAt: new Date().toISOString()
        };
        updatedParticipants = JSON.stringify(participants);
      } catch (e) {
        console.error("Error updating participants:", e);
      }
    }

    await db
      .update(receiptSession)
      .set({
        status: "claiming",
        participants: updatedParticipants,
        updatedAt: new Date(),
      })
      .where(eq(receiptSession.id, sessionId));

    return NextResponse.json({
      success: true,
      message: "Session has been re-opened for editing",
    });

  } catch (error) {
    console.error("Reopen session error:", error);
    return NextResponse.json(
      { error: "Failed to re-open session" },
      { status: 500 }
    );
  }
}