import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeholderUser, groupMember, expense, expenseParticipant } from "@/lib/schema";
import { eq, and } from "drizzle-orm";

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

    // Prevent deleting claimed placeholder users
    if (placeholder[0].claimedBy) {
      return NextResponse.json({ error: "Cannot delete claimed placeholder users" }, { status: 400 });
    }

    // Check if the placeholder user has any associated expenses
    const expensesAsPayer = await db
      .select({ count: expense.id })
      .from(expense)
      .where(and(
        eq(expense.paidBy, placeholderId),
        eq(expense.paidByType, "placeholder")
      ));

    const expensesAsParticipant = await db
      .select({ count: expenseParticipant.id })
      .from(expenseParticipant)
      .where(and(
        eq(expenseParticipant.userId, placeholderId),
        eq(expenseParticipant.userType, "placeholder")
      ));

    if (expensesAsPayer.length > 0 || expensesAsParticipant.length > 0) {
      return NextResponse.json({ 
        error: "Cannot delete placeholder user with associated expenses. Please delete all related expenses first." 
      }, { status: 400 });
    }

    // Delete the placeholder user
    await db
      .delete(placeholderUser)
      .where(eq(placeholderUser.id, placeholderId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting placeholder user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}