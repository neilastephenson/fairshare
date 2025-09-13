import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, expense, expenseParticipant, activityLog, placeholderUser, receiptSession } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid date"),
  paidBy: z.string().min(1, "Paid by is required"),
  paidByType: z.enum(["user", "placeholder"]).default("user"),
  participants: z.array(z.object({
    userId: z.string(),
    userType: z.enum(["user", "placeholder"]).default("user"),
    shareAmount: z.number().positive("Share amount must be positive")
  })).min(1, "At least one participant is required")
});

// PUT /api/groups/[id]/expenses/[expenseId] - Update an expense
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId, expenseId } = await params;
    const body = await request.json();

    console.log("Updating expense:", { groupId, expenseId, body });
    
    // Validate request body
    const validatedData = updateExpenseSchema.parse(body);

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

    // Verify the expense exists and belongs to this group
    const existingExpense = await db
      .select()
      .from(expense)
      .where(and(
        eq(expense.id, expenseId),
        eq(expense.groupId, groupId)
      ))
      .limit(1);

    if (existingExpense.length === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // Verify the person who paid is either a group member or a placeholder user
    if (validatedData.paidByType === "user") {
      const paidByMembership = await db
        .select()
        .from(groupMember)
        .where(and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.userId, validatedData.paidBy)
        ))
        .limit(1);

      if (paidByMembership.length === 0) {
        return NextResponse.json({ error: "Person who paid is not a member of this group" }, { status: 400 });
      }
    } else {
      const placeholder = await db
        .select()
        .from(placeholderUser)
        .where(and(
          eq(placeholderUser.id, validatedData.paidBy),
          eq(placeholderUser.groupId, groupId)
        ))
        .limit(1);

      if (placeholder.length === 0) {
        return NextResponse.json({ error: "Placeholder user not found in this group" }, { status: 400 });
      }
    }

    // Verify all participants are either members or placeholder users of the group
    for (const participant of validatedData.participants) {
      if (participant.userType === "user") {
        const membership = await db
          .select()
          .from(groupMember)
          .where(and(
            eq(groupMember.groupId, groupId),
            eq(groupMember.userId, participant.userId)
          ))
          .limit(1);

        if (membership.length === 0) {
          return NextResponse.json(
            { error: `User ${participant.userId} is not a member of this group` },
            { status: 400 }
          );
        }
      } else {
        const placeholder = await db
          .select()
          .from(placeholderUser)
          .where(and(
            eq(placeholderUser.id, participant.userId),
            eq(placeholderUser.groupId, groupId)
          ))
          .limit(1);

        if (placeholder.length === 0) {
          return NextResponse.json(
            { error: `Placeholder user ${participant.userId} not found in this group` },
            { status: 400 }
          );
        }
      }
    }

    // Verify the total of participant shares equals the expense amount
    const totalShares = validatedData.participants.reduce((sum, p) => sum + p.shareAmount, 0);
    if (Math.abs(totalShares - validatedData.amount) > 0.01) {
      return NextResponse.json(
        { error: "Participant shares must equal the total expense amount" },
        { status: 400 }
      );
    }

    // Update the expense
    await db
      .update(expense)
      .set({
        paidBy: validatedData.paidBy,
        paidByType: validatedData.paidByType || "user",
        amount: validatedData.amount.toString(),
        description: validatedData.description,
        category: null,
        date: new Date(validatedData.date),
        updatedAt: new Date(),
      })
      .where(eq(expense.id, expenseId));

    // Delete existing participants
    await db
      .delete(expenseParticipant)
      .where(eq(expenseParticipant.expenseId, expenseId));

    // Create new expense participants
    await db.insert(expenseParticipant).values(
      validatedData.participants.map(participant => ({
        expenseId,
        userId: participant.userId,
        userType: participant.userType || "user",
        shareAmount: participant.shareAmount.toString(),
      }))
    );

    // Log activity
    await db.insert(activityLog).values({
      groupId,
      userId: session.user.id,
      action: "expense_edited",
      entityType: "expense",
      entityId: expenseId,
      metadata: JSON.stringify({
        description: validatedData.description,
        amount: validatedData.amount,
        previousAmount: parseFloat(existingExpense[0].amount),
        previousDescription: existingExpense[0].description,
      }),
    });

    return NextResponse.json({ 
      success: true, 
      expenseId 
    });

  } catch (error) {
    console.error("Error updating expense:", error);
    
    if (error instanceof z.ZodError) {
      console.error("Zod validation errors:", error.issues);
      return NextResponse.json(
        { error: "Invalid data", details: error.issues },
        { status: 400 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE /api/groups/[id]/expenses/[expenseId] - Delete an expense
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId, expenseId } = await params;

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

    // Verify the expense exists and belongs to this group
    const existingExpense = await db
      .select()
      .from(expense)
      .where(and(
        eq(expense.id, expenseId),
        eq(expense.groupId, groupId)
      ))
      .limit(1);

    if (existingExpense.length === 0) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // First, check if this expense is linked to any receipt sessions
    // If so, unlink them by setting expenseId to null
    await db
      .update(receiptSession)
      .set({ expenseId: null })
      .where(eq(receiptSession.expenseId, expenseId));

    // Delete the expense (participants will be cascade deleted)
    await db
      .delete(expense)
      .where(eq(expense.id, expenseId));

    // Log activity
    await db.insert(activityLog).values({
      groupId,
      userId: session.user.id,
      action: "expense_deleted",
      entityType: "expense",
      entityId: expenseId,
      metadata: JSON.stringify({
        description: existingExpense[0].description,
        amount: parseFloat(existingExpense[0].amount),
        category: existingExpense[0].category,
      }),
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error deleting expense:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}