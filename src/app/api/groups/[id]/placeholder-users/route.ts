import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeholderUser, groupMember, activityLog } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

// GET /api/groups/[id]/placeholder-users - Get all placeholder users in a group
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

    // Check if user is a member of the group
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
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Get all placeholder users in the group
    const placeholderUsers = await db
      .select()
      .from(placeholderUser)
      .where(eq(placeholderUser.groupId, groupId))
      .orderBy(placeholderUser.createdAt);

    return NextResponse.json({ placeholderUsers });
  } catch (error) {
    console.error("Error fetching placeholder users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/groups/[id]/placeholder-users - Create a new placeholder user
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
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check if user is a member of the group
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
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    // Check if a placeholder user with the same name already exists in the group
    const existingPlaceholder = await db
      .select()
      .from(placeholderUser)
      .where(
        and(
          eq(placeholderUser.groupId, groupId),
          eq(placeholderUser.name, name.trim())
        )
      )
      .limit(1);

    if (existingPlaceholder.length > 0) {
      return NextResponse.json(
        { error: "A placeholder user with this name already exists in the group" },
        { status: 400 }
      );
    }

    // Create the placeholder user
    const [newPlaceholder] = await db
      .insert(placeholderUser)
      .values({
        groupId,
        name: name.trim(),
        createdBy: session.user.id,
        createdAt: new Date(),
      })
      .returning();

    // Log activity
    await db.insert(activityLog).values({
      groupId,
      userId: session.user.id,
      action: "placeholder_created",
      entityType: "placeholder",
      entityId: newPlaceholder.id,
      metadata: JSON.stringify({
        placeholderName: newPlaceholder.name,
        createdBy: session.user.name,
      }),
      createdAt: new Date(),
    });

    return NextResponse.json({ placeholderUser: newPlaceholder });
  } catch (error) {
    console.error("Error creating placeholder user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id]/placeholder-users/[placeholderId] - Delete a placeholder user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; placeholderId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId, placeholderId } = await params;

    // Check if user is an admin of the group
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
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    if (membership[0].role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete placeholder users" }, { status: 403 });
    }

    // Check if the placeholder user exists and belongs to this group
    const placeholder = await db
      .select()
      .from(placeholderUser)
      .where(
        and(
          eq(placeholderUser.id, placeholderId),
          eq(placeholderUser.groupId, groupId)
        )
      )
      .limit(1);

    if (placeholder.length === 0) {
      return NextResponse.json({ error: "Placeholder user not found" }, { status: 404 });
    }

    // Delete the placeholder user
    await db
      .delete(placeholderUser)
      .where(eq(placeholderUser.id, placeholderId));

    // Log activity
    await db.insert(activityLog).values({
      groupId,
      userId: session.user.id,
      action: "placeholder_deleted",
      entityType: "placeholder",
      entityId: placeholderId,
      metadata: JSON.stringify({
        placeholderName: placeholder[0].name,
        deletedBy: session.user.name,
      }),
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting placeholder user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}