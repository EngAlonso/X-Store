ALTER TABLE "xstore_sale_items" DROP CONSTRAINT "xstore_sale_items_product_id_xstore_products_id_fk";
--> statement-breakpoint
ALTER TABLE "xstore_sale_items" ALTER COLUMN "product_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "xstore_sale_items" ADD CONSTRAINT "xstore_sale_items_product_id_xstore_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."xstore_products"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "xstore_returns" DROP CONSTRAINT "xstore_returns_product_id_xstore_products_id_fk";
--> statement-breakpoint
ALTER TABLE "xstore_returns" ALTER COLUMN "product_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "xstore_returns" ADD CONSTRAINT "xstore_returns_product_id_xstore_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."xstore_products"("id") ON DELETE set null ON UPDATE no action;
