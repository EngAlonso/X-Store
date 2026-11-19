ALTER TABLE "xstore_sales" ADD COLUMN "table_number" text;--> statement-breakpoint
CREATE TABLE "xstore_menus" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "public_slug" text NOT NULL,
  "title" text DEFAULT 'منيو المتجر' NOT NULL,
  "description" text,
  "is_published" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "xstore_menu_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "menu_id" uuid NOT NULL,
  "product_id" uuid NOT NULL,
  "description" text,
  "image_url" text,
  "display_order" integer DEFAULT 0 NOT NULL,
  "is_available" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "xstore_menus" ADD CONSTRAINT "xstore_menus_tenant_id_xstore_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."xstore_tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_menu_items" ADD CONSTRAINT "xstore_menu_items_menu_id_xstore_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."xstore_menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "xstore_menu_items" ADD CONSTRAINT "xstore_menu_items_product_id_xstore_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."xstore_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "xstore_menus_tenant_idx" ON "xstore_menus" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "xstore_menus_slug_idx" ON "xstore_menus" USING btree ("public_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "xstore_menu_items_menu_product_idx" ON "xstore_menu_items" USING btree ("menu_id","product_id");--> statement-breakpoint
CREATE INDEX "xstore_menu_items_menu_order_idx" ON "xstore_menu_items" USING btree ("menu_id","display_order");