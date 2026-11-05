-- Cambios aditivos: no eliminan columnas ni datos.
-- Fecha de aprobación inmutable para panel y reportes; los pagos aprobados existentes conservan su fecha actual.
ALTER TABLE "payments" ADD COLUMN "approvedAt" TIMESTAMP(3);
UPDATE "payments" SET "approvedAt" = "updatedAt" WHERE "status" = 'APPROVED' AND "approvedAt" IS NULL;
CREATE INDEX "payments_status_approvedAt_orderId_idx" ON "payments"("status", "approvedAt", "orderId");

-- Conciliación con espera exponencial por pedido.
ALTER TABLE "orders" ADD COLUMN "reconcileAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "nextReconcileAt" TIMESTAMP(3);
CREATE INDEX "orders_status_stockReleased_nextReconcileAt_idx" ON "orders"("status", "stockReleased", "nextReconcileAt");

-- Búsqueda ILIKE '%texto%' del catálogo mediante trigramas.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "products_description_trgm_idx" ON "products" USING GIN ("description" gin_trgm_ops);
