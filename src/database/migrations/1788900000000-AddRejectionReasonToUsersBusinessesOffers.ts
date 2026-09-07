import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRejectionReasonToUsersBusinessesOffers1788900000000 implements MigrationInterface {
  name = 'AddRejectionReasonToUsersBusinessesOffers1788900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rejection_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_profiles" ADD COLUMN IF NOT EXISTS "rejection_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "offers" ADD COLUMN IF NOT EXISTS "rejection_reason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "offers" DROP COLUMN IF EXISTS "rejection_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "business_profiles" DROP COLUMN IF EXISTS "rejection_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "rejection_reason"`,
    );
  }
}
