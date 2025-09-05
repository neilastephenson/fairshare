import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, expense, expenseParticipant, user } from "@/lib/schema";
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

    // Calculate balances for each member
    const balances = await Promise.all(
      members.map(async (member) => {
        // Amount this member paid
        const paidResult = await db
          .select({
            total: sqlSum(expense.amount).mapWith((val) => Number(val) || 0),
          })
          .from(expense)
          .where(and(
            eq(expense.groupId, groupId),
            eq(expense.paidBy, member.userId!)
          ));

        const totalPaid = paidResult[0]?.total || 0;

        // Amount this member owes (their share of all expenses)
        const owedResult = await db
          .select({
            total: sqlSum(expenseParticipant.shareAmount).mapWith((val) => Number(val) || 0),
          })
          .from(expenseParticipant)
          .leftJoin(expense, eq(expenseParticipant.expenseId, expense.id))
          .where(and(
            eq(expense.groupId, groupId),
            eq(expenseParticipant.userId, member.userId!)
          ));

        const totalOwed = owedResult[0]?.total || 0;

        // Net balance: positive means they should receive money, negative means they owe money
        const netBalance = totalPaid - totalOwed;

        return {
          userId: member.userId!,
          userName: member.userName!,
          userEmail: member.userEmail!,
          userImage: member.userImage || undefined,
          totalPaid,
          totalOwed,
          netBalance,
        };
      })
    );

    // Calculate group totals
    const totalExpenses = balances.reduce((sum, balance) => sum + balance.totalPaid, 0);
    const totalMembers = members.length;
    const averagePerMember = totalMembers > 0 ? totalExpenses / totalMembers : 0;

    return NextResponse.json({
      balances,
      totals: {
        totalExpenses,
        totalMembers,
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