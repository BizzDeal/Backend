import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeaturedBusinessBannerPurpose1789100000000 implements MigrationInterface {
  name = 'AddFeaturedBusinessBannerPurpose1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."media_files_purpose_enum" ADD VALUE IF NOT EXISTS 'FEATURED_BUSINESS_BANNER'`);
    await queryRunner.query(`
      UPDATE "media_files"
      SET "purpose" = 'FEATURED_BUSINESS_BANNER'
      WHERE "id" IN (
        SELECT "banner_id" FROM "featured_business_requests" WHERE "banner_id" IS NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "media_files"
      SET "purpose" = 'BUSINESS_BANNER'
      WHERE "purpose" = 'FEATURED_BUSINESS_BANNER'
    `);
  }
}
