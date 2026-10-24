CREATE TABLE "xstore_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"tenant_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_held_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cashier_user_id" uuid NOT NULL,
	"reference" text NOT NULL,
	"customer_name" text,
	"items" jsonb NOT NULL,
	"item_count" integer NOT NULL,
	"estimated_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_platform_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"support_phone" text,
	"support_whatsapp" text,
	"support_email" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"category" text NOT NULL,
	"price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"cost_price" numeric(12, 2) DEFAULT '0' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"color" text,
	"size" text,
	"part_number" text,
	"expires_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"refund_amount" numeric(12, 2) NOT NULL,
	"cost_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"unit_cost" numeric(12, 2) DEFAULT '0' NOT NULL,
	"returned_quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cashier_user_id" uuid NOT NULL,
	"invoice_no" text NOT NULL,
	"item_count" integer NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"payment_method" text NOT NULL,
	"amount_received" numeric(12, 2) NOT NULL,
	"change_amount" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_subscription_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"plan" text NOT NULL,
	"payment_method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"phone" text,
	"email" text,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_name" text NOT NULL,
	"phone" text,
	"email" text,
	"business_type" text NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"status" text DEFAULT 'trial' NOT NULL,
	"plan" text DEFAULT 'monthly' NOT NULL,
	"subscription_ends_at" date,
	"branch_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "xstore_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" text,
	"email" text,
	"phone" text,
	"password_hash" text,
	"session_version" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"tenant_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "xstore_users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "xstore_users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "xstore_audit_logs" ADD CONSTRAINT "xstore_audit_logs_actor_user_id_xstore_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."xstore_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_audit_logs" ADD CONSTRAINT "xstore_audit_logs_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_held_sales" ADD CONSTRAINT "xstore_held_sales_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_held_sales" ADD CONSTRAINT "xstore_held_sales_cashier_user_id_xstore_users_id_fk" FOREIGN KEY ("cashier_user_id") REFERENCES "public"."xstore_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_products" ADD CONSTRAINT "xstore_products_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_returns" ADD CONSTRAINT "xstore_returns_sale_id_xstore_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."xstore_sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_returns" ADD CONSTRAINT "xstore_returns_product_id_xstore_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."xstore_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_sale_items" ADD CONSTRAINT "xstore_sale_items_sale_id_xstore_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."xstore_sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_sale_items" ADD CONSTRAINT "xstore_sale_items_product_id_xstore_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."xstore_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_sales" ADD CONSTRAINT "xstore_sales_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_sales" ADD CONSTRAINT "xstore_sales_cashier_user_id_xstore_users_id_fk" FOREIGN KEY ("cashier_user_id") REFERENCES "public"."xstore_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_subscription_payments" ADD CONSTRAINT "xstore_subscription_payments_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_team_members" ADD CONSTRAINT "xstore_team_members_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_users" ADD CONSTRAINT "xstore_users_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "xstore_audit_created_idx" ON "xstore_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "xstore_held_sales_tenant_idx" ON "xstore_held_sales" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xstore_products_tenant_sku_idx" ON "xstore_products" USING btree ("tenant_id","sku");--> statement-breakpoint
CREATE INDEX "xstore_products_tenant_category_idx" ON "xstore_products" USING btree ("tenant_id","category");--> statement-breakpoint
CREATE INDEX "xstore_products_tenant_barcode_idx" ON "xstore_products" USING btree ("tenant_id","barcode");--> statement-breakpoint
CREATE INDEX "xstore_returns_sale_idx" ON "xstore_returns" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "xstore_sale_items_sale_idx" ON "xstore_sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "xstore_sale_items_product_idx" ON "xstore_sale_items" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xstore_sales_tenant_invoice_idx" ON "xstore_sales" USING btree ("tenant_id","invoice_no");--> statement-breakpoint
CREATE INDEX "xstore_sales_tenant_created_idx" ON "xstore_sales" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "xstore_subscription_payments_tenant_idx" ON "xstore_subscription_payments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "xstore_subscription_payments_created_idx" ON "xstore_subscription_payments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "xstore_team_members_tenant_phone_idx" ON "xstore_team_members" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "xstore_team_members_email_idx" ON "xstore_team_members" USING btree ("email");--> statement-breakpoint
CREATE INDEX "xstore_users_tenant_idx" ON "xstore_users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "xstore_users_email_idx" ON "xstore_users" USING btree ("email");