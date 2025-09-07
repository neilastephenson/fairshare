import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, expense, expenseParticipant, user, placeholderUser } from "@/lib/schema";
import { eq, and, sum as sqlSum } from "drizzle-orm";

interface Balance {
  userId: string;
  userName: string;
  userEmail: string | null;
  userImage?: string | null;
  userType: "user" | "placeholder";
  paymentInfo?: string | null;
  netBalance: number;
}

interface SettlementTransaction {
  from: {
    id: string;
    name: string;
    email: string | null;
    image?: string | null;
    type: "user" | "placeholder";
    paymentInfo?: string | null;
  };
  to: {
    id: string;
    name: string;
    email: string | null;
    image?: string | null;
    type: "user" | "placeholder";
    paymentInfo?: string | null;
  };
  amount: number;
}

// Optimized settlement algorithm using greedy approach
function calculateOptimalSettlements(balances: Balance[]): SettlementTransaction[] {
  const settlements: SettlementTransaction[] = [];
  
  // Separate creditors (owed money) and debtors (owe money)
  const creditors = balances
    .filter(b => b.netBalance > 0.01)
    .map(b => ({ ...b, remaining: b.netBalance }))
    .sort((a, b) => b.remaining - a.remaining);
  
  const debtors = balances
    .filter(b => b.netBalance < -0.01)
    .map(b => ({ ...b, remaining: Math.abs(b.netBalance) }))
    .sort((a, b) => b.remaining - a.remaining);

  let creditorIndex = 0;
  let debtorIndex = 0;

  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];

    // Calculate settlement amount (minimum of what creditor is owed and debtor owes)
    const settlementAmount = Math.min(creditor.remaining, debtor.remaining);

    if (settlementAmount > 0.01) { // Only create settlements for amounts > 1 cent
      settlements.push({
        from: {
          id: debtor.userId,
          name: debtor.userName,
          email: debtor.userEmail,
          image: debtor.userImage,
          type: debtor.userType,
          paymentInfo: debtor.paymentInfo,
        },
        to: {
          id: creditor.userId,
          name: creditor.userName,
          email: creditor.userEmail,
          image: creditor.userImage,
          type: creditor.userType,
          paymentInfo: creditor.paymentInfo,
        },
        amount: settlementAmount,
      });
    }

    // Update remaining amounts
    creditor.remaining -= settlementAmount;
    debtor.remaining -= settlementAmount;

    // Move to next creditor/debtor if current one is settled
    if (creditor.remaining <= 0.01) {
      creditorIndex++;
    }
    if (debtor.remaining <= 0.01) {
      debtorIndex++;
    }
  }

  return settlements;
}

// GET /api/groups/[id]/settlements - Get optimized settlement transactions
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

    // Get all group members with payment info
    const members = await db
      .select({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        userImage: user.image,
        paymentInfo: user.paymentInfo,
      })
      .from(groupMember)
      .leftJoin(user, eq(groupMember.userId, user.id))
      .where(eq(groupMember.groupId, groupId));

    // Get all placeholder users (unclaimed only)
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
      ...members.map(m => ({ ...m, userType: 'user' as const })),
      ...placeholders
        .filter(p => !p.claimedBy) // Only include unclaimed placeholders
        .map(p => ({
          userId: p.userId,
          userName: p.userName,
          userEmail: null,
          userImage: null,
          paymentInfo: null,
          userType: 'placeholder' as const,
        })),
    ];

    // Calculate balances for each participant
    const balances: Balance[] = await Promise.all(
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
            eq(expense.paidByType, participant.userType)
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
            eq(expenseParticipant.userType, participant.userType)
          ));

        const totalOwed = owedResult[0]?.total || 0;

        // Net balance: positive means they should receive money, negative means they owe money
        const netBalance = totalPaid - totalOwed;

        return {
          userId: participant.userId!,
          userName: participant.userName!,
          userEmail: participant.userEmail!,
          userImage: participant.userImage || undefined,
          userType: participant.userType,
          paymentInfo: participant.paymentInfo || null,
          netBalance,
        };
      })
    );

    // Calculate optimal settlements
    const settlements = calculateOptimalSettlements(balances);

    return NextResponse.json({ settlements });
  } catch (error) {
    console.error("Error calculating settlements:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}