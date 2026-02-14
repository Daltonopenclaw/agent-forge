ALTER TABLE "tenants" ALTER COLUMN "database_url" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "database_url" DROP NOT NULL;