import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStateAndDistrictToUsersTable1720862400001
  implements MigrationInterface
{
  name = 'AddStateAndDistrictToUsersTable1720862400001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "state_id" uuid NULL;
    `);
    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "district_id" uuid NULL;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_users_state_id'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "FK_users_state_id" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_users_district_id'
        ) THEN
          ALTER TABLE "users" ADD CONSTRAINT "FK_users_district_id" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_state_id" ON "users" ("state_id");
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_district_id" ON "users" ("district_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_district_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_state_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_district_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_users_state_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "district_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "state_id"`);
  }
}
