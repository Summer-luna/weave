CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocks_content_trgm_idx" ON "blocks" USING gin ("content" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pages_title_trgm_idx" ON "pages" USING gin ("title" gin_trgm_ops);
