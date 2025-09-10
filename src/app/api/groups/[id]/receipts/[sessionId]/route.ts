import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, receiptSession, receiptItem, receiptItemClaim, user, placeholderUser } from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";

interface RouteParams {
  params: Promise<{ id: string; sessionId: string }>;
}

export async function GET(
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
    
    // Debug logging
    console.log("Receipt GET request:", { groupId, sessionId, userId: session.user.id });

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

    // Get receipt session
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

    console.log("Session query result:", sessionData);

    if (sessionData.length === 0) {
      console.log("Receipt session not found for:", { sessionId, groupId });
      return NextResponse.json({ error: "Receipt session not found" }, { status: 404 });
    }

    const receiptSessionData = sessionData[0];

    // Check if session has expired
    if (new Date() > receiptSessionData.expiresAt) {
      return NextResponse.json({ error: "Receipt session has expired" }, { status: 410 });
    }

    // Get receipt items first
    console.log("About to query receipt items for sessionId:", sessionId);
    const receiptItems = await db
      .select()
      .from(receiptItem)
      .where(eq(receiptItem.receiptSessionId, sessionId))
      .orderBy(receiptItem.orderIndex);

    console.log("Found receipt items:", receiptItems.length);

    // Get all claims for these items
    const itemIds = receiptItems.map(item => item.id);
    console.log("Looking for claims for item IDs:", itemIds);
    
    let allClaims: Array<{
      receiptItemId: string;
      userId: string;
      userType: string;
      claimedAt: Date;
    }> = [];
    
    if (itemIds.length > 0) {
      try {
        allClaims = await db
          .select({
            receiptItemId: receiptItemClaim.receiptItemId,
            userId: receiptItemClaim.userId,
            userType: receiptItemClaim.userType,
            claimedAt: receiptItemClaim.claimedAt,
          })
          .from(receiptItemClaim)
          .where(inArray(receiptItemClaim.receiptItemId, itemIds));
        
        console.log("Successfully fetched claims:", allClaims.length);
      } catch (claimsError) {
        console.error("Error fetching claims (using empty array):", claimsError);
        allClaims = [];
      }
    }

    console.log("Found claims:", allClaims.length);

    // Get user data for claims
    const userIds = allClaims.filter(c => c.userType === "user").map(c => c.userId);
    const placeholderIds = allClaims.filter(c => c.userType === "placeholder").map(c => c.userId);
    
    let users: Array<{
      id: string;
      name: string;
      email: string | null;
      image: string | null;
    }> = [];
    let placeholders: Array<{
      id: string;
      name: string;
    }> = [];
    
    try {
      if (userIds.length > 0) {
        users = await db
          .select()
          .from(user)
          .where(inArray(user.id, userIds));
      }
      
      if (placeholderIds.length > 0) {
        placeholders = await db
          .select()
          .from(placeholderUser)
          .where(inArray(placeholderUser.id, placeholderIds));
      }
    } catch (userError) {
      console.error("Error fetching user data:", userError);
    }

    // Create user lookup maps
    const userMap = new Map(users.map(u => [u.id, u]));
    const placeholderMap = new Map(placeholders.map(p => [p.id, p]));

    // Group claims by item ID with user data
    const claimsByItemId = new Map();
    allClaims.forEach(claim => {
      const itemId = claim.receiptItemId;
      if (!claimsByItemId.has(itemId)) {
        claimsByItemId.set(itemId, []);
      }
      
      let userData = null;
      if (claim.userType === "user") {
        const user = userMap.get(claim.userId);
        if (user) {
          userData = {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
            isPlaceholder: false,
          };
        }
      } else if (claim.userType === "placeholder") {
        const placeholder = placeholderMap.get(claim.userId);
        if (placeholder) {
          userData = {
            id: placeholder.id,
            name: placeholder.name,
            email: null,
            image: null,
            isPlaceholder: true,
          };
        }
      }
      
      // Fallback user data
      if (!userData) {
        userData = {
          id: claim.userId,
          name: claim.userType === "user" ? "User" : "Someone",
          email: null,
          image: null,
          isPlaceholder: claim.userType === "placeholder",
        };
      }
      
      const claimData = {
        userId: claim.userId,
        userType: claim.userType,
        claimedAt: claim.claimedAt,
        user: userData,
      };
      
      claimsByItemId.get(itemId).push(claimData);
    });

    // Convert to expected format with claims
    const items = receiptItems.map(item => ({
      id: item.id,
      name: item.itemName,
      price: parseFloat(item.itemPrice),
      orderIndex: item.orderIndex,
      isSplitItem: item.isSplitItem,
      claims: claimsByItemId.get(item.id) || [],
    }));

    // Parse participants if available
    let sessionParticipants = [];
    if (receiptSessionData.participants) {
      try {
        sessionParticipants = JSON.parse(receiptSessionData.participants);
      } catch (error) {
        console.error("Error parsing session participants:", error);
      }
    }

    return NextResponse.json({
      session: {
        id: receiptSessionData.id,
        merchantName: receiptSessionData.merchantName,
        receiptDate: receiptSessionData.receiptDate,
        subtotal: parseFloat(receiptSessionData.subtotal),
        tax: parseFloat(receiptSessionData.taxAmount),
        tip: parseFloat(receiptSessionData.tipAmount),
        total: parseFloat(receiptSessionData.totalAmount),
        status: receiptSessionData.status,
        participants: sessionParticipants,
        expiresAt: receiptSessionData.expiresAt,
        createdAt: receiptSessionData.createdAt,
      },
      items,
    });

  } catch (error) {
    console.error("Get receipt session error:", error);
    console.error("Error details:", error instanceof Error ? error.message : error);
    console.error("Stack trace:", error instanceof Error ? error.stack : "No stack trace");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}