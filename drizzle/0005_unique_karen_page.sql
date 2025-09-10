ALTER TABLE "receiptSession" ALTER COLUMN "expiresAt" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "groupMember" ADD COLUMN "role" text DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "receiptSession" ADD COLUMN "participants" text;