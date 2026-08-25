import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerSignupBizzPointsToPlatformSettings1787800000000
  implements MigrationInterface
{
  name = 'AddCustomerSignupBizzPointsToPlatformSettings1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "customer_signup_bizz_points" integer NOT NULL DEFAULT 100`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN IF NOT EXISTS "customer_signup_bizz_points"`,
    );
  }
}
