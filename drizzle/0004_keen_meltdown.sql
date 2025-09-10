CREATE TABLE "placeholderUser" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"groupId" uuid NOT NULL,
	"name" text NOT NULL,
	"createdBy" text NOT NULL,
	"claimedBy" text,
	"claimedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receiptItem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receiptSessionId" uuid NOT NULL,
	"itemName" text NOT NULL,
	"itemPrice" numeric(12, 2) NOT NULL,
	"orderIndex" integer NOT NULL,
	"isSplitItem" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receiptItemClaim" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receiptItemId" uuid NOT NULL,
	"userId" text NOT NULL,
	"userType" text DEFAULT 'user' NOT NULL,
	"claimedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receiptSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"groupId" uuid NOT NULL,
	"createdBy" text NOT NULL,
	"merchantName" text,
	"receiptDate" timestamp,
	"subtotal" numeric(12, 2) NOT NULL,
	"taxAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tipAmount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"totalAmount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"expiresAt" timestamp DEFAULT 'NOW() + INTERVAL ''2 hours''' NOT NULL,
	"expenseId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense" DROP CONSTRAINT "expense_paidBy_user_id_fk";
--> statement-breakpoint
ALTER TABLE "expenseParticipant" DROP CONSTRAINT "expenseParticipant_userId_user_id_fk";
--> statement-breakpoint
ALTER TABLE "expense" ADD COLUMN "paidByType" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "expenseParticipant" ADD COLUMN "userType" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "placeholderUser" ADD CONSTRAINT "placeholderUser_groupId_group_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placeholderUser" ADD CONSTRAINT "placeholderUser_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "placeholderUser" ADD CONSTRAINT "placeholderUser_claimedBy_user_id_fk" FOREIGN KEY ("claimedBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiptItem" ADD CONSTRAINT "receiptItem_receiptSessionId_receiptSession_id_fk" FOREIGN KEY ("receiptSessionId") REFERENCES "public"."receiptSession"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiptItemClaim" ADD CONSTRAINT "receiptItemClaim_receiptItemId_receiptItem_id_fk" FOREIGN KEY ("receiptItemId") REFERENCES "public"."receiptItem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiptSession" ADD CONSTRAINT "receiptSession_groupId_group_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiptSession" ADD CONSTRAINT "receiptSession_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receiptSession" ADD CONSTRAINT "receiptSession_expenseId_expense_id_fk" FOREIGN KEY ("expenseId") REFERENCES "public"."expense"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "placeholder_user_group_idx" ON "placeholderUser" USING btree ("groupId");--> statement-breakpoint
CREATE INDEX "placeholder_user_claimed_by_idx" ON "placeholderUser" USING btree ("claimedBy");--> statement-breakpoint
CREATE INDEX "receipt_item_session_idx" ON "receiptItem" USING btree ("receiptSessionId");--> statement-breakpoint
CREATE INDEX "receipt_item_claim_item_idx" ON "receiptItemClaim" USING btree ("receiptItemId");--> statement-breakpoint
CREATE INDEX "receipt_item_claim_user_idx" ON "receiptItemClaim" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "receipt_session_group_idx" ON "receiptSession" USING btree ("groupId");--> statement-breakpoint
CREATE INDEX "receipt_session_status_idx" ON "receiptSession" USING btree ("status");--> statement-breakpoint
CREATE INDEX "receipt_session_expires_at_idx" ON "receiptSession" USING btree ("expiresAt");--> statement-breakpoint
ALTER TABLE "groupMember" DROP COLUMN "role";