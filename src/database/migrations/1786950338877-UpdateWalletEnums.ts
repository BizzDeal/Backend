import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletEnums1786950338877 implements MigrationInterface {
    name = 'UpdateWalletEnums1786950338877'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."vouchers_status_enum" RENAME TO "vouchers_status_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."vouchers_status_enum" AS ENUM('ISSUED', 'REDEEMED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" TYPE "public"."vouchers_status_enum" USING "status"::"text"::"public"."vouchers_status_enum"`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" SET DEFAULT 'ISSUED'`);
        await queryRunner.query(`DROP TYPE "public"."vouchers_status_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."vouchers_status_enum_old" AS ENUM('ISSUED', 'REDEEMED', 'CANCELLED')`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" TYPE "public"."vouchers_status_enum_old" USING "status"::"text"::"public"."vouchers_status_enum_old"`);
        await queryRunner.query(`ALTER TABLE "vouchers" ALTER COLUMN "status" SET DEFAULT 'ISSUED'`);
        await queryRunner.query(`DROP TYPE "public"."vouchers_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."vouchers_status_enum_old" RENAME TO "vouchers_status_enum"`);
    }

}
