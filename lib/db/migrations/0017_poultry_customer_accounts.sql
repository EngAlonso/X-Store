ALTER TABLE "xstore_tenants" DROP CONSTRAINT IF EXISTS "xstore_tenants_store_type_check";--> statement-breakpoint
CREATE TABLE "xstore_customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "shop_name" text,
  "shop_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "xstore_poultry_invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "cashier_user_id" uuid NOT NULL,
  "invoice_no" text NOT NULL,
  "total" numeric(12,2) NOT NULL,
  "amount_paid" numeric(12,2) DEFAULT '0' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "xstore_poultry_invoice_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "invoice_id" uuid NOT NULL,
  "product_name" text NOT NULL,
  "quantity_kg" numeric(12,3) NOT NULL,
  "unit_price" numeric(12,2) NOT NULL,
  "total" numeric(12,2) NOT NULL
);--> statement-breakpoint
CREATE TABLE "xstore_poultry_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "customer_id" uuid NOT NULL,
  "cashier_user_id" uuid NOT NULL,
  "amount" numeric(12,2) NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "xstore_customers" ADD CONSTRAINT "xstore_customers_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_poultry_invoices" ADD CONSTRAINT "xstore_poultry_invoices_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_poultry_invoices" ADD CONSTRAINT "xstore_poultry_invoices_customer_id_xstore_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."xstore_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_poultry_invoices" ADD CONSTRAINT "xstore_poultry_invoices_cashier_user_id_xstore_users_id_fk" FOREIGN KEY ("cashier_user_id") REFERENCES "public"."xstore_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_poultry_invoice_items" ADD CONSTRAINT "xstore_poultry_invoice_items_invoice_id_xstore_poultry_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."xstore_poultry_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_poultry_payments" ADD CONSTRAINT "xstore_poultry_payments_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_poultry_payments" ADD CONSTRAINT "xstore_poultry_payments_customer_id_xstore_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."xstore_customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_poultry_payments" ADD CONSTRAINT "xstore_poultry_payments_cashier_user_id_xstore_users_id_fk" FOREIGN KEY ("cashier_user_id") REFERENCES "public"."xstore_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "xstore_customers_tenant_idx" ON "xstore_customers" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "xstore_customers_tenant_phone_idx" ON "xstore_customers" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "xstore_customers_tenant_name_idx" ON "xstore_customers" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "xstore_poultry_invoices_tenant_invoice_idx" ON "xstore_poultry_invoices" USING btree ("tenant_id","invoice_no");--> statement-breakpoint
CREATE INDEX "xstore_poultry_invoices_customer_created_idx" ON "xstore_poultry_invoices" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "xstore_poultry_invoice_items_invoice_idx" ON "xstore_poultry_invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "xstore_poultry_payments_customer_created_idx" ON "xstore_poultry_payments" USING btree ("customer_id","created_at");