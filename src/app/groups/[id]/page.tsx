import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { group, groupMember, user } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Removed unused Card imports
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ExpenseList } from "@/components/groups/expense-list";
import { MemberList } from "@/components/groups/member-list";
import { BalanceView } from "@/components/groups/balance-view";
import { SettleUpView } from "@/components/groups/settle-up-view";
import { ActivityLog } from "@/components/groups/activity-log";
import { InviteSection } from "@/components/groups/invite-section";
import { GroupSettings } from "@/components/groups/group-settings";
import { Users, Receipt, Calculator, CreditCard, Activity } from "lucide-react";

interface GroupPageProps {
  params: Promise<{ id: string }>;
}

export default async function GroupPage({ params }: GroupPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { id: groupId } = await params;

  // Fetch group details and verify user is a member
  const groupData = await db
    .select({
      group: group,
      role: groupMember.role,
      creator: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(group)
    .leftJoin(groupMember, and(
      eq(groupMember.groupId, group.id),
      eq(groupMember.userId, session.user.id)
    ))
    .leftJoin(user, eq(user.id, group.createdBy))
    .where(eq(group.id, groupId));

  if (!groupData || groupData.length === 0) {
    notFound();
  }

  const groupInfo = groupData[0];
  
  // Check if user is a member
  if (!groupInfo.role) {
    redirect(`/invite/${groupInfo.group.inviteCode}`);
  }

  const isAdmin = groupInfo.role === 'admin';

  return (
    <main className="flex-1 container mx-auto px-4 py-8 min-w-0">
      <div className="max-w-6xl mx-auto min-w-0">
        {/* Group Header */}
        <div className="mb-8 min-w-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold truncate">{groupInfo.group.name}</h1>
                {groupInfo.group.description && (
                  <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                    {groupInfo.group.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-auto">
              {isAdmin && (
                <GroupSettings
                  groupId={groupId}
                  groupName={groupInfo.group.name}
                  groupDescription={groupInfo.group.description}
                  groupCurrency={groupInfo.group.currency}
                  isAdmin={isAdmin}
                />
              )}
              <Badge variant={isAdmin ? "default" : "secondary"}>
                {isAdmin ? "Admin" : "Member"}
              </Badge>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground">
            <span className="truncate">Created by {groupInfo.creator?.name}</span>
            <span className="hidden sm:inline">•</span>
            <span className="truncate">Created {new Date(groupInfo.group.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Invite Section for Admins */}
        {isAdmin && (
          <>
            <InviteSection 
              groupId={groupId}
              inviteCode={groupInfo.group.inviteCode}
            />
            <div className="mb-8">
              <Separator />
            </div>
          </>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="expenses" className="w-full min-w-0">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="expenses" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm">
              <Receipt className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Expenses</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm">
              <Calculator className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Balances</span>
            </TabsTrigger>
            <TabsTrigger value="settle" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm">
              <CreditCard className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Settle Up</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm">
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Members</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-2 px-2 text-xs sm:text-sm">
              <Activity className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Activity</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses" className="mt-6">
            <ExpenseList groupId={groupId} currency={groupInfo.group.currency} />
          </TabsContent>

          <TabsContent value="balances" className="mt-6">
            <BalanceView groupId={groupId} currency={groupInfo.group.currency} />
          </TabsContent>

          <TabsContent value="settle" className="mt-6">
            <SettleUpView groupId={groupId} currency={groupInfo.group.currency} />
          </TabsContent>

          <TabsContent value="members" className="mt-6">
            <MemberList 
              groupId={groupId}
              currentUserId={session.user.id}
              isAdmin={isAdmin}
            />
          </TabsContent>

          <TabsContent value="activity" className="mt-6">
            <ActivityLog groupId={groupId} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}