BEGIN;
ALTER TABLE "products"
  ADD COLUMN "promotionEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "promotionPriceCents" INTEGER,
  ADD COLUMN "promotionStartsAt" TIMESTAMP(3),
  ADD COLUMN "promotionEndsAt" TIMESTAMP(3);
ALTER TABLE "products" ADD CONSTRAINT "products_promotion_price_valid"
  CHECK ("promotionPriceCents" IS NULL OR ("promotionPriceCents" >= 100 AND "promotionPriceCents" < "priceCents"));
ALTER TABLE "products" ADD CONSTRAINT "products_promotion_window_valid"
  CHECK ("promotionStartsAt" IS NULL OR ("promotionEndsAt" IS NOT NULL AND "promotionStartsAt" < "promotionEndsAt"));
ALTER TABLE "products" ADD CONSTRAINT "products_enabled_promotion_complete"
  CHECK (NOT "promotionEnabled" OR ("promotionPriceCents" IS NOT NULL AND "promotionEndsAt" IS NOT NULL));
CREATE INDEX "products_isActive_promotionEnabled_promotionEndsAt_idx"
  ON "products"("isActive", "promotionEnabled", "promotionEndsAt");
COMMIT;
