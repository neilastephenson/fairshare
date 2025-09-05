import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, expense, expenseParticipant, user, activityLog } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { inArray } from "drizzle-orm";

const createExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  category: z.string().nullable().optional(),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid date"),
  paidBy: z.string().min(1, "Paid by is required"),
  participants: z.array(z.object({
    userId: z.string(),
    shareAmount: z.number().positive("Share amount must be positive")
  })).min(1, "At least one participant is required")
});

// GET /api/groups/[id]/expenses - Get expenses for a group
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

    // Fetch expenses with participants
    const expenses = await db
      .select({
        expense: expense,
        paidBy: {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        },
      })
      .from(expense)
      .leftJoin(user, eq(expense.paidBy, user.id))
      .where(eq(expense.groupId, groupId))
      .orderBy(desc(expense.createdAt));

    // Fetch participants for each expense
    const expensesWithParticipants = await Promise.all(
      expenses.map(async (expenseRecord) => {
        const participants = await db
          .select({
            userId: expenseParticipant.userId,
            shareAmount: expenseParticipant.shareAmount,
            user: {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
            },
          })
          .from(expenseParticipant)
          .leftJoin(user, eq(expenseParticipant.userId, user.id))
          .where(eq(expenseParticipant.expenseId, expenseRecord.expense.id));

        return {
          ...expenseRecord.expense,
          paidBy: expenseRecord.paidBy,
          participants: participants,
        };
      })
    );

    return NextResponse.json({ expenses: expensesWithParticipants });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/groups/[id]/expenses - Create a new expense
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

    console.log("Request body:", body);
    
    // Validate request body
    const validatedData = createExpenseSchema.parse(body);
    console.log("Validated data:", validatedData);

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

    console.log("User membership verified");

    // Verify the person who paid is also a group member
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

    console.log("PaidBy membership verified");

    // Verify all participants are members of the group
    const participantIds = validatedData.participants.map(p => p.userId);
    const participantMemberships = await db
      .select()
      .from(groupMember)
      .where(and(
        eq(groupMember.groupId, groupId),
        inArray(groupMember.userId, participantIds)
      ));

    const memberIds = participantMemberships.map(m => m.userId);
    const invalidParticipants = participantIds.filter(id => !memberIds.includes(id));
    
    if (invalidParticipants.length > 0) {
      return NextResponse.json(
        { error: "Some participants are not members of this group" },
        { status: 400 }
      );
    }

    // Verify the total of participant shares equals the expense amount
    const totalShares = validatedData.participants.reduce((sum, p) => sum + p.shareAmount, 0);
    if (Math.abs(totalShares - validatedData.amount) > 0.01) {
      return NextResponse.json(
        { error: "Participant shares must equal the total expense amount" },
        { status: 400 }
      );
    }

    // Create the expense (let DB generate UUID)
    const [createdExpense] = await db.insert(expense).values({
      groupId,
      paidBy: validatedData.paidBy,
      amount: validatedData.amount.toString(),
      description: validatedData.description,
      category: validatedData.category,
      date: new Date(validatedData.date),
    }).returning({ id: expense.id });

    const expenseId = createdExpense.id;

    // Create expense participants
    await db.insert(expenseParticipant).values(
      validatedData.participants.map(participant => ({
        expenseId,
        userId: participant.userId,
        shareAmount: participant.shareAmount.toString(),
      }))
    );

    // Log activity (let DB generate UUID)
    await db.insert(activityLog).values({
      groupId,
      userId: session.user.id,
      action: "expense_added",
      entityType: "expense",
      entityId: expenseId,
      metadata: JSON.stringify({
        description: validatedData.description,
        amount: validatedData.amount,
        category: validatedData.category,
      }),
    });

    return NextResponse.json({ 
      success: true, 
      expenseId 
    }, { status: 201 });

  } catch (error) {
    console.error("Error creating expense:", error);
    
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