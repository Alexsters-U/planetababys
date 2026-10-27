CREATE TYPE "store_sale_status" AS ENUM ('COMPLETED', 'VOIDED');
CREATE TYPE "store_sale_payment_method" AS ENUM ('CASH', 'TRANSFER');

CREATE TABLE "store_sales" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reference" TEXT NOT NULL,
  "status" "store_sale_status" NOT NULL DEFAULT 'COMPLETED',
  "paymentMethod" "store_sale_payment_method" NOT NULL,
  "totalCents" INTEGER NOT NULL,
  "cashReceivedCents" INTEGER,
  "cashChangeCents" INTEGER,
  "paymentReference" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "saleKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "recordedById" TEXT NOT NULL REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "voidedById" TEXT REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "store_sales_total_positive" CHECK ("totalCents" > 0),
  CONSTRAINT "store_sales_cash_consistent" CHECK (
    ("paymentMethod" = 'CASH' AND "cashReceivedCents" IS NOT NULL AND "cashChangeCents" IS NOT NULL
      AND "cashReceivedCents" >= "totalCents" AND "cashChangeCents" = "cashReceivedCents" - "totalCents" AND "paymentReference" IS NULL)
    OR ("paymentMethod" = 'TRANSFER' AND "cashReceivedCents" IS NULL AND "cashChangeCents" IS NULL)
  ),
  CONSTRAINT "store_sales_void_consistent" CHECK (
    ("status" = 'COMPLETED' AND "voidedAt" IS NULL AND "voidedById" IS NULL AND "voidReason" IS NULL)
    OR ("status" = 'VOIDED' AND "voidedAt" IS NOT NULL AND "voidedById" IS NOT NULL AND "voidReason" IS NOT NULL AND length("voidReason") >= 5)
  )
);
CREATE UNIQUE INDEX "store_sales_reference_key" ON "store_sales"("reference");
CREATE UNIQUE INDEX "store_sales_saleKey_key" ON "store_sales"("saleKey");
CREATE INDEX "store_sales_status_createdAt_id_idx" ON "store_sales"("status", "createdAt", "id");
CREATE INDEX "store_sales_paymentMethod_createdAt_idx" ON "store_sales"("paymentMethod", "createdAt");

CREATE TABLE "store_sale_items" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "saleId" TEXT NOT NULL REFERENCES "store_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "productId" TEXT NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "unitCents" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "imageUrl" TEXT,
  CONSTRAINT "store_sale_items_quantity_positive" CHECK ("quantity" > 0),
  CONSTRAINT "store_sale_items_price_positive" CHECK ("unitCents" > 0)
);
CREATE INDEX "store_sale_items_saleId_idx" ON "store_sale_items"("saleId");
CREATE INDEX "store_sale_items_productId_idx" ON "store_sale_items"("productId");
