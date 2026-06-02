ALTER TABLE "subscription" ALTER COLUMN "plan_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "credits_remaining" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "current_period_start" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "current_period_end" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "granted_by" text;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "subscription_active_expiry_idx" ON "subscription" USING btree ("status","current_period_end");--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "balance";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "is_unlimited";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "cycle_ends_at";--> statement-breakpoint
ALTER TABLE "subscription" DROP COLUMN "subscription_ends_at";