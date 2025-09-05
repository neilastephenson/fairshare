import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, activityLog, user } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

const updateMemberSchema = z.object({
  role: z.enum(["admin", "member"]),
});

// PATCH /api/groups/[id]/members/[userId] - Update member role
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId, userId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = updateMemberSchema.parse(body);

    // Verify current user is an admin of the group
    const currentMembership = await db
      .select()
      .from(groupMember)
      .where(and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, session.user.id)
      ))
      .limit(1);

    if (currentMembership.length === 0) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    if (currentMembership[0].role !== "admin") {
      return NextResponse.json({ error: "Only admins can update member roles" }, { status: 403 });
    }

    // Verify target user is a member of the group
    const targetMembership = await db
      .select()
      .from(groupMember)
      .where(and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, userId)
      ))
      .limit(1);

    if (targetMembership.length === 0) {
      return NextResponse.json({ error: "User is not a member of this group" }, { status: 404 });
    }

    // Update member role
    await db
      .update(groupMember)
      .set({ role: validatedData.role })
      .where(and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, userId)
      ));

    // Get user details for activity log
    const targetUser = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    // Log activity
    await db.insert(activityLog).values({
      id: nanoid(),
      groupId,
      userId: session.user.id,
      action: "member_role_updated",
      entityType: "member",
      entityId: userId,
      metadata: JSON.stringify({
        targetUser: targetUser[0]?.name,
        newRole: validatedData.role,
        oldRole: targetMembership[0].role,
      }),
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error updating member role:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id]/members/[userId] - Remove member from group
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId, userId } = await params;

    // Verify current user is an admin of the group
    const currentMembership = await db
      .select()
      .from(groupMember)
      .where(and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, session.user.id)
      ))
      .limit(1);

    if (currentMembership.length === 0) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    if (currentMembership[0].role !== "admin") {
      return NextResponse.json({ error: "Only admins can remove members" }, { status: 403 });
    }

    // Verify target user is a member of the group
    const targetMembership = await db
      .select()
      .from(groupMember)
      .where(and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, userId)
      ))
      .limit(1);

    if (targetMembership.length === 0) {
      return NextResponse.json({ error: "User is not a member of this group" }, { status: 404 });
    }

    // Prevent removing yourself (use leave endpoint instead)
    if (userId === session.user.id) {
      return NextResponse.json({ error: "Cannot remove yourself using this endpoint" }, { status: 400 });
    }

    // Get user details for activity log
    const targetUser = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    // Remove member from group
    await db
      .delete(groupMember)
      .where(and(
        eq(groupMember.groupId, groupId),
        eq(groupMember.userId, userId)
      ));

    // Log activity
    await db.insert(activityLog).values({
      id: nanoid(),
      groupId,
      userId: session.user.id,
      action: "member_removed",
      entityType: "member",
      entityId: userId,
      metadata: JSON.stringify({
        targetUser: targetUser[0]?.name,
        removedBy: session.user.name,
      }),
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}