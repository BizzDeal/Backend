import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeaturedBannerToBusinessProfiles1789200000000 implements MigrationInterface {
  name = 'AddFeaturedBannerToBusinessProfiles1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "featured_banner_id" uuid`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_business_profiles_featured_banner_id') THEN
          ALTER TABLE "business_profiles" ADD CONSTRAINT "FK_business_profiles_featured_banner_id" 
          FOREIGN KEY ("featured_banner_id") REFERENCES "media_files"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Backfill: If any business has an approved featured request, assign its featured_banner_id
    await queryRunner.query(`
      UPDATE "business_profiles" b
      SET "featured_banner_id" = req."banner_id",
          "is_featured" = true
      FROM (
        SELECT DISTINCT ON ("business_id") "business_id", "banner_id"
        FROM "featured_business_requests"
        WHERE "status" = 'APPROVED'
          AND "banner_id" IS NOT NULL
        ORDER BY "business_id", "created_at" DESC
      ) req
      WHERE b."id" = req."business_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "business_profiles" DROP CONSTRAINT IF EXISTS "FK_business_profiles_featured_banner_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_profiles" DROP COLUMN IF EXISTS "featured_banner_id"`,
    );
  }
}
