import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, expense, expenseParticipant, user, activityLog, placeholderUser } from "@/lib/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const createExpenseSchema = z.object({
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

    // Fetch expenses
    const expenseRecords = await db
      .select()
      .from(expense)
      .where(eq(expense.groupId, groupId))
      .orderBy(desc(expense.createdAt));

    // Process expenses to get payer information
    const expenses = await Promise.all(
      expenseRecords.map(async (exp) => {
        let paidByInfo;
        
        if (exp.paidByType === "placeholder") {
          const placeholder = await db
            .select()
            .from(placeholderUser)
            .where(eq(placeholderUser.id, exp.paidBy))
            .limit(1);
          
          // Check if placeholder has been claimed
          if (placeholder[0]?.claimedBy) {
            // Get the actual user who claimed this placeholder
            const claimedByUser = await db
              .select()
              .from(user)
              .where(eq(user.id, placeholder[0].claimedBy))
              .limit(1);
            
            paidByInfo = claimedByUser[0] ? {
              id: claimedByUser[0].id,
              name: claimedByUser[0].name,
              email: claimedByUser[0].email,
              image: claimedByUser[0].image,
              isPlaceholder: false,
            } : null;
          } else {
            paidByInfo = placeholder[0] ? {
              id: placeholder[0].id,
              name: placeholder[0].name,
              email: null,
              image: null,
              isPlaceholder: true,
            } : null;
          }
        } else {
          const userRecord = await db
            .select()
            .from(user)
            .where(eq(user.id, exp.paidBy))
            .limit(1);
          
          paidByInfo = userRecord[0] ? {
            id: userRecord[0].id,
            name: userRecord[0].name,
            email: userRecord[0].email,
            image: userRecord[0].image,
            isPlaceholder: false,
          } : null;
        }

        return {
          expense: exp,
          paidBy: paidByInfo,
        };
      })
    );

    // Fetch participants for each expense
    const expensesWithParticipants = await Promise.all(
      expenses.map(async (expenseRecord) => {
        const participantRecords = await db
          .select()
          .from(expenseParticipant)
          .where(eq(expenseParticipant.expenseId, expenseRecord.expense.id));

        const participants = await Promise.all(
          participantRecords.map(async (p) => {
            let userInfo;
            let actualUserId = p.userId;
            let actualUserType = p.userType;
            
            if (p.userType === "placeholder") {
              const placeholder = await db
                .select()
                .from(placeholderUser)
                .where(eq(placeholderUser.id, p.userId))
                .limit(1);
              
              // Check if placeholder has been claimed
              if (placeholder[0]?.claimedBy) {
                // Get the actual user who claimed this placeholder
                const claimedByUser = await db
                  .select()
                  .from(user)
                  .where(eq(user.id, placeholder[0].claimedBy))
                  .limit(1);
                
                userInfo = claimedByUser[0] ? {
                  id: claimedByUser[0].id,
                  name: claimedByUser[0].name,
                  email: claimedByUser[0].email,
                  image: claimedByUser[0].image,
                  isPlaceholder: false,
                } : null;
                
                // Update the userId and userType to reflect the actual user
                actualUserId = claimedByUser[0]?.id || p.userId;
                actualUserType = "user";
              } else {
                userInfo = placeholder[0] ? {
                  id: placeholder[0].id,
                  name: placeholder[0].name,
                  email: null,
                  image: null,
                  isPlaceholder: true,
                } : null;
              }
            } else {
              const userRecord = await db
                .select()
                .from(user)
                .where(eq(user.id, p.userId))
                .limit(1);
              
              userInfo = userRecord[0] ? {
                id: userRecord[0].id,
                name: userRecord[0].name,
                email: userRecord[0].email,
                image: userRecord[0].image,
                isPlaceholder: false,
              } : null;
            }

            return {
              userId: actualUserId,
              userType: actualUserType,
              shareAmount: p.shareAmount,
              user: userInfo,
            };
          })
        );

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

    console.log("PaidBy membership verified");

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

    // Create the expense (let DB generate UUID)
    const [createdExpense] = await db.insert(expense).values({
      groupId,
      paidBy: validatedData.paidBy,
      paidByType: validatedData.paidByType || "user",
      amount: validatedData.amount.toString(),
      description: validatedData.description,
      category: null,
      date: new Date(validatedData.date),
    }).returning({ id: expense.id });

    const expenseId = createdExpense.id;

    // Create expense participants
    await db.insert(expenseParticipant).values(
      validatedData.participants.map(participant => ({
        expenseId,
        userId: participant.userId,
        userType: participant.userType || "user",
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