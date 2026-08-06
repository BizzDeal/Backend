import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBizzCoinValueToPlatformSettings1754500000000 implements MigrationInterface {
  name = 'AddBizzCoinValueToPlatformSettings1754500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD COLUMN IF NOT EXISTS "bizz_coin_value" numeric(10,2) NOT NULL DEFAULT '1.00'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN IF NOT EXISTS "bizz_coin_value"`,
    );
  }
}
