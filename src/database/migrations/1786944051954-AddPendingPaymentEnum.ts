import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPendingPaymentEnum1786944051954 implements MigrationInterface {
    name = 'AddPendingPaymentEnum1786944051954'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."business_profiles_status_enum" ADD VALUE 'PENDING_PAYMENT'`);
        await queryRunner.query(`ALTER TYPE "public"."users_status_enum" ADD VALUE 'PENDING_PAYMENT'`);
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
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum_old" AS ENUM('UNVERIFIED', 'PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "status" TYPE "public"."users_status_enum_old" USING "status"::"text"::"public"."users_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."users_status_enum_old" RENAME TO "users_status_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."business_profiles_status_enum_old" AS ENUM('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED')`);
        await queryRunner.query(`ALTER TABLE "business_profiles" ALTER COLUMN "status" TYPE "public"."business_profiles_status_enum_old" USING "status"::"text"::"public"."business_profiles_status_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."business_profiles_status_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."business_profiles_status_enum_old" RENAME TO "business_profiles_status_enum"`);
    }

}
