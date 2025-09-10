import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, receiptSession, user } from "@/lib/schema";
import { eq, and, gt } from "drizzle-orm";

// GET /api/groups/[id]/receipts/active - Get active receipt sessions for a group
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await params;

    // Verify user is a member of the group
    const membership = await db
      .select()
      .from(groupMember)
      .where(and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, session.user.id)
      ))
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Find active receipt sessions (not expired and status is 'claiming')
    const activeSessions = await db
      .select({
        id: receiptSession.id,
        merchantName: receiptSession.merchantName,
        receiptDate: receiptSession.receiptDate,
        totalAmount: receiptSession.totalAmount,
        status: receiptSession.status,
        expiresAt: receiptSession.expiresAt,
        createdBy: receiptSession.createdBy,
        createdAt: receiptSession.createdAt,
        creator: {
          id: user.id,
          name: user.name,
          image: user.image,
        },
      })
      .from(receiptSession)
      .leftJoin(user, eq(user.id, receiptSession.createdBy))
      .where(and(
        eq(receiptSession.groupId, groupId),
        eq(receiptSession.status, "claiming"),
        gt(receiptSession.expiresAt, new Date())
      ))
      .orderBy(receiptSession.createdAt);

    return NextResponse.json({ 
      activeSessions: activeSessions.map(session => ({
        id: session.id,
        merchantName: session.merchantName,
        receiptDate: session.receiptDate,
        totalAmount: session.totalAmount,
        status: session.status,
        expiresAt: session.expiresAt,
        createdBy: session.createdBy,
        createdAt: session.createdAt,
        creator: session.creator,
      }))
    });
  } catch (error) {
    console.error("Error fetching active receipt sessions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}