import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFeaturedBusinessRequestsAndRemoveOfferVideoUrl1788800000000 implements MigrationInterface {
  name = 'CreateFeaturedBusinessRequestsAndRemoveOfferVideoUrl1788800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop video_url from offers table
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN IF EXISTS "video_url"`);

    // 2. Create featured_business_requests_status_enum
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'featured_business_requests_status_enum') THEN
          CREATE TYPE "public"."featured_business_requests_status_enum" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
        END IF;
      END $$;
    `);

    // 3. Create featured_business_requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "featured_business_requests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "business_id" uuid NOT NULL,
        "category_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "banner_id" uuid,
        "start_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "end_date" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" "public"."featured_business_requests_status_enum" NOT NULL DEFAULT 'PENDING',
        "rejection_reason" text,
        "approved_by_id" uuid,
        "approved_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_featured_business_requests_id" PRIMARY KEY ("id")
      )
    `);

    // 4. Create Indexes
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_featured_requests_business_id" ON "featured_business_requests" ("business_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_featured_requests_category_id" ON "featured_business_requests" ("category_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_featured_requests_status" ON "featured_business_requests" ("status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_featured_requests_category_status" ON "featured_business_requests" ("category_id", "status")`);

    // 5. Add Foreign Key constraints
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_featured_requests_business_id') THEN
          ALTER TABLE "featured_business_requests"
          ADD CONSTRAINT "FK_featured_requests_business_id" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_featured_requests_category_id') THEN
          ALTER TABLE "featured_business_requests"
          ADD CONSTRAINT "FK_featured_requests_category_id" FOREIGN KEY ("category_id") REFERENCES "business_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_featured_requests_banner_id') THEN
          ALTER TABLE "featured_business_requests"
          ADD CONSTRAINT "FK_featured_requests_banner_id" FOREIGN KEY ("banner_id") REFERENCES "media_files"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_featured_requests_approved_by_id') THEN
          ALTER TABLE "featured_business_requests"
          ADD CONSTRAINT "FK_featured_requests_approved_by_id" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "featured_business_requests" DROP CONSTRAINT IF EXISTS "FK_featured_requests_approved_by_id"`);
    await queryRunner.query(`ALTER TABLE "featured_business_requests" DROP CONSTRAINT IF EXISTS "FK_featured_requests_banner_id"`);
    await queryRunner.query(`ALTER TABLE "featured_business_requests" DROP CONSTRAINT IF EXISTS "FK_featured_requests_category_id"`);
    await queryRunner.query(`ALTER TABLE "featured_business_requests" DROP CONSTRAINT IF EXISTS "FK_featured_requests_business_id"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_featured_requests_category_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_featured_requests_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_featured_requests_category_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_featured_requests_business_id"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "featured_business_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."featured_business_requests_status_enum"`);

    await queryRunner.query(`ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "video_url" character varying`);
  }
}
