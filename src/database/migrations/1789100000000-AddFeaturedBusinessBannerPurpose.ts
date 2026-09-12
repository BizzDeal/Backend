import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFeaturedBusinessBannerPurpose1789100000000 implements MigrationInterface {
  name = 'AddFeaturedBusinessBannerPurpose1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."media_files_purpose_enum" ADD VALUE IF NOT EXISTS 'FEATURED_BUSINESS_BANNER'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing values from an enum type directly
  }
}
