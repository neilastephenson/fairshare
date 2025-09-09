import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { group, groupMember } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

// GET /api/groups/[id]/invite - Get invite info for a group
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

    // Get group invite code
    const groupData = await db
      .select({
        inviteCode: group.inviteCode,
      })
      .from(group)
      .where(eq(group.id, groupId))
      .limit(1);

    if (groupData.length === 0) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      inviteCode: groupData[0].inviteCode,
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/invite/${groupData[0].inviteCode}`
    });

  } catch (error) {
    console.error("Error fetching invite info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/groups/[id]/invite - Regenerate invite code
export async function POST(
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

    // Generate new invite code
    const newInviteCode = nanoid(10);

    // Update group with new invite code
    await db
      .update(group)
      .set({ 
        inviteCode: newInviteCode,
        updatedAt: new Date() 
      })
      .where(eq(group.id, groupId));

    return NextResponse.json({ 
      success: true,
      inviteCode: newInviteCode,
      inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/invite/${newInviteCode}`
    });

  } catch (error) {
    console.error("Error regenerating invite code:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}