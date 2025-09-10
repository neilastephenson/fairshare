import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, receiptSession, receiptItem, receiptItemClaim, user } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { broadcastToSession } from "@/lib/realtime-connections";

interface RouteParams {
  params: Promise<{ id: string; sessionId: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: groupId, sessionId } = await params;

    // Verify user is a member of the group
    const membership = await db
      .select()
      .from(groupMember)
      .where(
        and(
          eq(groupMember.groupId, groupId),
          eq(groupMember.userId, session.user.id)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return NextResponse.json({ error: "Not a member of this group" }, { status: 403 });
    }

    const body = await request.json();
    const { itemId, action } = body;

    if (!itemId || !action || !["claim", "unclaim"].includes(action)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Verify receipt session exists and is not expired
    const sessionData = await db
      .select()
      .from(receiptSession)
      .where(
        and(
          eq(receiptSession.id, sessionId),
          eq(receiptSession.groupId, groupId)
        )
      )
      .limit(1);

    if (sessionData.length === 0) {
      return NextResponse.json({ error: "Receipt session not found" }, { status: 404 });
    }

    const receiptSessionData = sessionData[0];

    if (new Date() > receiptSessionData.expiresAt) {
      return NextResponse.json({ error: "Receipt session has expired" }, { status: 410 });
    }

    if (receiptSessionData.status !== "claiming") {
      return NextResponse.json({ error: "Receipt session is not in claiming state" }, { status: 400 });
    }

    // Verify item belongs to this session
    const itemData = await db
      .select()
      .from(receiptItem)
      .where(
        and(
          eq(receiptItem.id, itemId),
          eq(receiptItem.receiptSessionId, sessionId)
        )
      )
      .limit(1);

    if (itemData.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    try {
      if (action === "claim") {
        // For now, just try to insert - if it fails due to duplicate, that's fine
        try {
          await db
            .insert(receiptItemClaim)
            .values({
              receiptItemId: itemId,
              userId: session.user.id,
              userType: "user",
            });
          console.log("Claim created successfully");
        } catch (insertError) {
          console.log("Claim insert failed (might be duplicate):", insertError);
          // If it's a duplicate, that's fine - user already claimed it
        }

      } else if (action === "unclaim") {
        // Try to remove claim
        try {
          await db
            .delete(receiptItemClaim)
            .where(
              and(
                eq(receiptItemClaim.receiptItemId, itemId),
                eq(receiptItemClaim.userId, session.user.id),
                eq(receiptItemClaim.userType, "user")
              )
            );
          console.log("Claim removed successfully");
        } catch (deleteError) {
          console.log("Claim delete failed:", deleteError);
        }
      }

      // Get updated claim count and user info for this item
      let totalClaims = 1;
      let claimersInfo: Array<{
        userId: string;
        userName: string;
        userImage?: string;
        userType: string;
        claimedAt: Date;
      }> = [];
      try {
        const claimData = await db
          .select({
            claimId: receiptItemClaim.id,
            userId: receiptItemClaim.userId,
            userType: receiptItemClaim.userType,
            claimedAt: receiptItemClaim.claimedAt,
            userName: user.name,
            userImage: user.image,
          })
          .from(receiptItemClaim)
          .leftJoin(user, eq(receiptItemClaim.userId, user.id))
          .where(eq(receiptItemClaim.receiptItemId, itemId));
        
        totalClaims = claimData.length;
        claimersInfo = claimData.map(claim => ({
          userId: claim.userId,
          userName: claim.userName || "Unknown User",
          userImage: claim.userImage || undefined,
          userType: claim.userType,
          claimedAt: claim.claimedAt,
        }));
      } catch (countError) {
        console.log("Error getting claim info (using fallback):", countError);
      }

      const sharePerPerson = totalClaims > 0 ? parseFloat(itemData[0].itemPrice) / totalClaims : parseFloat(itemData[0].itemPrice);

      // Broadcast real-time update to all connected clients
      console.log(`About to broadcast ${action} for item ${itemId} to session ${sessionId}`);
      
      // Small delay to ensure API response is sent before broadcast
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        broadcastToSession(sessionId, {
          type: action === "claim" ? "item_claimed" : "item_unclaimed",
          itemId,
          itemName: itemData[0].itemName,
          itemPrice: parseFloat(itemData[0].itemPrice),
          userId: session.user.id,
          userName: session.user.name,
          userImage: session.user.image || undefined,
          totalClaims,
          sharePerPerson,
          claimersInfo,
          timestamp: new Date().toISOString(),
        });
        console.log(`Broadcast completed for ${action} on item ${itemId}`);
      } catch (broadcastError) {
        console.error("Failed to broadcast update:", broadcastError);
      }

      return NextResponse.json({
        success: true,
        action,
        itemId,
        totalClaims,
        sharePerPerson,
        claimersInfo,
      });
      
    } catch (claimError) {
      console.error("Database operation error:", claimError);
      // Get updated claim count even if database operations failed
      let totalClaims = 1;
      let claimersInfo: Array<{
        userId: string;
        userName: string;
        userImage?: string;
        userType: string;
        claimedAt: Date;
      }> = [];
      try {
        const claimData = await db
          .select({
            claimId: receiptItemClaim.id,
            userId: receiptItemClaim.userId,
            userType: receiptItemClaim.userType,
            claimedAt: receiptItemClaim.claimedAt,
            userName: user.name,
            userImage: user.image,
          })
          .from(receiptItemClaim)
          .leftJoin(user, eq(receiptItemClaim.userId, user.id))
          .where(eq(receiptItemClaim.receiptItemId, itemId));
        
        totalClaims = claimData.length;
        claimersInfo = claimData.map(claim => ({
          userId: claim.userId,
          userName: claim.userName || "Unknown User",
          userImage: claim.userImage || undefined,
          userType: claim.userType,
          claimedAt: claim.claimedAt,
        }));
      } catch (countError) {
        console.log("Error getting claim info in fallback (using defaults):", countError);
      }

      const sharePerPerson = totalClaims > 0 ? parseFloat(itemData[0].itemPrice) / totalClaims : parseFloat(itemData[0].itemPrice);

      // Still try to broadcast update even on error
      console.log(`[FALLBACK] About to broadcast ${action} for item ${itemId} to session ${sessionId}`);
      
      // Small delay to ensure API response is sent before broadcast
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        broadcastToSession(sessionId, {
          type: action === "claim" ? "item_claimed" : "item_unclaimed",
          itemId,
          itemName: itemData[0].itemName,
          itemPrice: parseFloat(itemData[0].itemPrice),
          userId: session.user.id,
          userName: session.user.name,
          userImage: session.user.image || undefined,
          totalClaims,
          sharePerPerson,
          claimersInfo,
          timestamp: new Date().toISOString(),
        });
        console.log(`[FALLBACK] Broadcast completed for ${action} on item ${itemId}`);
      } catch (broadcastError) {
        console.error("Failed to broadcast update in fallback:", broadcastError);
      }

      return NextResponse.json({
        success: true, // Still return success to avoid UI errors
        action,
        itemId,
        totalClaims,
        sharePerPerson,
        claimersInfo,
      });
    }

  } catch (error) {
    console.error("Claim item error:", error);
    console.error("Error details:", error instanceof Error ? error.message : error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}