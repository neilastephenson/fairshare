import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, activityLog, user } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";

// GET /api/groups/[id]/activity - Get activity log for a group
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
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

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

    // Fetch activity log entries
    const activities = await db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        entityType: activityLog.entityType,
        entityId: activityLog.entityId,
        metadata: activityLog.metadata,
        createdAt: activityLog.createdAt,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(activityLog)
      .leftJoin(user, eq(activityLog.userId, user.id))
      .where(eq(activityLog.groupId, groupId))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Error fetching activity log:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}