import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { 
  groupMember, 
  receiptSession, 
  receiptItem, 
  receiptItemClaim, 
  expense, 
  expenseParticipant 
} from "@/lib/schema";
import { eq, and, inArray } from "drizzle-orm";

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

    if (sessionData.length === 0) {
      return NextResponse.json({ error: "Receipt session not found" }, { status: 404 });
    }

    const receiptSessionData = sessionData[0];

    // For reopened sessions, check if user has permission to close it
    const isUpdate = !!receiptSessionData.expenseId;
    if (isUpdate || receiptSessionData.status === "completed") {
      // Parse participants to check session controller
      let sessionController = null;
      if (receiptSessionData.participants) {
        try {
          const participantsData = JSON.parse(receiptSessionData.participants);
          sessionController = participantsData._sessionController;
        } catch (e) {
          console.error("Error parsing participants:", e);
        }
      }
      
      // Check authorization: original admin or person who reopened it
      const isOriginalAdmin = receiptSessionData.createdBy === session.user.id;
      const isSessionController = sessionController?.userId === session.user.id;
      
      if (!isOriginalAdmin && !isSessionController) {
        return NextResponse.json({ 
          error: "Only the session admin or the person who re-opened this session can finalize it" 
        }, { status: 403 });
      }
    }

    // Check if session has expired
    if (new Date() > receiptSessionData.expiresAt) {
      return NextResponse.json({ error: "Receipt session has expired" }, { status: 410 });
    }

    // Parse participants
    let participants: Array<{
      id: string;
      name: string;
      image: string | null;
      type: "user" | "placeholder";
    }> = [];
    if (receiptSessionData.participants) {
      try {
        participants = JSON.parse(receiptSessionData.participants);
      } catch (error) {
        console.error("Error parsing participants:", error);
        return NextResponse.json({ error: "Invalid participants data" }, { status: 500 });
      }
    }

    if (participants.length === 0) {
      return NextResponse.json({ error: "No participants found" }, { status: 400 });
    }
    
    console.log("Participants in expense creation:", participants.map(p => ({ id: p.id, name: p.name, type: p.type })));

    // Get all receipt items
    const receiptItems = await db
      .select()
      .from(receiptItem)
      .where(eq(receiptItem.receiptSessionId, sessionId))
      .orderBy(receiptItem.orderIndex);

    // Get all claims
    const itemIds = receiptItems.map(item => item.id);
    let allClaims: Array<{
      receiptItemId: string;
      userId: string;
      userType: string;
    }> = [];
    if (itemIds.length > 0) {
      allClaims = await db
        .select({
          receiptItemId: receiptItemClaim.receiptItemId,
          userId: receiptItemClaim.userId,
          userType: receiptItemClaim.userType,
        })
        .from(receiptItemClaim)
        .where(inArray(receiptItemClaim.receiptItemId, itemIds));
    }

    // Group claims by item ID
    const claimsByItemId = new Map();
    allClaims.forEach(claim => {
      const itemId = claim.receiptItemId;
      if (!claimsByItemId.has(itemId)) {
        claimsByItemId.set(itemId, []);
      }
      claimsByItemId.get(itemId).push(claim);
    });

    // Calculate participant shares
    const participantShares = new Map();
    participants.forEach(participant => {
      participantShares.set(participant.id, 0);
    });

    // Add up claimed items
    console.log(`Processing ${receiptItems.length} receipt items:`);
    let totalItemsPriceCheck = 0;
    
    receiptItems.forEach(item => {
      const claims = claimsByItemId.get(item.id) || [];
      const itemPrice = parseFloat(item.itemPrice);
      totalItemsPriceCheck += itemPrice;
      
      console.log(`Item: ${item.itemName} - £${itemPrice} - Claims: ${claims.length}`);

      if (claims.length > 0) {
        // Item was claimed - split among claimers
        const sharePerClaimer = itemPrice / claims.length;
        console.log(`  -> Claimed by ${claims.length} people, £${sharePerClaimer.toFixed(2)} each`);
        claims.forEach((claim: { userId: string; userType: string; receiptItemId: string }) => {
          const currentShare = participantShares.get(claim.userId) || 0;
          participantShares.set(claim.userId, currentShare + sharePerClaimer);
        });
      } else {
        // Item was unclaimed - split among all participants
        const sharePerParticipant = itemPrice / participants.length;
        console.log(`  -> Unclaimed, splitting £${sharePerParticipant.toFixed(2)} among ${participants.length} people`);
        participants.forEach(participant => {
          const currentShare = participantShares.get(participant.id) || 0;
          participantShares.set(participant.id, currentShare + sharePerParticipant);
        });
      }
    });
    
    // Reconciliation logic to handle discrepancies between items and subtotal
    const subtotal = parseFloat(receiptSessionData.subtotal);
    const tax = parseFloat(receiptSessionData.taxAmount);
    const tip = parseFloat(receiptSessionData.tipAmount);
    const receiptTotal = parseFloat(receiptSessionData.totalAmount);
    const itemsDiscrepancy = subtotal - totalItemsPriceCheck;
    
    console.log(`Total of all item prices: £${totalItemsPriceCheck.toFixed(2)}`);
    console.log(`Expected subtotal: £${subtotal}`);
    console.log(`Discrepancy: £${itemsDiscrepancy.toFixed(2)}`);
    console.log("Receipt totals:", { subtotal, tax, tip, total: receiptTotal });
    
    // If there's a significant discrepancy, distribute it proportionally
    if (Math.abs(itemsDiscrepancy) > 0.01) {
      console.log(`Applying reconciliation adjustment of £${itemsDiscrepancy.toFixed(2)}`);
      
      // Calculate total base shares before adjustment
      const totalBaseShares = Array.from(participantShares.values()).reduce((sum, share) => sum + share, 0);
      
      if (totalBaseShares > 0) {
        // Apply proportional adjustment to each participant
        participants.forEach(participant => {
          const baseShare = participantShares.get(participant.id) || 0;
          const proportion = baseShare / totalBaseShares;
          const adjustment = itemsDiscrepancy * proportion;
          participantShares.set(participant.id, baseShare + adjustment);
          
          if (adjustment !== 0) {
            console.log(`Participant ${participant.name}: adjustment=${adjustment.toFixed(2)}`);
          }
        });
      }
    }
    
    console.log("Participant base shares after reconciliation:", Array.from(participantShares.entries()));
    
    // Add proportional tax and tip to each participant  
    participants.forEach(participant => {
      const baseShare = participantShares.get(participant.id) || 0;
      const taxTipMultiplier = subtotal > 0 ? (tax + tip) / subtotal : 0;
      const additionalTaxTip = baseShare * taxTipMultiplier;
      const finalShare = baseShare + additionalTaxTip;
      participantShares.set(participant.id, finalShare);
      
      console.log(`Participant ${participant.name}: base=${baseShare.toFixed(2)}, taxTip=${additionalTaxTip.toFixed(2)}, final=${finalShare.toFixed(2)}`);
    });
    
    const totalCalculatedShares = Array.from(participantShares.values()).reduce((sum, share) => sum + share, 0);
    console.log("Total calculated shares:", totalCalculatedShares.toFixed(2));
    console.log("Expected total:", receiptTotal);
    
    // Final validation - if still significantly off, apply a final adjustment
    const finalDiscrepancy = receiptTotal - totalCalculatedShares;
    if (Math.abs(finalDiscrepancy) > 0.01) {
      console.log(`Final adjustment needed: £${finalDiscrepancy.toFixed(2)}`);
      
      // Apply the adjustment to the person who paid (they're most likely to accept small discrepancies)
      const currentPaidByShare = participantShares.get(session.user.id) || 0;
      participantShares.set(session.user.id, currentPaidByShare + finalDiscrepancy);
      
      console.log(`Applied final adjustment of £${finalDiscrepancy.toFixed(2)} to payer: ${session.user.id}`);
    }

    // Create a more descriptive expense description
    const merchantName = receiptSessionData.merchantName || "Receipt";
    const receiptDate = receiptSessionData.receiptDate ? new Date(receiptSessionData.receiptDate) : new Date();
    const dateStr = receiptDate.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short'
    });
    const timeStr = new Date().toLocaleTimeString('en-GB', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
    
    // Create a unique description that includes merchant, date, and time for better identification
    const expenseDescription = `${merchantName} (${dateStr} ${timeStr})`;
    
    console.log(`Processing expense with description: "${expenseDescription}"`);

    let expenseRecord;
    
    if (isUpdate) {
      // Update existing expense
      console.log(`Updating existing expense: ${receiptSessionData.expenseId}`);
      [expenseRecord] = await db
        .update(expense)
        .set({
          paidBy: session.user.id,
          paidByType: "user",
          description: expenseDescription,
          amount: receiptSessionData.totalAmount,
          category: null,
          date: receiptSessionData.receiptDate || new Date(),
          updatedAt: new Date(),
        })
        .where(eq(expense.id, receiptSessionData.expenseId!))
        .returning();
        
      // Delete existing expense participants before recreating them
      await db
        .delete(expenseParticipant)
        .where(eq(expenseParticipant.expenseId, receiptSessionData.expenseId!));
    } else {
      // Create new expense
      console.log(`Creating new expense`);
      [expenseRecord] = await db
        .insert(expense)
        .values({
          groupId,
          paidBy: session.user.id,
          paidByType: "user",
          description: expenseDescription,
          amount: receiptSessionData.totalAmount,
          category: null,
          date: receiptSessionData.receiptDate || new Date(),
        })
        .returning();
    }

    // Create expense participants with proper rounding to ensure total matches
    const expenseParticipants = [];
    let runningTotal = 0;
    
    // Filter to only participants with shares and sort
    const participantsWithShares = participants
      .filter(p => {
        const share = participantShares.get(p.id) || 0;
        return share > 0.001; // Only include if share is meaningful
      })
      .sort((a, b) => {
        // Sort so the payer is last (they'll absorb any rounding difference)
        if (a.id === session.user.id) return 1;
        if (b.id === session.user.id) return -1;
        return 0;
      });
    
    for (let i = 0; i < participantsWithShares.length; i++) {
      const participant = participantsWithShares[i];
      const shareAmount = participantShares.get(participant.id) || 0;
      
      let roundedAmount: string;
      
      if (i === participantsWithShares.length - 1) {
        // Last participant (payer) gets the exact remainder to ensure total matches
        const remainder = receiptTotal - runningTotal;
        roundedAmount = remainder.toFixed(2);
        console.log(`Final participant ${participant.name} gets remainder: ${roundedAmount} (calculated: ${shareAmount.toFixed(2)})`);
      } else {
        // Other participants get their calculated share rounded to 2 decimal places
        roundedAmount = shareAmount.toFixed(2);
        runningTotal += parseFloat(roundedAmount);
      }
      
      expenseParticipants.push({
        expenseId: expenseRecord.id,
        userId: participant.id,
        userType: participant.type,
        shareAmount: roundedAmount,
      });
    }
    
    // Log final validation
    const finalTotal = expenseParticipants.reduce((sum, p) => sum + parseFloat(p.shareAmount), 0);
    console.log(`Final expense participants total: ${finalTotal.toFixed(2)}, Expected: ${receiptTotal}`);
    if (Math.abs(finalTotal - receiptTotal) > 0.001) {
      console.error(`WARNING: Final total mismatch! Got ${finalTotal}, expected ${receiptTotal}`);
    }

    if (expenseParticipants.length > 0) {
      await db
        .insert(expenseParticipant)
        .values(expenseParticipants);
    }

    // Update receipt session to mark as completed and link to expense
    await db
      .update(receiptSession)
      .set({
        status: "completed",
        expenseId: expenseRecord.id,
        updatedAt: new Date(),
      })
      .where(eq(receiptSession.id, sessionId));

    return NextResponse.json({
      success: true,
      expenseId: expenseRecord.id,
      message: isUpdate ? "Expense updated successfully from receipt!" : "Expense created successfully from receipt!",
    });

  } catch (error) {
    console.error("Create expense error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}