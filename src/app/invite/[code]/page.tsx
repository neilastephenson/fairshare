import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { group, groupMember, user } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
// Removed unused Button and Badge imports
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, UserPlus, CheckCircle } from "lucide-react";
import { JoinGroupForm } from "@/components/groups/join-group-form";

interface InvitePageProps {
  params: Promise<{ code: string }>;
}

export default async function InvitePage({ params }: InvitePageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(`/invite/${(await params).code}`)}`);
  }

  const { code: inviteCode } = await params;

  // Fetch group details by invite code
  const groupData = await db
    .select({
      group: group,
      creator: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
      },
    })
    .from(group)
    .leftJoin(user, eq(user.id, group.createdBy))
    .where(eq(group.inviteCode, inviteCode));

  if (!groupData || groupData.length === 0) {
    notFound();
  }

  const groupInfo = groupData[0];

  // Check if user is already a member
  const existingMembership = await db
    .select()
    .from(groupMember)
    .where(and(
      eq(groupMember.groupId, groupInfo.group.id),
      eq(groupMember.userId, session.user.id)
    ))
    .limit(1);

  const isAlreadyMember = existingMembership.length > 0;

  // Get member count
  const memberCount = await db
    .select({ count: groupMember.id })
    .from(groupMember)
    .where(eq(groupMember.groupId, groupInfo.group.id));

  const totalMembers = memberCount.length;

  // If already a member, redirect to group
  if (isAlreadyMember) {
    redirect(`/groups/${groupInfo.group.id}`);
  }

  return (
    <main className="flex-1 container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10">
              <UserPlus className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Join Group</CardTitle>
            <CardDescription>
              You&apos;ve been invited to join a FairShare group
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Group Info */}
            <div className="text-center space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{groupInfo.group.name}</h3>
                {groupInfo.group.description && (
                  <p className="text-muted-foreground mt-1">
                    {groupInfo.group.description}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>{totalMembers} member{totalMembers !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Creator Info */}
              <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={groupInfo.creator?.image || ''} />
                  <AvatarFallback>
                    {groupInfo.creator?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left">
                  <p className="text-sm font-medium">Created by</p>
                  <p className="text-sm text-muted-foreground">
                    {groupInfo.creator?.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Join Form */}
            <JoinGroupForm 
              groupId={groupInfo.group.id}
              groupName={groupInfo.group.name}
              inviteCode={inviteCode}
            />
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">Safe & Secure</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Your financial data is private and only shared with group members
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}