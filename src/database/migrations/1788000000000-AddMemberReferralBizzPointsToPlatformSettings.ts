import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMemberReferralBizzPointsToPlatformSettings1788000000000
  implements MigrationInterface
{
  name = 'AddMemberReferralBizzPointsToPlatformSettings1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "member_referral_bizz_points" integer NOT NULL DEFAULT 100`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN IF NOT EXISTS "member_referral_bizz_points"`,
    );
  }
}
