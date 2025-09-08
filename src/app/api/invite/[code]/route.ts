import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { group, groupMember, user, activityLog, placeholderUser, expense, expenseParticipant } from "@/lib/schema";
import { eq, and, isNull } from "drizzle-orm";

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
    const body = await request.json();
    const { placeholderUserId } = body; // Optional: ID of placeholder user to claim

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

    // If claiming a placeholder user
    if (placeholderUserId) {
      // Verify placeholder exists and is unclaimed
      const placeholder = await db
        .select()
        .from(placeholderUser)
        .where(and(
          eq(placeholderUser.id, placeholderUserId),
          eq(placeholderUser.groupId, groupRecord.id)
        ))
        .limit(1);

      if (placeholder.length === 0) {
        return NextResponse.json({ error: "Placeholder user not found" }, { status: 404 });
      }

      if (placeholder[0].claimedBy) {
        return NextResponse.json({ error: "Placeholder user already claimed" }, { status: 400 });
      }

      // Start transaction to claim placeholder and transfer expenses
      await db.transaction(async (tx) => {
        // Update placeholder as claimed
        await tx
          .update(placeholderUser)
          .set({
            claimedBy: session.user.id,
            claimedAt: new Date(),
          })
          .where(eq(placeholderUser.id, placeholderUserId));

        // Transfer expenses paid by placeholder to user
        await tx
          .update(expense)
          .set({
            paidBy: session.user.id,
            paidByType: "user",
          })
          .where(and(
            eq(expense.paidBy, placeholderUserId),
            eq(expense.paidByType, "placeholder")
          ));

        // Transfer expense participations from placeholder to user
        await tx
          .update(expenseParticipant)
          .set({
            userId: session.user.id,
            userType: "user",
          })
          .where(and(
            eq(expenseParticipant.userId, placeholderUserId),
            eq(expenseParticipant.userType, "placeholder")
          ));

        // Add user to group
        await tx.insert(groupMember).values({
          groupId: groupRecord.id,
          userId: session.user.id,
          role: "member",
          joinedAt: new Date(),
        });

        // Log activity
        await tx.insert(activityLog).values({
          groupId: groupRecord.id,
          userId: session.user.id,
          action: "member_joined",
          entityType: "member",
          entityId: session.user.id,
          metadata: JSON.stringify({
            userName: session.user.name,
            userEmail: session.user.email,
            joinMethod: "invite_link",
            claimedPlaceholder: placeholder[0].name,
            placeholderUserId: placeholderUserId,
          }),
          createdAt: new Date(),
        });
      });
    } else {
      // Regular join without claiming placeholder
      await db.insert(groupMember).values({
        groupId: groupRecord.id,
        userId: session.user.id,
        role: "member",
        joinedAt: new Date(),
      });

      // Log activity
      await db.insert(activityLog).values({
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
    }

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

    // Get unclaimed placeholder users
    const unclaimedPlaceholders = await db
      .select({
        id: placeholderUser.id,
        name: placeholderUser.name,
        createdAt: placeholderUser.createdAt,
      })
      .from(placeholderUser)
      .where(and(
        eq(placeholderUser.groupId, groupInfo.group.id),
        isNull(placeholderUser.claimedBy)
      ))
      .orderBy(placeholderUser.name);

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
      unclaimedPlaceholders,
    });

  } catch (error) {
    console.error("Error fetching invite info:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}