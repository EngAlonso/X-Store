ALTER TABLE "xstore_sales" ADD COLUMN "order_type" text;--> statement-breakpoint
UPDATE "xstore_menus" AS m
SET "title" = t."name"
FROM "xstore_tenants" AS t
WHERE m."tenant_id" = t."id"
  AND (m."title" IS NULL OR btrim(m."title") = '' OR m."title" = 'منيو المتجر');