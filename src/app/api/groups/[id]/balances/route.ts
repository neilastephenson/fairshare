import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, expense, expenseParticipant, user, placeholderUser } from "@/lib/schema";
import { eq, and, sum as sqlSum } from "drizzle-orm";

// GET /api/groups/[id]/balances - Get balances for group members
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

    // Get all group members
    const members = await db
      .select({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
      })
      .from(groupMember)
      .leftJoin(user, eq(groupMember.userId, user.id))
      .where(eq(groupMember.groupId, groupId));

    // Get all placeholder users (including claimed ones)
    const placeholders = await db
      .select({
        userId: placeholderUser.id,
        userName: placeholderUser.name,
        claimedBy: placeholderUser.claimedBy,
      })
      .from(placeholderUser)
      .where(eq(placeholderUser.groupId, groupId));

    // Combine members and unclaimed placeholders for balance calculations
    const allParticipants = [
      ...members.map(m => ({ ...m, type: 'user' as const })),
      ...placeholders
        .filter(p => !p.claimedBy) // Only include unclaimed placeholders
        .map(p => ({
          userId: p.userId,
          userName: p.userName,
          userEmail: null,
          userImage: null,
          type: 'placeholder' as const,
        })),
    ];

    // Calculate balances for each participant
    const balances = await Promise.all(
      allParticipants.map(async (participant) => {
        // Amount this participant paid
        const paidResult = await db
          .select({
            total: sqlSum(expense.amount).mapWith((val) => Number(val) || 0),
          })
          .from(expense)
          .where(and(
            eq(expense.groupId, groupId),
            eq(expense.paidBy, participant.userId!),
            eq(expense.paidByType, participant.type)
          ));

        const totalPaid = paidResult[0]?.total || 0;

        // Amount this participant owes (their share of all expenses)
        const owedResult = await db
          .select({
            total: sqlSum(expenseParticipant.shareAmount).mapWith((val) => Number(val) || 0),
          })
          .from(expenseParticipant)
          .leftJoin(expense, eq(expenseParticipant.expenseId, expense.id))
          .where(and(
            eq(expense.groupId, groupId),
            eq(expenseParticipant.userId, participant.userId!),
            eq(expenseParticipant.userType, participant.type)
          ));

        const totalOwed = owedResult[0]?.total || 0;

        // Net balance: positive means they should receive money, negative means they owe money
        const netBalance = totalPaid - totalOwed;

        return {
          userId: participant.userId!,
          userName: participant.userName!,
          userEmail: participant.userEmail!,
          userImage: participant.userImage || undefined,
          userType: participant.type,
          totalPaid,
          totalOwed,
          netBalance,
        };
      })
    );

    // Calculate group totals
    const totalExpenses = balances.reduce((sum, balance) => sum + balance.totalPaid, 0);
    const totalMembers = members.length;
    const totalPlaceholders = placeholders.filter(p => !p.claimedBy).length;
    const totalParticipants = totalMembers + totalPlaceholders;
    const averagePerMember = totalParticipants > 0 ? totalExpenses / totalParticipants : 0;

    return NextResponse.json({
      balances,
      totals: {
        totalExpenses,
        totalMembers,
        totalPlaceholders,
        totalParticipants,
        averagePerMember,
      },
    });
  } catch (error) {
    console.error("Error fetching balances:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}