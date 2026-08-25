import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCustomerRedemptionRewardBizzPointsToPlatformSettings1787900000000
  implements MigrationInterface
{
  name = 'AddCustomerRedemptionRewardBizzPointsToPlatformSettings1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "customer_redemption_reward_bizz_points" integer NOT NULL DEFAULT 75`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN IF NOT EXISTS "customer_redemption_reward_bizz_points"`,
    );
  }
}
