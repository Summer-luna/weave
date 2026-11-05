CREATE TABLE "block_refs" (
	"block_id" text NOT NULL,
	"ref_id" text NOT NULL,
	CONSTRAINT "block_refs_block_id_ref_id_pk" PRIMARY KEY("block_id","ref_id")
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"parent_id" text,
	"position" integer NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"open" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_links" (
	"block_id" text NOT NULL,
	"page_id" text NOT NULL,
	CONSTRAINT "page_links_block_id_page_id_pk" PRIMARY KEY("block_id","page_id")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"title_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_title_key_unique" UNIQUE("title_key")
);
--> statement-breakpoint
ALTER TABLE "block_refs" ADD CONSTRAINT "block_refs_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_parent_id_blocks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_block_id_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "block_refs_ref_idx" ON "block_refs" USING btree ("ref_id");--> statement-breakpoint
CREATE INDEX "blocks_page_parent_idx" ON "blocks" USING btree ("page_id","parent_id","position");--> statement-breakpoint
CREATE INDEX "blocks_parent_idx" ON "blocks" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "page_links_page_idx" ON "page_links" USING btree ("page_id");