import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLocationModuleTables1720862400000
  implements MigrationInterface
{
  name = 'CreateLocationModuleTables1720862400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Drop deprecated / unnecessary tables and enums in Supabase / PostgreSQL if they exist from previous syncs
    await queryRunner.query(`
      DROP TABLE IF EXISTS "village_pincode_mappings", "villages", "sub_districts", "urban_pincode_mappings", "urban_local_bodies", "location_sync_file_jobs", "location_sync_jobs" CASCADE;
    `);
    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."location_sync_jobs_status_enum" CASCADE;
    `);

    // 1. Create Enums
    await queryRunner.query(`
      CREATE TYPE "public"."states_type_enum" AS ENUM('STATE', 'UNION_TERRITORY');
    `);

    // 2. Create States Table
    await queryRunner.query(`
      CREATE TABLE "states" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lgd_code" varchar NOT NULL,
        "name" varchar(255) NOT NULL,
        "type" "public"."states_type_enum" NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_states_lgd_code" UNIQUE ("lgd_code"),
        CONSTRAINT "PK_states" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_states_lgd_code" ON "states" ("lgd_code");
    `);

    // 3. Create Districts Table
    await queryRunner.query(`
      CREATE TABLE "districts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "lgd_code" varchar NOT NULL,
        "state_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_districts_lgd_code" UNIQUE ("lgd_code"),
        CONSTRAINT "PK_districts" PRIMARY KEY ("id")
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_districts_lgd_code" ON "districts" ("lgd_code");
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_districts_state_id" ON "districts" ("state_id");
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_districts_state_id_name" ON "districts" ("state_id", "name");
    `);
    await queryRunner.query(`
      ALTER TABLE "districts" ADD CONSTRAINT "FK_districts_state_id" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "districts" DROP CONSTRAINT IF EXISTS "FK_districts_state_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "districts"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "states"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."states_type_enum"`);
  }
}
