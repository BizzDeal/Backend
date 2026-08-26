import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMemberVideosTable1788200000000 implements MigrationInterface {
  name = 'CreateMemberVideosTable1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "public"."member_videos_video_type_enum" AS ENUM('SHORT_PORTRAIT', 'LANDSCAPE', 'SQUARE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`
    );

    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "public"."member_videos_category_enum" AS ENUM('OFFER', 'BUSINESS_TOUR', 'PRODUCT_DEMO', 'TESTIMONIAL', 'GENERAL');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`
    );

    await queryRunner.query(
      `DO $$ BEGIN
        CREATE TYPE "public"."member_videos_status_enum" AS ENUM('ACTIVE', 'INACTIVE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;`
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "member_videos" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "business_id" uuid,
        "offer_id" uuid,
        "title" character varying(255) NOT NULL,
        "description" text,
        "tags" text[] NOT NULL DEFAULT '{}',
        "video_url" character varying(1000) NOT NULL,
        "thumbnail_url" character varying(1000),
        "video_type" "public"."member_videos_video_type_enum" NOT NULL DEFAULT 'LANDSCAPE',
        "category" "public"."member_videos_category_enum" NOT NULL DEFAULT 'GENERAL',
        "cta_title" character varying(100),
        "cta_url" character varying(1000),
        "status" "public"."member_videos_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "views_count" integer NOT NULL DEFAULT 0,
        "likes_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_member_videos_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_member_videos_user_id" ON "member_videos" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_member_videos_business_id" ON "member_videos" ("business_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_member_videos_offer_id" ON "member_videos" ("offer_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_member_videos_video_type" ON "member_videos" ("video_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_member_videos_category" ON "member_videos" ("category")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_member_videos_status" ON "member_videos" ("status")`);

    await queryRunner.query(`
      ALTER TABLE "member_videos"
      ADD CONSTRAINT "FK_member_videos_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "member_videos"
      ADD CONSTRAINT "FK_member_videos_business_id" FOREIGN KEY ("business_id") REFERENCES "business_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "member_videos"
      ADD CONSTRAINT "FK_member_videos_offer_id" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "member_videos" DROP CONSTRAINT IF EXISTS "FK_member_videos_offer_id"`);
    await queryRunner.query(`ALTER TABLE "member_videos" DROP CONSTRAINT IF EXISTS "FK_member_videos_business_id"`);
    await queryRunner.query(`ALTER TABLE "member_videos" DROP CONSTRAINT IF EXISTS "FK_member_videos_user_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "member_videos"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."member_videos_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."member_videos_category_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."member_videos_video_type_enum"`);
  }
}
