CREATE TABLE "shipping_quotes" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "requestKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "request" JSONB NOT NULL,
  "lines" JSONB NOT NULL,
  "subtotalCents" INTEGER NOT NULL,
  "shippingCents" INTEGER,
  "deliveryEstimate" TEXT,
  "policyVersion" TEXT NOT NULL,
  "consentAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "shipping_quotes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shipping_quotes_cost_check" CHECK ("shippingCents" IS NULL OR "shippingCents" BETWEEN 0 AND 100000000),
  CONSTRAINT "shipping_quotes_status_check" CHECK ("status" IN ('REQUESTED', 'QUOTED', 'CONSUMED', 'DECLINED'))
);
CREATE UNIQUE INDEX "shipping_quotes_reference_key" ON "shipping_quotes"("reference");
CREATE UNIQUE INDEX "shipping_quotes_requestKey_key" ON "shipping_quotes"("requestKey");
CREATE INDEX "shipping_quotes_status_createdAt_id_idx" ON "shipping_quotes"("status", "createdAt", "id");
ALTER TABLE "orders" ADD COLUMN "shippingQuoteId" TEXT;
CREATE UNIQUE INDEX "orders_shippingQuoteId_key" ON "orders"("shippingQuoteId");
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingQuoteId_fkey" FOREIGN KEY ("shippingQuoteId") REFERENCES "shipping_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ALTER COLUMN "policyVersion" SET DEFAULT '2026-10-08';
