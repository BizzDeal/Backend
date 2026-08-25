import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIconToBusinessCategories1787700000000 implements MigrationInterface {
    name = 'AddIconToBusinessCategories1787700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_categories" ADD COLUMN IF NOT EXISTS "icon" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_categories" DROP COLUMN IF EXISTS "icon"`);
    }
}
