import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { group, groupMember, user, activityLog } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

// POST /api/invite/[code] - Join a group using invite code
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code: inviteCode } = await params;

    // Find group by invite code
    const groupData = await db
      .select()
      .from(group)
      .where(eq(group.inviteCode, inviteCode))
      .limit(1);

    if (groupData.length === 0) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    const groupRecord = groupData[0];

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(groupMember)
      .where(and(
        eq(groupMember.groupId, groupRecord.id),
        eq(groupMember.userId, session.user.id)
      ))
      .limit(1);

    if (existingMembership.length > 0) {
      return NextResponse.json({ error: "Already a member of this group" }, { status: 400 });
    }

    // Add user to group
    await db.insert(groupMember).values({
      id: nanoid(),
      groupId: groupRecord.id,
      userId: session.user.id,
      role: "member",
      joinedAt: new Date(),
    });

    // Log activity
    await db.insert(activityLog).values({
      id: nanoid(),
      groupId: groupRecord.id,
      userId: session.user.id,
      action: "member_joined",
      entityType: "member",
      entityId: session.user.id,
      metadata: JSON.stringify({
        userName: session.user.name,
        userEmail: session.user.email,
        joinMethod: "invite_link",
      }),
      createdAt: new Date(),
    });

    return NextResponse.json({ 
      success: true, 
      groupId: groupRecord.id,
      groupName: groupRecord.name 
    });

  } catch (error) {
    console.error("Error joining group:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/invite/[code] - Get group info by invite code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code: inviteCode } = await params;

    // Find group by invite code
    const groupData = await db
      .select({
        group: group,
        creator: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(group)
      .leftJoin(user, eq(group.createdBy, user.id))
      .where(eq(group.inviteCode, inviteCode))
      .limit(1);

    if (groupData.length === 0) {
      return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
    }

    const groupInfo = groupData[0];

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(groupMember)
      .where(and(
        eq(groupMember.groupId, groupInfo.group.id),
        eq(groupMember.userId, session.user.id)
      ))
      .limit(1);

    const isAlreadyMember = existingMembership.length > 0;

    // Get member count
    const memberCountResult = await db
      .select({ count: groupMember.id })
      .from(groupMember)
      .where(eq(groupMember.groupId, groupInfo.group.id));

    return NextResponse.json({
      group: {
        id: groupInfo.group.id,
        name: groupInfo.group.name,
        description: groupInfo.group.description,
        createdAt: groupInfo.group.createdAt,
      },
      creator: groupInfo.creator,
      memberCount: memberCountResult.length,
      isAlreadyMember,
    });

  } catch (error) {
    console.error("Error fetching invite info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}