import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { group, groupMember, receiptSession } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { ReceiptClaimingInterface } from "@/components/groups/receipt-claiming-interface";

interface ReceiptPageProps {
  params: Promise<{ id: string; sessionId: string }>;
}

export default async function ReceiptPage({ params }: ReceiptPageProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  const { id: groupId, sessionId } = await params;

  // Fetch group details and verify user is a member
  const groupData = await db
    .select({
      group: group,
      isMember: groupMember.userId,
    })
    .from(group)
    .leftJoin(groupMember, and(
      eq(groupMember.groupId, group.id),
      eq(groupMember.userId, session.user.id)
    ))
    .where(eq(group.id, groupId));

  if (!groupData || groupData.length === 0) {
    notFound();
  }

  const groupInfo = groupData[0];
  
  // Check if user is a member
  if (!groupInfo.isMember) {
    redirect(`/invite/${groupInfo.group.inviteCode}`);
  }

  // Verify receipt session exists and belongs to this group
  const receiptSessionData = await db
    .select()
    .from(receiptSession)
    .where(
      and(
        eq(receiptSession.id, sessionId),
        eq(receiptSession.groupId, groupId)
      )
    )
    .limit(1);

  if (receiptSessionData.length === 0) {
    notFound();
  }

  const receiptData = receiptSessionData[0];

  // Check if session has expired
  if (new Date() > receiptData.expiresAt) {
    redirect(`/groups/${groupId}?error=receipt-expired`);
  }

  return (
    <main className="flex-1 container mx-auto px-4 py-8 min-w-0">
      <div className="max-w-4xl mx-auto min-w-0">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">Receipt Claiming Session</h1>
          </div>
          <p className="text-muted-foreground">
            Claim items from {receiptData.merchantName || "this receipt"} • Expires at {receiptData.expiresAt.toLocaleString()}
          </p>
        </div>

        {/* Receipt Claiming Interface */}
        <ReceiptClaimingInterface
          groupId={groupId}
          sessionId={sessionId}
          groupCurrency={groupInfo.group.currency}
          currentUserId={session.user.id}
        />
      </div>
    </main>
  );
}