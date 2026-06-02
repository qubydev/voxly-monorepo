CREATE TABLE "subscription" (
	"user_id" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"is_unlimited" boolean DEFAULT false NOT NULL,
	"plan_type" varchar(20) DEFAULT 'NONE' NOT NULL,
	"cycle_ends_at" timestamp NOT NULL,
	"subscription_ends_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;