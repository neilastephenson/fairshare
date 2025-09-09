import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { group, groupMember, activityLog } from "@/lib/schema";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await context.params;
    const body = await request.json();
    const { name, description, currency } = body;

    // Check if user is a member of the group
    const membership = await db
      .select()
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.userId, session.user.id)
        )
      );

    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Prepare update data
    const updateData: Partial<{
      name: string;
      description: string | null;
      currency: string;
    }> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (currency !== undefined) {
      const validCurrencies = ["USD", "GBP", "EUR", "OTHER"];
      if (validCurrencies.includes(currency)) {
        updateData.currency = currency;
      }
    }

    // Update the group
    const [updatedGroup] = await db
      .update(group)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(group.id, groupId))
      .returning();

    // Log the update
    await db.insert(activityLog).values({
      groupId,
      userId: session.user.id,
      action: "group_updated",
      entityType: "group",
      entityId: groupId,
      metadata: JSON.stringify(updateData),
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error("Error updating group:", error);
    return NextResponse.json(
      { error: "Failed to update group" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId } = await context.params;

    // Check if user is a member of the group
    const membership = await db
      .select()
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.userId, session.user.id)
        )
      );

    if (!membership || membership.length === 0) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Get group details
    const [groupData] = await db
      .select()
      .from(group)
      .where(eq(group.id, groupId));

    if (!groupData) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    return NextResponse.json(groupData);
  } catch (error) {
    console.error("Error fetching group:", error);
    return NextResponse.json(
      { error: "Failed to fetch group" },
      { status: 500 }
    );
  }
}