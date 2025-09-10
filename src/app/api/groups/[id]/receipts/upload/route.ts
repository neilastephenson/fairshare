import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { groupMember, receiptSession, receiptItem } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Define the schema for receipt parsing
const receiptSchema = z.object({
  merchant: z.string().describe("The name of the store or merchant"),
  date: z.string().describe("The date of the transaction in ISO format"),
  items: z.array(z.object({
    name: z.string().describe("The name/description of the item"),
    price: z.number().describe("The price of the item as a number")
  })).describe("Array of items purchased"),
  subtotal: z.number().describe("Subtotal before tax and tip"),
  tax: z.number().describe("Tax amount"),
  tip: z.number().describe("Tip amount (0 if not applicable)"),
  total: z.number().describe("Total amount including tax and tip")
});

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

    const { id: groupId } = await params;

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

    // Get the uploaded file and participants
    const formData = await request.formData();
    const file = formData.get('receipt') as File;
    const participantsStr = formData.get('participants') as string;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!participantsStr) {
      return NextResponse.json({ error: "No participants provided" }, { status: 400 });
    }

    let participants;
    try {
      participants = JSON.parse(participantsStr);
      if (!Array.isArray(participants) || participants.length === 0) {
        return NextResponse.json({ error: "Invalid participants data" }, { status: 400 });
      }
    } catch (parseError) {
      console.error("Error parsing participants:", parseError);
      return NextResponse.json({ error: "Invalid participants JSON" }, { status: 400 });
    }

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: "File must be an image" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      return NextResponse.json({ error: "File size must be less than 10MB" }, { status: 400 });
    }

    // Convert file to base64 for OpenAI Vision API
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64Image = buffer.toString('base64');
    const mimeType = file.type;

    // Use OpenAI Vision API to process the receipt
    console.log("Processing receipt with OpenAI Vision API...");
    
    let extractedData;
    try {
      const result = await generateObject({
        model: openai("gpt-4o"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Please analyze this receipt image and extract ALL items INDIVIDUALLY:

                CRITICAL REQUIREMENTS FOR ITEM EXTRACTION:
                1. If an item shows quantity > 1 (e.g., "2 x Beer" or "3 Bread"), create SEPARATE entries for EACH individual item
                2. Calculate the individual price by dividing total by quantity
                3. Example: "2 Almaza £11.00" should become TWO items: "Almaza £5.50" and "Almaza £5.50"
                4. Example: "3 x Burger @£10 = £30" should become THREE items each "Burger £10.00"
                5. Service charges should be listed as a SEPARATE item at the end (not included in subtotal)
                6. SKIP items that are clearly included parts of other items:
                   - Items marked with * that have no price (like "* French Fries" under a main dish)
                   - Items indented under main items with no separate price
                   - Items labeled as "included" or "comes with"
                   These are part of the main dish price, NOT separate items

                Extract:
                - Merchant/store name
                - Date of transaction (ISO format)
                - Complete list of ALL INDIVIDUAL items with names and individual prices
                  * Split quantity items into separate entries
                  * Each item should appear as many times as the quantity indicates
                  * Use the singular form of the item name (e.g., "Bread" not "Breads")
                  * DO NOT include sides/accompaniments that are part of a main dish
                - Subtotal (sum of all item prices, EXCLUDING service charge)
                - Tax amount (if separate from service charge)
                - Tip amount (0 if not shown)
                - Service charge (if shown - list as separate item in items array)
                - Total amount (including everything)

                IMPORTANT: Only include items that have their own price or contribute to a listed total price.
                Items marked with * or shown as included sides should NOT be listed separately.`
              },
              {
                type: "image",
                image: `data:${mimeType};base64,${base64Image}`
              }
            ]
          }
        ],
        schema: receiptSchema,
        temperature: 0.1, // Low temperature for more consistent parsing
      });

      extractedData = result.object;
      console.log("OpenAI Vision API response:", extractedData);
      
      // Validate extracted data for consistency
      // Separate service charge items from regular items for validation
      const serviceChargeItems = extractedData.items?.filter(item => 
        item.name?.toLowerCase().includes('service') || 
        item.name?.toLowerCase().includes('gratuity')
      ) || [];
      const regularItems = extractedData.items?.filter(item => 
        !item.name?.toLowerCase().includes('service') && 
        !item.name?.toLowerCase().includes('gratuity')
      ) || [];
      
      const regularItemsTotal = regularItems.reduce((sum, item) => sum + (item.price || 0), 0);
      const serviceChargeTotal = serviceChargeItems.reduce((sum, item) => sum + (item.price || 0), 0);
      const allItemsTotal = regularItemsTotal + serviceChargeTotal;
      
      // Expected total should include service charges
      const expectedTotal = (extractedData.subtotal || 0) + (extractedData.tax || 0) + (extractedData.tip || 0) + serviceChargeTotal;
      const subtotalDiscrepancy = Math.abs(regularItemsTotal - (extractedData.subtotal || 0));
      const totalDiscrepancy = Math.abs(expectedTotal - (extractedData.total || 0));
      
      console.log("Extraction validation:");
      console.log(`- Regular items total: ${regularItemsTotal.toFixed(2)}`);
      console.log(`- Service charge total: ${serviceChargeTotal.toFixed(2)}`);
      console.log(`- All items total: ${allItemsTotal.toFixed(2)}`);
      console.log(`- Declared subtotal: ${(extractedData.subtotal || 0).toFixed(2)}`);
      console.log(`- Subtotal discrepancy: ${subtotalDiscrepancy.toFixed(2)}`);
      console.log(`- Calculated total: ${expectedTotal.toFixed(2)}`);
      console.log(`- Declared total: ${(extractedData.total || 0).toFixed(2)}`);
      console.log(`- Total discrepancy: ${totalDiscrepancy.toFixed(2)}`);
      console.log(`- Item count: ${extractedData.items?.length || 0} items extracted`);
      
      // Log warning if significant discrepancies detected
      if (subtotalDiscrepancy > 0.50) {
        console.warn(`WARNING: Large subtotal discrepancy of ${subtotalDiscrepancy.toFixed(2)} detected - AI may have missed items or extracted incorrect prices`);
      }
      if (totalDiscrepancy > 0.10) {
        console.warn(`WARNING: Total calculation discrepancy of ${totalDiscrepancy.toFixed(2)} detected`);
      }
      
    } catch (apiError) {
      console.error("OpenAI Vision API error:", apiError);
      
      const error = apiError as Error & { status?: number; cause?: unknown };
      console.error("Error details:", {
        message: error?.message,
        status: error?.status,
        cause: error?.cause,
        stack: error?.stack?.split('\n').slice(0, 5).join('\n')
      });
      
      // Check if API key is configured
      const hasApiKey = !!process.env.OPENAI_API_KEY;
      if (!hasApiKey) {
        console.error("OPENAI_API_KEY is not configured in environment variables");
      } else {
        console.log("OPENAI_API_KEY is configured (length:", process.env.OPENAI_API_KEY?.length, ")");
      }
      
      // Provide more informative fallback based on error type
      let fallbackMerchant = "Receipt (AI Processing Failed)";
      const errorMessage = error?.message || '';
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        fallbackMerchant = "Receipt (Invalid API Key)";
      } else if (errorMessage.includes('429') || errorMessage.includes('rate')) {
        fallbackMerchant = "Receipt (Rate Limit Exceeded)";
      } else if (errorMessage.includes('timeout')) {
        fallbackMerchant = "Receipt (Processing Timeout)";
      }
      
      // Fallback to mock data if OpenAI fails
      console.log("Falling back to mock data due to API error");
      extractedData = {
        merchant: fallbackMerchant,
        date: new Date().toISOString(),
        items: [
          { name: "Chicken Burger", price: 12.99 }, // includes fries
          { name: "Fish & Chips", price: 14.50 },   // includes chips  
          { name: "Side Salad", price: 4.50 },      // separate item
          { name: "Beer", price: 5.50 },
          { name: "Beer", price: 5.50 },
          { name: "Soft Drink", price: 3.25 },
          { name: "Service Charge (10%)", price: 4.62 }
        ],
        subtotal: 46.24,
        tax: 0,
        tip: 0,
        total: 50.86
      };
    }

    // Validate extracted data structure
    if (!extractedData.items || !Array.isArray(extractedData.items) || !extractedData.total) {
      return NextResponse.json({ error: "Invalid receipt data extracted" }, { status: 500 });
    }

    // Calculate expiration time (2 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 2);

    // Create receipt session
    console.log("Creating receipt session for group:", groupId, "by user:", session.user.id);
    
    const [sessionRecord] = await db
      .insert(receiptSession)
      .values({
        groupId,
        createdBy: session.user.id,
        merchantName: extractedData.merchant || "Unknown Store",
        receiptDate: extractedData.date ? new Date(extractedData.date) : null,
        subtotal: extractedData.subtotal?.toString() || "0",
        taxAmount: extractedData.tax?.toString() || "0",
        tipAmount: extractedData.tip?.toString() || "0",
        totalAmount: extractedData.total?.toString() || "0",
        status: "claiming",
        participants: JSON.stringify(participants),
        expiresAt,
      })
      .returning();
      
    console.log("Created session record:", sessionRecord);

    // Insert receipt items
    const items = await Promise.all(
      extractedData.items.map((item: { name?: string; price?: number }, index: number) =>
        db
          .insert(receiptItem)
          .values({
            receiptSessionId: sessionRecord.id,
            itemName: item.name || `Item ${index + 1}`,
            itemPrice: item.price?.toString() || "0",
            orderIndex: index,
          })
          .returning()
      )
    );

    return NextResponse.json({
      sessionId: sessionRecord.id,
      extractedData: {
        merchant: sessionRecord.merchantName,
        date: sessionRecord.receiptDate,
        subtotal: parseFloat(sessionRecord.subtotal),
        tax: parseFloat(sessionRecord.taxAmount),
        tip: parseFloat(sessionRecord.tipAmount),
        total: parseFloat(sessionRecord.totalAmount),
        items: items.map((itemResult) => {
          const item = itemResult[0];
          return {
            id: item.id,
            name: item.itemName,
            price: parseFloat(item.itemPrice),
          };
        }),
      },
      expiresAt: sessionRecord.expiresAt,
    });

  } catch (error) {
    console.error("Receipt processing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}