import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { placeholderUser, groupMember, expense, expenseParticipant } from "@/lib/schema";
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
    const placeholders = await db
      .select()
      .from(placeholderUser)
      .where(eq(placeholderUser.groupId, groupId))
      .orderBy(placeholderUser.createdAt);

    // Check for expenses for each placeholder user
    const placeholderUsersWithExpenseInfo = await Promise.all(
      placeholders.map(async (placeholder) => {
        // Check if placeholder has expenses as payer
        const expensesAsPayer = await db
          .select({ count: expense.id })
          .from(expense)
          .where(and(
            eq(expense.paidBy, placeholder.id),
            eq(expense.paidByType, "placeholder")
          ));

        // Check if placeholder has expenses as participant
        const expensesAsParticipant = await db
          .select({ count: expenseParticipant.id })
          .from(expenseParticipant)
          .where(and(
            eq(expenseParticipant.userId, placeholder.id),
            eq(expenseParticipant.userType, "placeholder")
          ));

        const hasExpenses = expensesAsPayer.length > 0 || expensesAsParticipant.length > 0;

        return {
          ...placeholder,
          hasExpenses
        };
      })
    );

    return NextResponse.json({ placeholderUsers: placeholderUsersWithExpenseInfo });
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

    // Note: We don't log activity for placeholder creation to avoid cluttering the activity log

    return NextResponse.json({ placeholderUser: newPlaceholder });
  } catch (error) {
    console.error("Error creating placeholder user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

