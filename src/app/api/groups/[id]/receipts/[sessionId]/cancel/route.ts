import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { receiptSession, receiptItem, receiptItemClaim, groupMember } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId, sessionId } = await params;

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

    // Get the current session to verify it can be canceled
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

    // Don't allow canceling already completed sessions that have expenses
    if (currentSession.status === "completed" && currentSession.expenseId) {
      return NextResponse.json(
        { error: "Cannot cancel a session that has already been converted to an expense" },
        { status: 400 }
      );
    }

    // Only the creator can cancel the session (to prevent abuse)
    if (currentSession.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: "Only the person who created this session can cancel it" },
        { status: 403 }
      );
    }

    // Delete all claims associated with this session
    const receiptItemIds = await db
      .select({ id: receiptItem.id })
      .from(receiptItem)
      .where(eq(receiptItem.receiptSessionId, sessionId));

    if (receiptItemIds.length > 0) {
      const itemIds = receiptItemIds.map(item => item.id);
      await db
        .delete(receiptItemClaim)
        .where(inArray(receiptItemClaim.receiptItemId, itemIds));
    }

    // Delete all receipt items
    await db
      .delete(receiptItem)
      .where(eq(receiptItem.receiptSessionId, sessionId));

    // Delete the receipt session
    await db
      .delete(receiptSession)
      .where(eq(receiptSession.id, sessionId));

    return NextResponse.json({
      success: true,
      message: "Receipt session has been canceled and deleted",
    });

  } catch (error) {
    console.error("Cancel session error:", error);
    return NextResponse.json(
      { error: "Failed to cancel session" },
      { status: 500 }
    );
  }
}