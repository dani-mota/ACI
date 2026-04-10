-- PRO-114: Add server-side response timing
-- Adds serverSideResponseTimeMs to ItemResponse (authoritative timing for fraud detection)
-- Adds questionDeliveredAt to ConversationMessage (server timestamp when item dispatched)
-- Note: ItemResponse.responseTimeMs column is NOT renamed in the database —
-- Prisma @map("responseTimeMs") remaps the TS field name to clientResponseTimeMs
-- while keeping the underlying column unchanged. Zero data loss.

ALTER TABLE "ItemResponse" ADD COLUMN "serverSideResponseTimeMs" INTEGER;

ALTER TABLE "ConversationMessage" ADD COLUMN "questionDeliveredAt" TIMESTAMP(3);
