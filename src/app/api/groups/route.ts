import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { group, groupMember, activityLog } from "@/lib/schema";
import { headers } from "next/headers";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { validateRequestBody } from "@/lib/request-size-limit";

export async function POST(request: NextRequest) {
  // Apply rate limiting for group creation
  const rateLimitResult = await rateLimit(request, "groupWrite");
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }

  // Validate request size and parse body (64KB limit for group operations)
  const bodyValidation = await validateRequestBody(request, "group");
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

    const body = bodyValidation.body;
    const { name, description, currency } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Group name is required" },
        { status: 400 }
      );
    }

    // Validate currency
    const validCurrencies = ["USD", "GBP", "EUR", "OTHER"];
    const selectedCurrency = currency && validCurrencies.includes(currency) ? currency : "GBP";

    // Generate a unique invite code
    const inviteCode = nanoid(10);

    // Create the group
    const [newGroup] = await db
      .insert(group)
      .values({
        name: name.trim(),
        description: description?.trim() || null,
        currency: selectedCurrency,
        inviteCode,
        createdBy: session.user.id,
      })
      .returning();

    // Add the creator as a member
    await db.insert(groupMember).values({
      groupId: newGroup.id,
      userId: session.user.id,
    });

    // Log the group creation
    await db.insert(activityLog).values({
      groupId: newGroup.id,
      userId: session.user.id,
      action: "group_created",
      entityType: "group",
      entityId: newGroup.id,
      metadata: JSON.stringify({ name: newGroup.name }),
    });

    return NextResponse.json(newGroup);
  } catch (error) {
    console.error("Error creating group:", error);
    return NextResponse.json(
      { error: "Failed to create group" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Apply rate limiting for group reading
  const rateLimitResult = await rateLimit(request, "groupRead");
  if (!rateLimitResult.success && rateLimitResult.response) {
    return rateLimitResult.response;
  }
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's groups
    const userGroups = await db
      .select({
        group: group,
      })
      .from(groupMember)
      .innerJoin(group, eq(groupMember.groupId, group.id))
      .where(eq(groupMember.userId, session.user.id));

    return NextResponse.json(userGroups);
  } catch (error) {
    console.error("Error fetching groups:", error);
    return NextResponse.json(
      { error: "Failed to fetch groups" },
      { status: 500 }
    );
  }
}