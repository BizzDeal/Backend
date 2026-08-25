import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsTopToBusinessAndIsFeaturedToOffer1788100000000 implements MigrationInterface {
  name = 'AddIsTopToBusinessAndIsFeaturedToOffer1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "is_top" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "offers" DROP COLUMN IF EXISTS "is_featured"`);
    await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN IF EXISTS "is_top"`);
  }
}
