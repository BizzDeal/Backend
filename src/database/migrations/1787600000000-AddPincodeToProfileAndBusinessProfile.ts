import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPincodeToProfileAndBusinessProfile1787600000000 implements MigrationInterface {
    name = 'AddPincodeToProfileAndBusinessProfile1787600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "profiles" ADD "pincode" character varying(10)`);
        await queryRunner.query(`ALTER TABLE "business_profiles" ADD "pincode" character varying(10)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "business_profiles" DROP COLUMN "pincode"`);
        await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "pincode"`);
    }

}
