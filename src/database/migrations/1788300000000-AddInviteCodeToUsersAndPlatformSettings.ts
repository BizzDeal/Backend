import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInviteCodeToUsersAndPlatformSettings1788300000000
  implements MigrationInterface
{
  name = 'AddInviteCodeToUsersAndPlatformSettings1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_code" varchar(20) UNIQUE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_invite_code" ON "users" ("invite_code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "app_share_sharer_bizz_points" integer NOT NULL DEFAULT 50`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "app_share_joiner_bizz_points" integer NOT NULL DEFAULT 50`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "app_invite_base_url" varchar(255) NOT NULL DEFAULT 'https://play.google.com/store/apps/details?id=com.bizzdeal.app'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN IF NOT EXISTS "app_invite_base_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN IF NOT EXISTS "app_share_joiner_bizz_points"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN IF NOT EXISTS "app_share_sharer_bizz_points"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_users_invite_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "invite_code"`,
    );
  }
}
