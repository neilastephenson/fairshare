import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user } from "@/lib/schema";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { validateRequestBody } from "@/lib/request-size-limit";

export async function PUT(request: NextRequest) {
  // Validate request size and parse body (16KB limit for user data)
  const bodyValidation = await validateRequestBody(request, "user");
  if (!bodyValidation.success && bodyValidation.response) {
    return bodyValidation.response;
  }

  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = bodyValidation.body as { paymentInfo?: string };
    const { paymentInfo } = body;

    // Update the user's payment information
    const [updatedUser] = await db
      .update(user)
      .set({ 
        paymentInfo: paymentInfo?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.user.id))
      .returning();

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      paymentInfo: updatedUser.paymentInfo 
    });
  } catch (error) {
    console.error("Error updating payment information:", error);
    return NextResponse.json(
      { error: "Failed to update payment information" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the user's payment information
    const [userData] = await db
      .select({ paymentInfo: user.paymentInfo })
      .from(user)
      .where(eq(user.id, session.user.id));

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      paymentInfo: userData.paymentInfo || "" 
    });
  } catch (error) {
    console.error("Error fetching payment information:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment information" },
      { status: 500 }
    );
  }
}