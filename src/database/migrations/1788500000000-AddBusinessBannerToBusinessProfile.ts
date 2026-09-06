import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBusinessBannerToBusinessProfile1788500000000 implements MigrationInterface {
  name = 'AddBusinessBannerToBusinessProfile1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."media_files_purpose_enum" ADD VALUE IF NOT EXISTS 'BUSINESS_BANNER'`);
    await queryRunner.query(`ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "banner_id" uuid`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_business_profiles_banner_id') THEN
          ALTER TABLE "business_profiles" ADD CONSTRAINT "FK_business_profiles_banner_id" FOREIGN KEY ("banner_id") REFERENCES "media_files"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "business_profiles" DROP CONSTRAINT IF EXISTS "FK_business_profiles_banner_id"`);
    await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN IF EXISTS "banner_id"`);
  }
}
