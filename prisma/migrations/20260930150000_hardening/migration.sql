ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'PACKED';
ALTER TYPE "order_status" ADD VALUE IF NOT EXISTS 'SHIPPED';
ALTER TABLE "orders"
 ADD COLUMN "consentAt" TIMESTAMP(3),
 ADD COLUMN "policyVersion" TEXT NOT NULL DEFAULT '2026-09-30',
 ADD COLUMN "checkoutKey" TEXT,
 ADD COLUMN "checkoutHash" TEXT,
 ADD COLUMN "shippingCents" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "stockReleased" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "expiresAt" TIMESTAMP(3),
 ADD COLUMN "reviewRequired" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "orders_checkoutKey_key" ON "orders"("checkoutKey");
CREATE INDEX "orders_expiry_idx" ON "orders"("status","expiresAt");
ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "products_price_positive" CHECK ("priceCents" > 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_positive" CHECK ("totalCents" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "items_quantity_positive" CHECK ("quantity" > 0);
