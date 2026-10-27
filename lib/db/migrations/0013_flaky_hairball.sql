ALTER TABLE "xstore_products" ALTER COLUMN "price" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "xstore_products" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "xstore_held_sales" ADD COLUMN "sale_type" text DEFAULT 'retail' NOT NULL;--> statement-breakpoint
ALTER TABLE "xstore_products" ADD COLUMN "wholesale_price" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "xstore_sales" ADD COLUMN "sale_type" text DEFAULT 'retail' NOT NULL;--> statement-breakpoint
ALTER TABLE "xstore_tenants" ADD COLUMN "wholesale_enabled" boolean DEFAULT false NOT NULL;