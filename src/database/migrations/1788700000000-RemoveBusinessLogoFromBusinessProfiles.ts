import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveBusinessLogoFromBusinessProfiles1788700000000 implements MigrationInterface {
  name = 'RemoveBusinessLogoFromBusinessProfiles1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN IF EXISTS "logo_id" CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "logo_id" uuid`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_business_profiles_logo_id') THEN
          ALTER TABLE "business_profiles" ADD CONSTRAINT "FK_business_profiles_logo_id" FOREIGN KEY ("logo_id") REFERENCES "media_files"("id") ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }
}
