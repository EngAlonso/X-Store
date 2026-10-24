ALTER TABLE "xstore_held_sales" ADD COLUMN "customer_phone" text;--> statement-breakpoint
ALTER TABLE "xstore_held_sales" ADD COLUMN "discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "xstore_held_sales" ADD COLUMN "payment_method" text DEFAULT 'cash' NOT NULL;--> statement-breakpoint
ALTER TABLE "xstore_held_sales" ADD COLUMN "amount_received" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "xstore_sales" ADD COLUMN "customer_name" text;