CREATE TABLE "trash" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"page_title" text NOT NULL,
	"payload" jsonb NOT NULL,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "trash_deleted_idx" ON "trash" USING btree ("deleted_at");