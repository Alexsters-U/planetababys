-- Additive indexes for time-scoped dashboard aggregations; no business data changes.
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
CREATE INDEX "payments_status_updatedAt_orderId_idx" ON "payments"("status", "updatedAt", "orderId");
