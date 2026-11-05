CREATE TABLE "ai_settings" (
	"provider" text PRIMARY KEY NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"api_key" text DEFAULT '' NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
