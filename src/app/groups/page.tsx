import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { group, groupMember, expense, expenseParticipant } from "@/lib/schema";
import { eq, and, sum as sqlSum } from "drizzle-orm";
import { GroupList } from "@/components/groups/group-list";
import { CreateGroupButton } from "@/components/groups/create-group-button";
import { Users } from "lucide-react";

async function getUserBalanceForGroup(groupId: string, userId: string): Promise<number> {
  // Amount user paid
  const paidResult = await db
    .select({
      total: sqlSum(expense.amount).mapWith((val) => Number(val) || 0),
    })
    .from(expense)
    .where(and(
      eq(expense.groupId, groupId),
      eq(expense.paidBy, userId),
      eq(expense.paidByType, 'user')
    ));

  const totalPaid = paidResult[0]?.total || 0;

  // Amount user owes (their share of all expenses)
  const owedResult = await db
    .select({
      total: sqlSum(expenseParticipant.shareAmount).mapWith((val) => Number(val) || 0),
    })
    .from(expenseParticipant)
    .leftJoin(expense, eq(expenseParticipant.expenseId, expense.id))
    .where(and(
      eq(expense.groupId, groupId),
      eq(expenseParticipant.userId, userId),
      eq(expenseParticipant.userType, 'user')
    ));

  const totalOwed = owedResult[0]?.total || 0;

  // Net balance: positive means they should receive money, negative means they owe money
  return totalPaid - totalOwed;
}

export default async function GroupsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Fetch user's groups
  const memberships = await db
    .select({
      group: group,
    })
    .from(groupMember)
    .innerJoin(group, eq(groupMember.groupId, group.id))
    .where(eq(groupMember.userId, session.user.id));

  // Fetch balance for each group
  const userGroups = await Promise.all(
    memberships.map(async (m) => {
      const balance = await getUserBalanceForGroup(m.group.id, session.user.id);
      return {
        ...m.group,
        userBalance: balance,
      };
    })
  );

  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 sm:h-8 sm:w-8" />
              My Groups
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2">
              Manage your expense groups and create new ones
            </p>
          </div>
          <CreateGroupButton />
        </div>

        {userGroups.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/20">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No groups yet</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first group to start tracking shared expenses with friends, family, or roommates.
            </p>
            <CreateGroupButton />
          </div>
        ) : (
          <GroupList groups={userGroups} />
        )}
      </div>
    </main>
  );
}