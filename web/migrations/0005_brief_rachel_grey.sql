CREATE TYPE "public"."subscription_plan" AS ENUM('CREDITS_1M', 'UNLIMITED_1M');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'expired', 'cancelled');--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "plan_type" SET DATA TYPE "public"."subscription_plan" USING "plan_type"::"public"."subscription_plan";--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "status" SET DEFAULT 'active'::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "subscription" ALTER COLUMN "status" SET DATA TYPE "public"."subscription_status" USING "status"::"public"."subscription_status";--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "credits_included" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription" ADD COLUMN "expired_at" timestamp with time zone;